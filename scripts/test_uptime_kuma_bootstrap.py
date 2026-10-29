"""Exercise the shipped bootstrap without credentials, SSH or Uptime Kuma."""

import contextlib
import io
import os
from pathlib import Path
import re
import shlex
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SKILL = Path(__file__).resolve().parents[1] / "skills/peaklab.uptime-kuma/SKILL.md"


class UptimeKumaBootstrapTests(unittest.TestCase):
    def bootstrap(self, interpreter=None):
        source = re.search(r"<bootstrap>.*?```python\n(.*?)```", SKILL.read_text(), re.S)
        self.assertIsNotNone(source)
        environment = {
            "UPTIME_KUMA_SSH": "monitor@example.test",
            "UPTIME_KUMA_INTERNAL": "http://monitor.example.test",
            "UPTIME_KUMA_USER": "fixture-user",
            "UPTIME_KUMA_PASS": 'fixture-"password',
        }
        if interpreter is not None:
            environment["UPTIME_KUMA_PYTHON"] = interpreter
        namespace = {}
        # Both project and legacy home settings resolve inside the disposable directory.
        with tempfile.TemporaryDirectory() as directory:
            previous = Path.cwd()
            try:
                os.chdir(directory)
                with patch.dict(os.environ, environment, clear=True), patch(
                    "os.path.expanduser", side_effect=lambda value: str(Path(directory) / value.removeprefix("~/"))
                ):
                    exec(source.group(1), namespace)
            finally:
                os.chdir(previous)
        return namespace

    def test_default_interpreter_and_cleanup_are_preserved(self):
        namespace = self.bootstrap()
        with patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0, b"ok", b"")) as run:
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(namespace["run"]("print('fixture')"), 0)
        self.assertEqual(run.call_args.args[0], ["ssh", "monitor@example.test", "python3"])
        payload = run.call_args.kwargs["input"].decode()
        compile(payload, "<remote-fixture>", "exec")
        self.assertIn("finally:\n    api.disconnect()", payload)

    def test_configured_interpreter_is_one_quoted_remote_command(self):
        interpreter = "/opt/monitor's venv/bin/python"
        namespace = self.bootstrap(interpreter)
        with patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0, b"", b"")) as run:
            namespace["run"]("pass")
        command = run.call_args.args[0]
        self.assertEqual(command, ["ssh", "monitor@example.test", shlex.quote(interpreter)])
        self.assertEqual(shlex.split(command[2]), [interpreter])

    def test_remote_failure_is_not_reported_as_success(self):
        namespace = self.bootstrap()
        with patch("subprocess.run", return_value=subprocess.CompletedProcess([], 7, b"", b"fixture failure")):
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaisesRegex(RuntimeError, "exit 7"):
                namespace["run"]("pass")


if __name__ == "__main__":
    unittest.main()
