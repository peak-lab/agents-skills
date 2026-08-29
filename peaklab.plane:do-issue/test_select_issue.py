import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).parent / "scripts"))
import select_issue  # noqa: E402


class SelectIssueStateTests(unittest.TestCase):
    def test_clears_stale_state_before_loading_plane_client(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            state_file = Path(temp_dir) / "plane-do-issue-state.json"
            state_file.write_text('{"sequence_id": 1169}')

            def load_client():
                self.assertFalse(state_file.exists())
                raise RuntimeError("stop before network")

            with (
                patch.object(select_issue, "STATE_FILE", state_file),
                patch.object(
                    select_issue,
                    "parse_args",
                    return_value=Namespace(issue="PUSHR-1171", auto=True),
                ),
                patch.object(select_issue, "load_plane_client", side_effect=load_client),
            ):
                with self.assertRaisesRegex(RuntimeError, "stop before network"):
                    select_issue.main()


if __name__ == "__main__":
    unittest.main()
