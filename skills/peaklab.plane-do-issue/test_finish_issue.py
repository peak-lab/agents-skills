import sys
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).parent / "scripts"))
import finish_issue  # noqa: E402


class FinishIssueEvidenceTests(unittest.TestCase):
    def args(self, **overrides):
        values = {
            "merged": False,
            "blocked": False,
            "released": False,
            "issue": "PROJ-7",
            "pr_url": "",
            "release_url": "",
            "version": "",
            "reason": "",
        }
        values.update(overrides)
        return Namespace(**values)

    def test_terminal_transitions_require_evidence_before_loading_credentials(self):
        cases = (
            (self.args(merged=True), "--merged requires --pr-url"),
            (
                self.args(blocked=True, pr_url="https://github.example/pr/7"),
                "--blocked requires --pr-url and --reason",
            ),
            (self.args(released=True), "--released requires --release-url"),
        )

        for args, message in cases:
            with self.subTest(message=message):
                with (
                    patch.object(finish_issue, "parse_args", return_value=args),
                    patch.object(finish_issue, "load_plane_client") as load_client,
                ):
                    with self.assertRaisesRegex(SystemExit, message):
                        finish_issue.main()
                    load_client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
