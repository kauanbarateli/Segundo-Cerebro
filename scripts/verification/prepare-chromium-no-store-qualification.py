"""Separate synthetic Chromium experiment. Never qualifies the application."""
import hashlib
import json
import os
import re
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

IMAGE = "mcr.microsoft.com/playwright:v1.63.0-noble@sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7"
IMAGE_ID = "sha256:2c1f4e0fd6450f43ddb46d60c2a6df30855a8588e165b1f2559fb0eda8d7ff35"
PINS = {
    "old": ("153.0.8010.12", 195836009, "8aac35011c18f6e2d10696154af89a5728ac2ddd6dc6fad24ffdf243c3fcfd5a", 293285184, "8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e"),
    "candidate": ("157.0.8103.6", 202676171, "7802b25411aa5b8aa387cc733a45df6eed1aea8cc046fd4e2dec64d5918b1853", 305061192, "ec4e78d65a5382c2b50aaf28c6a655a624973b3d3c711a2a4ae34369fd9a3444"),
}
WORK = Path("work/chromium-no-store-qualification")
SOURCE = Path("scripts/verification/chromium-no-store-qualification.mjs")
MAX_ARCHIVE = 256 * 1024 * 1024
MAX_UNPACKED = 512 * 1024 * 1024
CASE_SECONDS = 30
OWNED_GROUPS = set()
LABEL = "org.segundocerebro.chromium-qualification"


class Refused(Exception):
    pass


def demand(condition, code):
    if not condition:
        raise Refused(code)


def digest(path):
    demand(stat.S_ISREG(path.lstat().st_mode), "FILE_REFUSED")
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def exclusive(path, data, mode=0o600):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)


def document(path, value):
    exclusive(path, (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode())


def zip_plan(archive):
    """Validate the complete catalogue before materializing any member."""
    entries = archive.infolist()
    demand(0 < len(entries) <= 1024, "ZIP_CATALOGUE_REFUSED")
    seen, files, plan, total = set(), set(), [], 0
    for entry in entries:
        name = entry.filename
        demand(isinstance(name, str) and 0 < len(name) <= 240 and name == entry.orig_filename, "ZIP_PATH_REFUSED")
        demand("\\" not in name and ":" not in name and not name.startswith("/") and all(32 <= ord(c) < 127 for c in name), "ZIP_PATH_REFUSED")
        parts = name.removesuffix("/").split("/")
        demand(parts[0] == "chrome-linux64" and all(p not in ("", ".", "..") for p in parts), "ZIP_PATH_REFUSED")
        relative = "/".join(parts)
        demand(relative not in seen and not any("/".join(parts[:i]) in files for i in range(1, len(parts))), "ZIP_DUPLICATE_REFUSED")
        demand(not entry.flag_bits & 1 and entry.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), "ZIP_FORMAT_REFUSED")
        mode = entry.external_attr >> 16
        kind = stat.S_IFMT(mode)
        demand(not mode & 0o7000 and kind in (0, stat.S_IFDIR, stat.S_IFREG), "ZIP_MODE_REFUSED")
        directory = entry.is_dir()
        demand((directory and kind != stat.S_IFREG or not directory and kind != stat.S_IFDIR), "ZIP_MODE_REFUSED")
        demand(0 <= entry.file_size <= 320 * 1024 * 1024 and 0 <= entry.compress_size <= MAX_ARCHIVE, "ZIP_SIZE_REFUSED")
        if directory:
            demand(entry.file_size == 0, "ZIP_SIZE_REFUSED")
        else:
            files.add(relative)
        total += entry.file_size
        demand(total <= MAX_UNPACKED, "ZIP_SIZE_REFUSED")
        seen.add(relative)
        plan.append((entry, parts, directory, bool(mode & 0o111)))
    demand("chrome-linux64/chrome" in files, "ZIP_EXECUTABLE_REFUSED")
    demand(not any(any(other.startswith(path + "/") for other in seen) for path in files), "ZIP_DUPLICATE_REFUSED")
    return plan


def extract_checked(archive_path, destination, expected_zip, expected_exe, expected_size=None):
    demand(digest(archive_path) == expected_zip, "ZIP_HASH_REFUSED")
    demand(not destination.exists() and not destination.is_symlink(), "DESTINATION_REFUSED")
    with zipfile.ZipFile(archive_path) as archive:
        plan = zip_plan(archive)
        destination.mkdir(mode=0o700)
        root_fd = os.open(destination, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            for entry, parts, directory, executable in plan:
                parent_fd = os.dup(root_fd)
                try:
                    for part in parts[:-1] if not directory else parts:
                        try:
                            os.mkdir(part, mode=0o700, dir_fd=parent_fd)
                        except FileExistsError:
                            pass
                        next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
                        os.close(parent_fd)
                        parent_fd = next_fd
                    if directory:
                        continue
                    fd = os.open(parts[-1], os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o700 if executable else 0o600, dir_fd=parent_fd)
                    count = 0
                    with os.fdopen(fd, "wb") as output, archive.open(entry, "r") as source:
                        for block in iter(lambda: source.read(1024 * 1024), b""):
                            count += len(block)
                            demand(count <= entry.file_size, "ZIP_SIZE_REFUSED")
                            output.write(block)
                    demand(count == entry.file_size, "ZIP_SIZE_REFUSED")
                finally:
                    os.close(parent_fd)
        finally:
            os.close(root_fd)
    binary = destination / "chrome-linux64/chrome"
    demand(digest(binary) == expected_exe and (expected_size is None or binary.stat().st_size == expected_size), "EXECUTABLE_HASH_REFUSED")
    demand(binary.stat().st_mode & 0o100, "EXECUTABLE_MODE_REFUSED")
    return binary.resolve(strict=True)


def check_environment_templates(root):
    allowed = {root / ".env.example", root / "scripts/operations/.env.example"}
    for parent, directories, files in os.walk(root, followlinks=False):
        directories[:] = [name for name in directories if name not in (".git", "node_modules", "work")]
        for name in directories + files:
            if name.startswith(".env"):
                path = Path(parent) / name
                demand(path in allowed and stat.S_ISREG(path.lstat().st_mode), "ENVIRONMENT_REFUSED")


def preflight(root, installed=False):
    demand(sys.platform == "linux" and os.geteuid() != 0 and os.getegid() != 0, "PLATFORM_REFUSED")
    demand(root == root.resolve(strict=True) and (root / ".git").exists(), "CHECKOUT_REFUSED")
    check_environment_templates(root)
    lock = json.loads((root / "package-lock.json").read_text())
    for name in ("playwright", "playwright-core", "@playwright/test"):
        pin = lock["packages"]["node_modules/" + name]
        demand(pin["version"] == "1.63.0" and pin["resolved"].startswith("https://registry.npmjs.org/") and pin["integrity"].startswith("sha512-"), "SDK_REFUSED")
        if installed:
            package = json.loads((root / "node_modules" / name / "package.json").read_text())
            demand(package["name"] == name and package["version"] == "1.63.0", "SDK_REFUSED")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise Refused("DOWNLOAD_REDIRECT_REFUSED")


def download(destination, pin):
    version, size, expected, _, _ = pin
    url = "https://storage.googleapis.com/chrome-for-testing-public/" + version + "/linux64/chrome-linux64.zip"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    deadline, received, checksum = time.monotonic() + 180, 0, hashlib.sha256()
    with opener.open(url, timeout=30) as reply:
        demand(reply.status == 200 and reply.geturl() == url and reply.headers.get("Content-Length") == str(size), "DOWNLOAD_REFUSED")
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as output:
            for block in iter(lambda: reply.read(1024 * 1024), b""):
                received += len(block)
                demand(time.monotonic() < deadline and received <= size <= MAX_ARCHIVE, "DOWNLOAD_REFUSED")
                output.write(block)
                checksum.update(block)
    demand(received == size and checksum.hexdigest() == expected, "DOWNLOAD_HASH_REFUSED")


def prepare(root):
    preflight(root, installed=True)
    parent = root / "work"
    if not parent.exists():
        parent.mkdir(mode=0o700)
    demand(stat.S_ISDIR(parent.lstat().st_mode), "DESTINATION_REFUSED")
    work = root / WORK
    work.mkdir(mode=0o700)
    (work / "reports").mkdir(mode=0o700)
    (work / "homes").mkdir(mode=0o700)
    source = root / SOURCE
    demand(stat.S_ISREG(source.lstat().st_mode), "SOURCE_REFUSED")
    content = source.read_bytes()
    exclusive(work / "qualify.mjs", content)
    demand((work / "qualify.mjs").read_bytes() == content, "SOURCE_REFUSED")
    manifest = {"schemaVersion": 1}
    for mode, pin in PINS.items():
        archive = work / (mode + "-linux64.zip")
        download(archive, pin)
        binary = extract_checked(archive, work / mode, pin[2], pin[4], pin[3])
        manifest[mode] = {"executablePath": str(binary), "expectedVersion": pin[0], "sha256": pin[4]}
    document(work / "manifest.json", manifest)
    document(work / "prepared.json", {"schemaVersion": 1, "harnessSha256": hashlib.sha256(content).hexdigest()})


def clean_env(home):
    return {"PATH": "/usr/bin:/bin", "HOME": str(home), "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "TZ": "UTC"}


def command(args, deadline, home, timeout=None, input_bytes=None):
    remaining = deadline - time.monotonic()
    demand(remaining > 0, "SUPERVISOR_DEADLINE")
    demand(input_bytes is None or isinstance(input_bytes, bytes) and len(input_bytes) <= 65536, "INPUT_REFUSED")
    limit = min(deadline, time.monotonic() + timeout) if timeout is not None else deadline
    process = subprocess.Popen(args, stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=clean_env(home), start_new_session=True)
    OWNED_GROUPS.add(process.pid)
    output, offset, refusal = bytearray(), 0, None
    try:
        with selectors.DefaultSelector() as selector:
            os.set_blocking(process.stdout.fileno(), False)
            selector.register(process.stdout, selectors.EVENT_READ)
            if input_bytes is not None:
                os.set_blocking(process.stdin.fileno(), False)
                selector.register(process.stdin, selectors.EVENT_WRITE)
            while selector.get_map() or process.poll() is None:
                demand(time.monotonic() < limit, "SUPERVISOR_DEADLINE")
                for key, _ in selector.select(timeout=min(0.05, max(0, limit - time.monotonic()))):
                    if key.fileobj is process.stdin:
                        if offset < len(input_bytes):
                            offset += os.write(process.stdin.fileno(), input_bytes[offset:offset + 16384])
                        if offset == len(input_bytes):
                            selector.unregister(process.stdin)
                            process.stdin.close()
                    else:
                        block = os.read(process.stdout.fileno(), min(16384, 65537 - len(output)))
                        if not block:
                            selector.unregister(process.stdout)
                        else:
                            output.extend(block)
                            demand(len(output) <= 65536, "OUTPUT_REFUSED")
    except Refused as error:
        refusal = str(error)
    except Exception:
        refusal = "PROCESS_REFUSED"
    finally:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        try:
            process.wait(timeout=max(0.001, min(1, deadline - time.monotonic())))
        except subprocess.TimeoutExpired:
            raise Refused("PROCESS_GROUP_UNCONFIRMED") from None
        process.stdout.close()
        if process.stdin is not None and not process.stdin.closed:
            process.stdin.close()
    try:
        os.killpg(process.pid, 0)
    except ProcessLookupError:
        OWNED_GROUPS.discard(process.pid)
    else:
        os.killpg(process.pid, signal.SIGKILL)
        raise Refused("PROCESS_GROUP_UNCONFIRMED")
    if refusal:
        raise Refused(refusal)
    return process.returncode, bytes(output)


def checked(args, deadline, home, timeout=None, input_bytes=None):
    code, output = command(args, deadline, home, timeout, input_bytes)
    demand(code == 0, "COMMAND_REFUSED")
    return output


INSPECT = '{"id":{{json .Id}},"name":{{json .Name}},"label":{{json (index .Config.Labels "org.segundocerebro.chromium-qualification")}},"image":{{json .Config.Image}},"imageId":{{json .Image}},"user":{{json .Config.User}},"running":{{json .State.Running}},"exitCode":{{json .State.ExitCode}},"ipc":{{json .HostConfig.IpcMode}},"shm":{{json .HostConfig.ShmSize}},"network":{{json .HostConfig.NetworkMode}},"pid":{{json .HostConfig.PidMode}},"privileged":{{json .HostConfig.Privileged}},"init":{{json .HostConfig.Init}},"readOnly":{{json .HostConfig.ReadonlyRootfs}},"capDrop":{{json .HostConfig.CapDrop}},"securityOpt":{{json .HostConfig.SecurityOpt}},"restart":{{json .HostConfig.RestartPolicy.Name}},"log":{{json .HostConfig.LogConfig.Type}},"mounts":{{json .Mounts}},"tmpfs":{{json .HostConfig.Tmpfs}}}'


def private_tmpfs():
    owner = "uid=" + str(os.geteuid()) + ",gid=" + str(os.getegid())
    return {"/home/pwuser": "rw,nosuid,nodev,size=268435456," + owner + ",mode=0700", "/tmp": "rw,nosuid,nodev,size=134217728," + owner + ",mode=1777"}


def inspect_container(container, name, root, deadline, home, strict=True):
    value = json.loads(checked(["/usr/bin/docker", "inspect", "--format", INSPECT, container], deadline, home))
    demand(re.fullmatch(r"[a-f0-9]{64}", value["id"]) is not None and (container == name or value["id"] == container) and value["name"] == "/" + name and value["label"] == name, "CONTAINER_OWNERSHIP_REFUSED")
    if not strict:
        return value
    demand(value["image"] == IMAGE and value["imageId"] == IMAGE_ID and value["user"] == str(os.geteuid()) + ":" + str(os.getegid()), "CONTAINER_REFUSED")
    demand(value["ipc"] == "private" and value["shm"] == 536870912 and value["network"] == "none" and value["pid"] == "" and value["privileged"] is False and value["init"] is True and value["readOnly"] is True and value["capDrop"] == ["ALL"] and value["securityOpt"] in (["no-new-privileges:true"], ["no-new-privileges"]) and value["restart"] == "no" and value["log"] == "none", "CONTAINER_REFUSED")
    mounts = value["mounts"]
    binds = [m for m in mounts if m["Type"] == "bind"]
    demand(len(binds) == 1 and {(m["Source"], m["Destination"], m["RW"]) for m in binds} == {(str(root), str(root), False)}, "CONTAINER_REFUSED")
    demand(value["tmpfs"] == private_tmpfs() and all(m["Type"] in ("bind", "tmpfs") for m in mounts) and all(m["Destination"] in private_tmpfs() and m["RW"] is True for m in mounts if m["Type"] == "tmpfs"), "CONTAINER_REFUSED")
    return value


VALIDATOR_SENTINEL = "validate-chromium-report"
VALIDATE_JS = 'import{readFileSync}from"node:fs";import{pathToFileURL}from"node:url";const raw=readFileSync(0,"utf8");const{validateQualificationReport}=await import(pathToFileURL(process.argv[2]).href);const value=validateQualificationReport(JSON.parse(raw));process.stdout.write(JSON.stringify(value));'


def validation_arguments(node, source):
    return [str(node), "--input-type=module", "-e", VALIDATE_JS, VALIDATOR_SENTINEL, str(source)]


def assert_binding(report, mode, harness_hash):
    binding = report["binding"]
    demand(isinstance(binding, dict) and binding["binarySha256"] == PINS[mode][4] and binding["expectedVersion"] == PINS[mode][0] and binding["harnessSha256"] == harness_hash, "REPORT_BINDING_REFUSED")


def decisive(report, mode):
    if report is None or report["status"] != ("REPRODUCED" if mode == "old" else "QUALIFIED") or not all(v is True for v in report["cleanup"].values()):
        return False
    rows = report["cases"]
    if len(rows) != 5 or [r["kind"] for r in rows] != ["positive-1", "positive-2", "positive-3", "abort", "truncate"] or not all(r["result"] == "NEGATIVE_PASSED" for r in rows[3:]):
        return False
    if mode == "old":
        return all(r["result"] in ("NATURAL_FINISHED", "REPRODUCED") for r in rows[:3]) and any(r["result"] == "REPRODUCED" for r in rows[:3])
    return all(r["result"] == "NATURAL_FINISHED" for r in rows[:3])


def run_case(root, mode, interception, node):
    started = time.monotonic()
    deadline, work = started + CASE_SECONDS, root / WORK
    home = work / "homes" / (mode + "-" + interception)
    home.mkdir(mode=0o700)
    for folder in ("tmp", "cache", "config"):
        (home / folder).mkdir(mode=0o700)
    name = "sc-chromium-qualification-" + os.urandom(12).hex() + "-" + mode + "-" + interception
    container, owned, code, report, phase = None, False, "REFUSED", None, "create"
    cleanup = {"processGroupAbsent": False, "containerStopped": False, "containerRemoved": False}
    try:
        demand(not OWNED_GROUPS, "PROCESS_GROUP_UNCONFIRMED")
        args = ["/usr/bin/docker", "create", "--name", name, "--label", LABEL + "=" + name, "--platform", "linux/amd64", "--network", "none", "--ipc", "private", "--shm-size", "512m", "--init", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--read-only", "--log-driver", "none", "--restart", "no", "--user", str(os.geteuid()) + ":" + str(os.getegid()), "--workdir", str(root), "--mount", "type=bind,source=" + str(root) + ",target=" + str(root) + ",readonly"]
        for target, options in private_tmpfs().items():
            args.extend(["--tmpfs", target + ":" + options])
        for key, value in {**clean_env(Path("/home/pwuser")), "TMPDIR": "/tmp", "XDG_CACHE_HOME": "/home/pwuser/cache", "XDG_CONFIG_HOME": "/home/pwuser/config"}.items():
            args.extend(["--env", key + "=" + value])
        args.extend(["--entrypoint", "/usr/bin/node", IMAGE, str(work / "qualify.mjs"), mode, interception])
        container = checked(args, deadline - 3, home).decode().strip()
        demand(re.fullmatch(r"[a-f0-9]{64}", container) is not None, "CONTAINER_REFUSED")
        phase = "inspect"
        inspect_container(container, name, root, deadline - 3, home, strict=False)
        owned = True
        before = inspect_container(container, name, root, deadline - 3, home)
        demand(before["running"] is False, "CONTAINER_REFUSED")
        phase = "start"
        exit_code, raw = command(["/usr/bin/docker", "start", "--attach", container], deadline - 3, home, timeout=25)
        phase = "inspect"
        after = inspect_container(container, name, root, deadline - 3, home)
        demand(after["running"] is False and after["exitCode"] == exit_code, "CONTAINER_REFUSED")
        cleanup["processGroupAbsent"] = True
        cleanup["containerStopped"] = True
        phase = "validate"
        demand((work / "qualify.mjs").read_bytes() == (root / SOURCE).read_bytes(), "SOURCE_REFUSED")
        report = json.loads(checked(validation_arguments(node, root / SOURCE), deadline - 3, home, input_bytes=raw))
        phase = "binding"
        demand(report["mode"] == mode and report["interception"] == interception and report["platform"] == "linux" and report["driverVersion"] == "1.63.0" and report["diagnosticOnly"] is True and report["applicationAccepted"] is False, "REPORT_REFUSED")
        assert_binding(report, mode, digest(root / SOURCE))
        demand(exit_code == (1 if report["status"] == "REFUSED" else 0), "REPORT_REFUSED")
        code = "OBSERVED"
    except Refused as error:
        code = str(error)
    except Exception:
        code = "SUPERVISOR_REFUSED"
    finally:
        if not owned:
            try:
                reconciled = inspect_container(name, name, root, deadline, home, strict=False)
                container, owned = reconciled["id"], True
            except Exception:
                code = "CLEANUP_UNCONFIRMED"
        if owned:
            try:
                current = inspect_container(container, name, root, deadline, home, strict=False)
                if current["running"]:
                    checked(["/usr/bin/docker", "kill", container], deadline, home)
                    current = inspect_container(container, name, root, deadline, home, strict=False)
                cleanup["containerStopped"] = current["running"] is False
                if cleanup["containerStopped"]:
                    checked(["/usr/bin/docker", "rm", container], deadline, home)
                    absent = checked(["/usr/bin/docker", "ps", "--all", "--no-trunc", "--filter", "id=" + container, "--format", "{{.ID}}"], deadline, home)
                    cleanup["containerRemoved"] = absent.strip() == b""
            except Exception:
                code = "CLEANUP_UNCONFIRMED"
    cleanup["processGroupAbsent"] = not OWNED_GROUPS
    if time.monotonic() >= deadline:
        code = "SUPERVISOR_DEADLINE"
    if report is not None:
        document(work / "reports" / (mode + "-" + interception + "-report.json"), report)
    supervisor = {"schemaVersion": 1, "mode": mode, "interception": interception, "diagnosticOnly": True, "applicationAccepted": False, "deadlineMs": 30000, "status": "OBSERVED" if code == "OBSERVED" and all(cleanup.values()) else "REFUSED", "code": code, "phase": phase, "cleanup": cleanup}
    document(work / "reports" / (mode + "-" + interception + "-supervisor.json"), supervisor)
    return report, supervisor


def run(root):
    preflight(root, installed=True)
    work = root / WORK
    demand((work / "qualify.mjs").read_bytes() == (root / SOURCE).read_bytes(), "SOURCE_REFUSED")
    prepared = json.loads((work / "prepared.json").read_text())
    demand(prepared == {"schemaVersion": 1, "harnessSha256": digest(root / SOURCE)}, "SOURCE_REFUSED")
    home = work / "homes"
    deadline = time.monotonic() + 300
    node = Path(shutil.which("node") or "").resolve(strict=True)
    demand(str(node).startswith("/opt/hostedtoolcache/node/") and stat.S_ISREG(node.lstat().st_mode), "NODE_REFUSED")
    demand(re.fullmatch(rb"v24\.[0-9]+\.[0-9]+\n", checked([str(node), "--version"], deadline, home)) is not None, "NODE_REFUSED")
    checked(["/usr/bin/docker", "pull", "--platform", "linux/amd64", IMAGE], deadline, home)
    image = json.loads(checked(["/usr/bin/docker", "image", "inspect", "--format", '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}}}', IMAGE], deadline, home))
    demand(image == {"id": IMAGE_ID, "os": "linux", "architecture": "amd64"}, "IMAGE_REFUSED")
    results = []
    for mode, interception in ((m, i) for m in ("old", "candidate") for i in ("off", "continue")):
        demand(digest(work / mode / "chrome-linux64/chrome") == PINS[mode][4], "EXECUTABLE_HASH_REFUSED")
        report, supervisor = run_case(root, mode, interception, node)
        results.append((report, supervisor))
        if report is None or not all(v is True for v in report["cleanup"].values()) or not all(supervisor["cleanup"].values()):
            break
    qualified = len(results) == 4 and all(supervisor["status"] == "OBSERVED" and decisive(report, supervisor["mode"]) for report, supervisor in results)
    summary = {"schemaVersion": 1, "diagnosticOnly": True, "applicationAccepted": False, "status": "QUALIFIED" if qualified else "REFUSED", "cases": [{"mode": s["mode"], "interception": s["interception"], "status": r["status"] if r is not None else "REFUSED", "supervisor": s["status"]} for r, s in results]}
    document(work / "reports/qualification-summary.json", summary)
    return 0 if qualified else 1


def main():
    try:
        demand(len(sys.argv) == 2 and sys.argv[1] in ("preflight", "prepare", "run"), "COMMAND_REFUSED")
        root = Path.cwd().resolve(strict=True)
        if sys.argv[1] == "preflight":
            preflight(root)
        elif sys.argv[1] == "prepare":
            prepare(root)
        else:
            return run(root)
        return 0
    except Refused as error:
        print(json.dumps({"status": "REFUSED", "code": str(error), "diagnosticOnly": True, "applicationAccepted": False}))
    except Exception:
        print(json.dumps({"status": "REFUSED", "code": "PREPARATION_REFUSED", "diagnosticOnly": True, "applicationAccepted": False}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
