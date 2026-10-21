"""Prepare the exact Linux browser qualified in run 39221217191; no application acceptance."""
import importlib.util
import json
import platform
import re
import stat
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = Path("work/qualified-chromium")
HARNESS = Path("scripts/verification/chromium-no-store-qualification.mjs")
HARNESS_SHA = "2b904e3d226b08fc39e7287eb8f96575e10ec1e95de51a5e64461df0188056a5"
PIN = ("157.0.8103.6", 202676171, "7802b25411aa5b8aa387cc733a45df6eed1aea8cc046fd4e2dec64d5918b1853", 305061192, "ec4e78d65a5382c2b50aaf28c6a655a624973b3d3c711a2a4ae34369fd9a3444")


class RuntimeRefused(Exception):
    pass


def demand(condition, code):
    if not condition:
        raise RuntimeRefused(code)


def qualification_helpers():
    source = ROOT / "scripts/verification/prepare-chromium-no-store-qualification.py"
    demand(stat.S_ISREG(source.lstat().st_mode), "HELPER_REFUSED")
    spec = importlib.util.spec_from_file_location("qualified_chromium_extractor", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare(root):
    helper = qualification_helpers()
    demand(root == ROOT and root == root.resolve(strict=True) and Path.cwd().resolve(strict=True) == root, "CHECKOUT_REFUSED")
    demand(platform.machine().lower() in ("x86_64", "amd64"), "PLATFORM_REFUSED")
    helper.preflight(root, installed=True)
    demand(helper.PINS["candidate"] == PIN and not helper.OWNED_GROUPS, "BINDING_REFUSED")
    demand(helper.digest(root / HARNESS) == HARNESS_SHA, "HARNESS_REFUSED")
    parent = root / "work"
    if not parent.exists():
        parent.mkdir(mode=0o700)
    demand(stat.S_ISDIR(parent.lstat().st_mode) and parent.resolve(strict=True) == parent, "DESTINATION_REFUSED")
    assets = root / WORK
    # Exclusive creation: a previous preparation, symlink or partial attempt is refused.
    assets.mkdir(mode=0o700)
    archive = assets / "chrome-linux64.zip"
    helper.download(archive, PIN)
    binary = helper.extract_checked(archive, assets / "extracted", PIN[2], PIN[4], PIN[3])
    # The shared JS/config contract uses this one fixed location.
    (assets / "extracted/chrome-linux64").rename(assets / "chrome-linux64")
    (assets / "extracted").rmdir()
    binary = assets / "chrome-linux64/chrome"
    home = assets / "version-home"
    home.mkdir(mode=0o700)
    deadline = time.monotonic() + 6
    code, output = helper.command([str(binary), "--version"], deadline, home, timeout=5)
    demand(code == 0 and output in (b"Google Chrome for Testing 157.0.8103.6 \n", b"Google Chrome for Testing 157.0.8103.6\n"), "VERSION_REFUSED")
    demand(not helper.OWNED_GROUPS, "PROCESS_GROUP_UNCONFIRMED")
    archive_size, executable_size = archive.lstat().st_size, binary.lstat().st_size
    archive_sha, executable_sha = helper.digest(archive), helper.digest(binary)
    demand((archive_size, archive_sha, executable_size, executable_sha) == (PIN[1], PIN[2], PIN[3], PIN[4]), "BINDING_REFUSED")
    driver = json.loads((root / "node_modules/playwright-core/package.json").read_text())["version"]
    demand(driver == "1.63.0", "SDK_REFUSED")
    return {"schemaVersion": 1, "scenario": "qualified-chromium-runtime", "status": "BOUND", "applicationAccepted": False, "platform": "linux", "arch": "x64", "driverVersion": driver, "browserVersion": PIN[0], "executableSha256": executable_sha, "archiveSha256": archive_sha, "qualificationRun": 39221217191, "harnessSha256": HARNESS_SHA, "executableBytes": executable_size, "archiveBytes": archive_size}


def main(argv):
    try:
        demand(argv == ["prepare"], "ARGUMENTS_REFUSED")
        record = prepare(ROOT)
        print(json.dumps(record, separators=(",", ":"), allow_nan=False))
        return 0
    except Exception as error:
        # Never echo process output, environment, paths or arbitrary exception text.
        code = str(error) if isinstance(error, RuntimeRefused) and re.fullmatch(r"[A-Z_]{1,64}", str(error)) else "PREPARATION_REFUSED"
        print(json.dumps({"schemaVersion": 1, "scenario": "qualified-chromium-runtime", "status": "REFUSED", "code": code, "applicationAccepted": False}, separators=(",", ":")))
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
