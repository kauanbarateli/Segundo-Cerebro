"""Pure orchestration controls: no network, browser, subprocess or real extraction."""
import contextlib
import importlib.util
import io
import json
import stat
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("qualified_runtime_prepare", ROOT / "scripts/verification/prepare-qualified-chromium.py")
prepare = importlib.util.module_from_spec(SPEC)
with mock.patch("subprocess.Popen", side_effect=AssertionError("Import must be inert")), mock.patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("Import must be inert")):
    SPEC.loader.exec_module(prepare)


class PrepareTests(unittest.TestCase):
    def fixture(self):
        self.doCleanups()
        root = prepare.ROOT
        helper = SimpleNamespace(PINS={"candidate": prepare.PIN}, OWNED_GROUPS=set(), preflight=mock.Mock(), download=mock.Mock(), extract_checked=mock.Mock(return_value=root / prepare.WORK / "extracted/chrome-linux64/chrome"), command=mock.Mock(return_value=(0, b"Google Chrome for Testing 157.0.8103.6 \n")))
        def digest(path):
            return prepare.HARNESS_SHA if path == root / prepare.HARNESS else prepare.PIN[2] if path.name.endswith(".zip") else prepare.PIN[4]
        helper.digest = mock.Mock(side_effect=digest)
        def lstat(path):
            if path == root / "work":
                return SimpleNamespace(st_mode=stat.S_IFDIR | 0o700)
            return SimpleNamespace(st_mode=stat.S_IFREG | 0o700, st_size=prepare.PIN[1] if path.name.endswith(".zip") else prepare.PIN[3])
        stack = contextlib.ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(mock.patch.object(prepare, "qualification_helpers", return_value=helper))
        stack.enter_context(mock.patch.object(prepare.platform, "machine", return_value="x86_64"))
        stack.enter_context(mock.patch.object(prepare.Path, "cwd", return_value=root))
        stack.enter_context(mock.patch.object(prepare.Path, "resolve", autospec=True, side_effect=lambda path, strict=False: path))
        stack.enter_context(mock.patch.object(prepare.Path, "exists", return_value=True))
        stack.enter_context(mock.patch.object(prepare.Path, "lstat", autospec=True, side_effect=lstat))
        mkdir = stack.enter_context(mock.patch.object(prepare.Path, "mkdir"))
        stack.enter_context(mock.patch.object(prepare.Path, "rename"))
        stack.enter_context(mock.patch.object(prepare.Path, "rmdir"))
        stack.enter_context(mock.patch.object(prepare.Path, "read_text", return_value='{"version":"1.63.0"}'))
        return root, helper, mkdir

    def test_exact_measured_record_and_bounded_original_version_command(self):
        root, helper, mkdir = self.fixture()
        record = prepare.prepare(root)
        self.assertEqual(len(record), 14)
        self.assertEqual(record["status"], "BOUND")
        self.assertFalse(record["applicationAccepted"])
        self.assertEqual(record["qualificationRun"], 39221217191)
        self.assertEqual(record["executableBytes"], 305061192)
        self.assertEqual(record["archiveBytes"], 202676171)
        helper.preflight.assert_called_once_with(root, installed=True)
        helper.download.assert_called_once_with(root / prepare.WORK / "chrome-linux64.zip", prepare.PIN)
        helper.extract_checked.assert_called_once_with(root / prepare.WORK / "chrome-linux64.zip", root / prepare.WORK / "extracted", prepare.PIN[2], prepare.PIN[4], prepare.PIN[3])
        args, kwargs = helper.command.call_args
        self.assertEqual(args[0], [str(root / prepare.WORK / "chrome-linux64/chrome"), "--version"])
        self.assertEqual(args[2], root / prepare.WORK / "version-home")
        self.assertEqual(kwargs, {"timeout": 5})
        self.assertTrue(all(call.kwargs == {"mode": 0o700} for call in mkdir.call_args_list))

    def test_wrong_root_architecture_and_pin_refuse_before_download(self):
        for variant in ("root", "arch", "pin", "harness", "group"):
            with self.subTest(variant=variant):
                root, helper, _ = self.fixture()
                if variant == "arch": prepare.platform.machine.return_value = "arm64"
                if variant == "pin": helper.PINS["candidate"] = ("foreign",)
                if variant == "harness": helper.digest.side_effect = lambda path: "0" * 64
                if variant == "group": helper.OWNED_GROUPS.add(123)
                with self.assertRaises(prepare.RuntimeRefused):
                    prepare.prepare(root / "other" if variant == "root" else root)
                helper.download.assert_not_called()

    def test_existing_destination_refuses_without_reuse_or_overwrite(self):
        root, helper, mkdir = self.fixture()
        mkdir.side_effect = FileExistsError("private-path-must-not-leak")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = prepare.main(["prepare"])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(output.getvalue())["code"], "PREPARATION_REFUSED")
        self.assertNotIn("private-path", output.getvalue())
        helper.download.assert_not_called()

    def test_version_exit_stdout_and_remaining_process_are_not_accepted(self):
        for value in ((1, b"Google Chrome for Testing 157.0.8103.6\n"), (0, b"Google Chrome for Testing 153.0.8010.12\n"), (0, b"157.0.8103.6"), (0, b"Google Chrome for Testing 157.0.8103.6\nprivate-output")):
            with self.subTest(value=value):
                root, helper, _ = self.fixture()
                helper.command.return_value = value
                with self.assertRaisesRegex(prepare.RuntimeRefused, "^VERSION_REFUSED$"):
                    prepare.prepare(root)
        root, helper, _ = self.fixture()
        helper.command.side_effect = lambda *args, **kwargs: (helper.OWNED_GROUPS.add(123) or (0, b"Google Chrome for Testing 157.0.8103.6\n"))
        with self.assertRaisesRegex(prepare.RuntimeRefused, "^PROCESS_GROUP_UNCONFIRMED$"):
            prepare.prepare(root)

    def test_post_command_file_change_and_sdk_mismatch_are_refused(self):
        root, helper, _ = self.fixture()
        helper.digest.side_effect = [prepare.HARNESS_SHA, "0" * 64, prepare.PIN[4]]
        with self.assertRaisesRegex(prepare.RuntimeRefused, "^BINDING_REFUSED$"):
            prepare.prepare(root)
        root, _, _ = self.fixture()
        prepare.Path.read_text.return_value = '{"version":"1.64.1"}'
        with self.assertRaisesRegex(prepare.RuntimeRefused, "^SDK_REFUSED$"):
            prepare.prepare(root)

    def test_cli_rejects_all_options_without_loading_helpers_and_sanitizes_errors(self):
        with mock.patch.object(prepare, "qualification_helpers", side_effect=AssertionError("Do not load")) as loader:
            for argv in ([], ["prepare", "--path", "private"], ["/tmp/browser"], ["run"]):
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    self.assertEqual(prepare.main(argv), 1)
                self.assertEqual(json.loads(output.getvalue())["code"], "ARGUMENTS_REFUSED")
            loader.assert_not_called()


if __name__ == "__main__":
    unittest.main()
