"""Pure ZIP and report-binding controls; no download, process or browser."""
import hashlib
import importlib.util
import json
import os
import stat
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("chromium_qualification_prepare", ROOT / "scripts/verification/prepare-chromium-no-store-qualification.py")
prepare = importlib.util.module_from_spec(SPEC)
with mock.patch("subprocess.Popen", side_effect=AssertionError("Import must not launch")), mock.patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("Import must not access the network")):
    SPEC.loader.exec_module(prepare)

BODY = b"synthetic-not-an-executable"


def member(name, mode=stat.S_IFREG | 0o644, size=1):
    item = zipfile.ZipInfo(name)
    item.create_system = 3
    item.external_attr = mode << 16
    item.file_size = size
    return item


class EnvironmentTemplateTests(unittest.TestCase):
    def test_only_the_two_exact_regular_templates_are_allowed_without_reading_values(self):
        root = Path("synthetic-checkout")
        regular = SimpleNamespace(st_mode=stat.S_IFREG | 0o600)
        allowed_rows = [(str(root), ["scripts"], [".env.example"]), (str(root / "scripts/operations"), [], [".env.example"])]
        with mock.patch.object(prepare.os, "walk", return_value=allowed_rows) as walked, mock.patch.object(prepare.Path, "lstat", return_value=regular) as inspected, mock.patch.object(prepare.Path, "read_text", side_effect=AssertionError("No environment values may be read")), mock.patch.object(prepare.Path, "read_bytes", side_effect=AssertionError("No environment values may be read")):
            prepare.check_environment_templates(root)
        walked.assert_called_once_with(root, followlinks=False)
        self.assertEqual(inspected.call_count, 2)
        for relative, mode in ((".env", stat.S_IFREG), (".env.local", stat.S_IFREG), ("unknown/.env.example", stat.S_IFREG), ("scripts/unknown/.env.example", stat.S_IFREG), (".env.example", stat.S_IFLNK), ("scripts/operations/.env.example", stat.S_IFLNK), (".env.example", stat.S_IFDIR)):
            target = root / relative
            rows = [(str(target.parent), [], [target.name])]
            with self.subTest(relative=relative, mode=mode), mock.patch.object(prepare.os, "walk", return_value=rows), mock.patch.object(prepare.Path, "lstat", return_value=SimpleNamespace(st_mode=mode | 0o600)), mock.patch.object(prepare.Path, "read_text", side_effect=AssertionError("No environment values may be read")), mock.patch.object(prepare.Path, "read_bytes", side_effect=AssertionError("No environment values may be read")), self.assertRaisesRegex(prepare.Refused, "^ENVIRONMENT_REFUSED$"):
                prepare.check_environment_templates(root)


class CatalogueTests(unittest.TestCase):
    def plan(self, entries):
        return prepare.zip_plan(SimpleNamespace(infolist=lambda: entries))

    def test_paths_and_links_are_refused_before_any_extraction(self):
        good = member("chrome-linux64/chrome", stat.S_IFREG | 0o755)
        for path in ("../escape", "/absolute", "chrome-linux64/../escape", "chrome-linux64\\escape", "chrome-linux64/./escape", "chrome-linux64//escape", "other/chrome", "chrome-linux64/C:escape"):
            with self.subTest(path=path), self.assertRaises(prepare.Refused):
                self.plan([good, member(path)])
        for kind in (stat.S_IFLNK, stat.S_IFIFO, stat.S_IFSOCK, stat.S_IFCHR, stat.S_IFBLK):
            with self.subTest(kind=kind), self.assertRaises(prepare.Refused):
                self.plan([good, member("chrome-linux64/foreign", kind | 0o777)])

    def test_privileged_modes_and_duplicate_or_file_parent_names_are_refused(self):
        good = member("chrome-linux64/chrome", stat.S_IFREG | 0o755)
        for mode in (0o4755, 0o2755, 0o1755):
            with self.subTest(mode=mode), self.assertRaises(prepare.Refused):
                self.plan([member("chrome-linux64/chrome", stat.S_IFREG | mode)])
        for tail in ([good], [member("chrome-linux64/asset"), member("chrome-linux64/asset/child")], [member("chrome-linux64/asset/child"), member("chrome-linux64/asset")]):
            with self.subTest(tail=tail), self.assertRaises(prepare.Refused):
                self.plan([good, *tail])

    def test_encryption_null_names_and_expansion_limits_are_refused(self):
        good = member("chrome-linux64/chrome", stat.S_IFREG | 0o755)
        encrypted = member("chrome-linux64/encrypted")
        encrypted.flag_bits = 1
        null = member("chrome-linux64/bad")
        null.orig_filename += "\0hidden"
        oversized = member("chrome-linux64/large", size=320 * 1024 * 1024 + 1)
        for item in (encrypted, null, oversized):
            with self.subTest(name=item.filename), self.assertRaises(prepare.Refused):
                self.plan([good, item])
        with mock.patch.object(prepare, "MAX_UNPACKED", 1), self.assertRaises(prepare.Refused):
            self.plan([good, member("chrome-linux64/second")])
        with self.assertRaises(prepare.Refused):
            self.plan([member("chrome-linux64/" + str(i)) for i in range(1025)])


@unittest.skipUnless(os.name == "posix" and hasattr(os, "O_NOFOLLOW"), "Actual directory-descriptor extraction is Linux-only")
class ExtractionTests(unittest.TestCase):
    def fixture(self, root, extra=()):
        path = root / "browser.zip"
        with warnings.catch_warnings(), zipfile.ZipFile(path, "w") as archive:
            warnings.simplefilter("ignore", UserWarning)
            archive.writestr(member("chrome-linux64/chrome", stat.S_IFREG | 0o755), BODY)
            archive.writestr(member("chrome-linux64/resources/data.bin"), b"public-resource")
            for item, data in extra:
                archive.writestr(item, data)
        return path

    def test_descriptor_extraction_preserves_bytes_and_only_safe_owner_modes(self):
        with tempfile.TemporaryDirectory(prefix="sc-qualification-unit-") as name:
            root = Path(name)
            archive = self.fixture(root)
            binary = prepare.extract_checked(archive, root / "out", prepare.digest(archive), hashlib.sha256(BODY).hexdigest(), len(BODY))
            self.assertEqual(binary.read_bytes(), BODY)
            self.assertEqual(stat.S_IMODE(binary.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE((root / "out/chrome-linux64/resources/data.bin").stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE((root / "out/chrome-linux64/resources").stat().st_mode), 0o700)

    def test_wrong_hash_symlink_destination_and_malformed_zip_never_write_outside(self):
        with tempfile.TemporaryDirectory(prefix="sc-qualification-unit-") as name:
            root = Path(name)
            archive = self.fixture(root)
            with self.assertRaises(prepare.Refused):
                prepare.extract_checked(archive, root / "out", "0" * 64, hashlib.sha256(BODY).hexdigest())
            self.assertFalse((root / "out").exists())
            outside = root / "outside"
            outside.mkdir()
            (root / "link").symlink_to(outside, target_is_directory=True)
            with self.assertRaises(prepare.Refused):
                prepare.extract_checked(archive, root / "link", prepare.digest(archive), hashlib.sha256(BODY).hexdigest())
            self.assertEqual(list(outside.iterdir()), [])
            second = root / "second"
            second.mkdir()
            bad = self.fixture(second, extra=[(member("../escape"), b"bad")])
            with self.assertRaises(prepare.Refused):
                prepare.extract_checked(bad, root / "bad-out", prepare.digest(bad), hashlib.sha256(BODY).hexdigest())
            self.assertFalse((root / "bad-out").exists())
            self.assertFalse((root / "escape").exists())


class BindingTests(unittest.TestCase):
    def test_external_binding_requires_the_pinned_binary_version_and_canonical_source_hash(self):
        source_hash = "a" * 64
        for mode in ("old", "candidate"):
            binding = {"binarySha256": prepare.PINS[mode][4], "expectedVersion": prepare.PINS[mode][0], "harnessSha256": source_hash}
            prepare.assert_binding({"binding": binding}, mode, source_hash)
            for key, wrong in (("binarySha256", "b" * 64), ("harnessSha256", "c" * 64), ("expectedVersion", "1.2.3.4")):
                with self.subTest(mode=mode, key=key), self.assertRaises(prepare.Refused):
                    prepare.assert_binding({"binding": {**binding, key: wrong}}, mode, source_hash)

    def test_not_reproduced_or_missing_negative_and_cleanup_proofs_cannot_pass_the_aggregate(self):
        for mode in ("old", "candidate"):
            report = {"status": "REPRODUCED" if mode == "old" else "QUALIFIED", "cleanup": dict.fromkeys(("server", "context", "browser", "session", "sockets", "startup", "operations", "hooks"), True), "cases": [{"kind": kind, "result": "REPRODUCED" if mode == "old" and i == 0 else "NATURAL_FINISHED" if i < 3 else "NEGATIVE_PASSED"} for i, kind in enumerate(("positive-1", "positive-2", "positive-3", "abort", "truncate"))]}
            self.assertTrue(prepare.decisive(report, mode))
            for mutated in ({**report, "status": "NOT_REPRODUCED"}, {**report, "cleanup": {"server": False}}, {**report, "cases": report["cases"][:-1]}, {**report, "cases": [*report["cases"][:-1], {"kind": "truncate", "result": "REFUSED"}]}):
                self.assertFalse(prepare.decisive(mutated, mode))


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self.assertEqual(prepare.OWNED_GROUPS, set())

    def test_output_limit_is_enforced_while_reading_and_owned_group_is_reaped(self):
        stream = SimpleNamespace(fileno=lambda: 17, close=lambda: None)
        process = SimpleNamespace(pid=32123, stdout=stream, stdin=None, returncode=None)
        process.poll = lambda: process.returncode
        def waited(**kwargs):
            process.returncode = -9
            return process.returncode
        process.wait = mock.Mock(side_effect=waited)
        selector = mock.MagicMock()
        selector.__enter__.return_value = selector
        selector.get_map.return_value = {17: stream}
        selector.select.return_value = [(SimpleNamespace(fileobj=stream), 1)]
        def kill(group, signal):
            self.assertEqual(group, process.pid)
            if signal == 0:
                raise ProcessLookupError()
        with mock.patch.object(prepare.subprocess, "Popen", return_value=process), mock.patch.object(prepare.selectors, "DefaultSelector", return_value=selector), mock.patch.object(prepare.os, "set_blocking", create=True), mock.patch.object(prepare.os, "read", side_effect=[b"x" * 16384] * 4 + [b"x"]) as read, mock.patch.object(prepare.os, "killpg", side_effect=kill, create=True), mock.patch.object(prepare.signal, "SIGKILL", 9, create=True):
            with self.assertRaisesRegex(prepare.Refused, "^OUTPUT_REFUSED$"):
                prepare.command(["synthetic-not-executed"], prepare.time.monotonic() + 5, Path("private-home"))
        self.assertEqual(read.call_count, 5)
        self.assertEqual(read.call_args.args, (17, 1))
        process.wait.assert_called_once()
        self.assertEqual(prepare.OWNED_GROUPS, set())

    def test_lost_create_output_reconciles_only_the_owned_name_and_label_before_cleanup(self):
        for reconcile in (True, False):
            with self.subTest(reconcile=reconcile):
                root = Path("synthetic-checkout")
                work = root / prepare.WORK
                commands, inspections = [], []
                identifier = "a" * 64
                def checked(args, *unused, **kwargs):
                    commands.append(args)
                    if args[1] == "create":
                        raise prepare.Refused("OUTPUT_REFUSED")
                    self.assertIn(args[1], ("kill", "rm", "ps"))
                    return b""
                def inspect(container, name, *unused, **kwargs):
                    inspections.append((container, name))
                    self.assertTrue(name.startswith("sc-chromium-qualification-"))
                    if not reconcile:
                        raise prepare.Refused("CONTAINER_OWNERSHIP_REFUSED")
                    self.assertEqual(container, name if len(inspections) == 1 else identifier)
                    return {"id": identifier, "running": len(inspections) < 3}
                with mock.patch.object(prepare, "checked", side_effect=checked), mock.patch.object(prepare, "inspect_container", side_effect=inspect), mock.patch.object(prepare.os, "geteuid", return_value=1001, create=True), mock.patch.object(prepare.os, "getegid", return_value=1001, create=True), mock.patch.object(prepare.Path, "mkdir"), mock.patch.object(prepare, "document") as written:
                    report, supervisor = prepare.run_case(root, "old", "off", Path("node-not-executed"))
                self.assertIsNone(report)
                self.assertEqual(supervisor["status"], "REFUSED")
                self.assertEqual(supervisor["code"], "OUTPUT_REFUSED" if reconcile else "CLEANUP_UNCONFIRMED")
                self.assertEqual(supervisor["cleanup"]["containerRemoved"], reconcile)
                self.assertEqual([args[1] for args in commands], ["create", "kill", "rm", "ps"] if reconcile else ["create"])
                written.assert_called_once_with(work / "reports/old-off-supervisor.json", supervisor)

    def test_container_inspection_accepts_only_the_two_true_no_new_privileges_serializations(self):
        root, name = Path("canonical-checkout"), "sc-chromium-qualification-test"
        identifier = "a" * 64
        with mock.patch.object(prepare.os, "geteuid", return_value=1001, create=True), mock.patch.object(prepare.os, "getegid", return_value=1001, create=True):
            value = {"id": identifier, "name": "/" + name, "label": name, "image": prepare.IMAGE, "imageId": prepare.IMAGE_ID, "user": "1001:1001", "running": False, "exitCode": 0, "ipc": "private", "shm": 536870912, "network": "none", "pid": "", "privileged": False, "init": True, "readOnly": True, "capDrop": ["ALL"], "securityOpt": ["no-new-privileges:true"], "restart": "no", "log": "none", "mounts": [{"Type": "bind", "Source": str(root), "Destination": str(root), "RW": False}], "tmpfs": prepare.private_tmpfs()}
            for security in (["no-new-privileges:true"], ["no-new-privileges"]):
                with mock.patch.object(prepare, "checked", return_value=json.dumps({**value, "securityOpt": security}).encode()):
                    prepare.inspect_container(identifier, name, root, 1, Path("home"))
            for patch in ({"securityOpt": ["no-new-privileges:false"]}, {"securityOpt": ["no-new-privileges:true", "extra"]}, {"securityOpt": []}, {"network": "host"}, {"readOnly": False}, {"mounts": [{"Type": "bind", "Source": str(root), "Destination": str(root), "RW": True}]}):
                with self.subTest(patch=patch), mock.patch.object(prepare, "checked", return_value=json.dumps({**value, **patch}).encode()), self.assertRaises(prepare.Refused):
                    prepare.inspect_container(identifier, name, root, 1, Path("home"))


if __name__ == "__main__":
    unittest.main()
