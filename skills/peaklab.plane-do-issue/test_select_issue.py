import sys
import subprocess
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
                    return_value=Namespace(
                        issue="PUSHR-1171",
                        auto=True,
                        tdd=None,
                        merge="no-merge",
                        no_subagent=False,
                    ),
                ),
                patch.object(select_issue, "load_plane_client", side_effect=load_client),
            ):
                with self.assertRaisesRegex(RuntimeError, "stop before network"):
                    select_issue.main()

    def test_next_fetches_todo_issues_once(self):
        issues = [
            {
                "id": "free",
                "state": "todo",
                "priority": "urgent",
                "assignees": [],
                "name": "Free",
            },
            {
                "id": "other",
                "state": "todo",
                "priority": "low",
                "assignees": ["other"],
                "name": "Other",
            },
        ]
        context = {"project_path": "/project", "todo_ids": ["todo"], "me_id": "me"}

        class Client:
            def __init__(self):
                self.requests = []

            def request(self, method, path):
                self.requests.append((method, path))
                return {"results": issues, "next_page_results": False}

        client = Client()
        issue, selection = select_issue.issue_from_arg(client, context, "next")

        self.assertEqual(issue["id"], "free")
        self.assertEqual(selection, "globale")
        self.assertEqual(len(client.requests), 1)

    def test_negative_and_merge_flags_are_explicit_state(self):
        with patch.object(
            sys,
            "argv",
            ["select_issue.py", "PUSHR-7", "--no-auto", "--no-tdd", "--wait-merge"],
        ):
            args = select_issue.parse_args()

        self.assertFalse(args.auto)
        self.assertFalse(args.tdd)
        self.assertEqual(args.merge, "wait-merge")

    def test_default_tdd_mode_is_adaptive(self):
        with patch.object(sys, "argv", ["select_issue.py", "PUSHR-7", "--no-subagent"]):
            args = select_issue.parse_args()

        self.assertIsNone(args.tdd)
        self.assertTrue(args.no_subagent)


class WorktreeContextTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        base = Path(self.temp_dir.name)
        self.primary = base / "primary"
        self.linked = base / "linked"
        self.primary.mkdir()
        self.git(self.primary, "init", "-b", "main")
        self.git(self.primary, "config", "user.email", "test@example.com")
        self.git(self.primary, "config", "user.name", "Test")
        (self.primary / "tracked.txt").write_text("initial\n")
        self.git(self.primary, "add", "tracked.txt")
        self.git(self.primary, "commit", "-m", "initial")
        self.git(self.primary, "update-ref", "refs/remotes/origin/main", "HEAD")
        self.git(
            self.primary,
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/remotes/origin/main",
        )
        self.git(self.primary, "worktree", "add", "-b", "feature/test", str(self.linked))

    def tearDown(self):
        self.temp_dir.cleanup()

    def git(self, cwd: Path, *args: str) -> None:
        subprocess.run(
            ["git", *args],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )

    def test_detects_clean_linked_worktree_and_primary_task_root(self):
        nested = self.linked / "src" / "nested"
        nested.mkdir(parents=True)

        task_root, execution_root, branch, is_linked, error = select_issue.worktree_context(nested)

        self.assertEqual(task_root, self.primary.resolve())
        self.assertEqual(execution_root, self.linked.resolve())
        self.assertEqual(branch, "feature/test")
        self.assertTrue(is_linked)
        self.assertIsNone(error)

    def test_nested_primary_directory_is_not_a_linked_worktree(self):
        nested = self.primary / "src" / "nested"
        nested.mkdir(parents=True)

        task_root, execution_root, branch, is_linked, error = select_issue.worktree_context(nested)

        self.assertEqual(task_root, self.primary.resolve())
        self.assertEqual(execution_root, self.primary.resolve())
        self.assertIsNone(branch)
        self.assertFalse(is_linked)
        self.assertIsNone(error)

    def test_rejects_dirty_linked_worktree(self):
        (self.linked / "tracked.txt").write_text("dirty\n")

        _, _, branch, is_linked, error = select_issue.worktree_context(self.linked)

        self.assertIsNone(branch)
        self.assertTrue(is_linked)
        self.assertIn("modifications", error)

    def test_rejects_detached_linked_worktree(self):
        detached = Path(self.temp_dir.name) / "detached"
        self.git(self.primary, "worktree", "add", "--detach", str(detached), "HEAD")

        _, _, branch, is_linked, error = select_issue.worktree_context(detached)

        self.assertIsNone(branch)
        self.assertTrue(is_linked)
        self.assertIn("détaché", error)

    def test_rejects_base_branch_in_linked_worktree(self):
        base_worktree = Path(self.temp_dir.name) / "base"
        self.git(self.primary, "switch", "--detach")
        self.git(self.primary, "branch", "release/main")
        self.git(
            self.primary,
            "update-ref",
            "refs/remotes/origin/release/main",
            "release/main",
        )
        self.git(
            self.primary,
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/remotes/origin/release/main",
        )
        self.git(self.primary, "worktree", "add", str(base_worktree), "release/main")

        _, _, branch, is_linked, error = select_issue.worktree_context(base_worktree)

        self.assertIsNone(branch)
        self.assertTrue(is_linked)
        self.assertIn("branche de base", error)


if __name__ == "__main__":
    unittest.main()
