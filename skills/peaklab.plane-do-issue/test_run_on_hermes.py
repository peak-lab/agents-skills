import subprocess
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent / "scripts"))
import run_on_hermes


class HermesRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        base = Path(self.temp_dir.name)
        self.primary = base / "primary"
        self.linked = base / "linked"
        self.primary.mkdir()
        self.git(self.primary, "init", "-b", "main")
        self.git(self.primary, "config", "user.email", "test@example.com")
        self.git(self.primary, "config", "user.name", "Test")
        (self.primary / "tracked.txt").write_text("initial\n", encoding="utf-8")
        self.git(self.primary, "add", "tracked.txt")
        self.git(self.primary, "commit", "-m", "initial")
        self.git(self.primary, "update-ref", "refs/remotes/origin/main", "HEAD")
        self.git(
            self.primary,
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/remotes/origin/main",
        )
        self.git(
            self.primary,
            "worktree",
            "add",
            "-b",
            "fix/PROJ-7-example",
            str(self.linked),
        )

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

    def test_primary_checkout_is_rejected_before_selector_mutation(self):
        with self.assertRaisesRegex(RuntimeError, "primary checkout"):
            run_on_hermes.require_linked_issue_worktree(self.primary, "PROJ-7")

    def test_isolation_validation_happens_before_selector_mutation(self):
        args = Namespace(issue="PROJ-7", no_merge=True, dry_run=False, preflight=False)

        with (
            patch.object(run_on_hermes, "parse_args", return_value=args),
            patch.dict(
                run_on_hermes.os.environ,
                {run_on_hermes.RUNTIME_ENV: run_on_hermes.RUNTIME_NAME},
                clear=True,
            ),
            patch.object(run_on_hermes, "load_runtime_env", return_value={}),
            patch.object(
                run_on_hermes,
                "require_linked_issue_worktree",
                side_effect=RuntimeError("unsafe checkout"),
            ),
            patch.object(run_on_hermes, "selector") as selector,
            self.assertRaises(RuntimeError),
        ):
            run_on_hermes.main()

        selector.assert_not_called()

    def test_accepts_linked_worktree_for_matching_issue_branch(self):
        worktree = run_on_hermes.require_linked_issue_worktree(
            self.linked, "PROJ-7"
        )

        self.assertEqual(worktree, self.linked.resolve())

    def test_rejects_linked_worktree_owned_by_another_issue(self):
        with self.assertRaises(RuntimeError):
            run_on_hermes.require_linked_issue_worktree(self.linked, "PROJ-8")

    def test_rejects_dirty_linked_worktree(self):
        (self.linked / "untracked.txt").write_text("dirty\n", encoding="utf-8")

        with self.assertRaisesRegex(RuntimeError, "clean linked worktree"):
            run_on_hermes.require_linked_issue_worktree(self.linked, "PROJ-7")

    def test_rejects_detached_linked_worktree(self):
        self.git(self.linked, "checkout", "--detach")

        with self.assertRaisesRegex(RuntimeError, "valid linked Git worktree"):
            run_on_hermes.require_linked_issue_worktree(self.linked, "PROJ-7")

    def test_rejects_linked_worktree_on_base_branch(self):
        self.git(self.primary, "worktree", "remove", str(self.linked))
        self.git(self.primary, "checkout", "-b", "holding")
        self.git(self.primary, "worktree", "add", str(self.linked), "main")

        with self.assertRaisesRegex(RuntimeError, "base branch"):
            run_on_hermes.require_linked_issue_worktree(self.linked, "PROJ-7")

    def test_next_is_rejected_before_selection(self):
        args = Namespace(issue="next", no_merge=True, dry_run=False, preflight=False)
        with (
            patch.object(run_on_hermes, "parse_args", return_value=args),
            patch.object(run_on_hermes, "selector") as selector,
            self.assertRaisesRegex(SystemExit, "requires an explicit PREFIX-N issue"),
        ):
            run_on_hermes.main()
        selector.assert_not_called()

    def test_runtime_requires_explicit_opt_in(self):
        with self.assertRaisesRegex(RuntimeError, "explicit headless opt-in required"):
            run_on_hermes.load_runtime_env({})

    def test_main_rejects_unconfigured_runtime_before_selecting_issue(self):
        args = Namespace(issue="PROJ-7", no_merge=True, dry_run=False, preflight=False)

        with (
            patch.object(run_on_hermes, "parse_args", return_value=args),
            patch.dict(run_on_hermes.os.environ, {}, clear=True),
            patch.object(run_on_hermes, "selector") as selector,
            self.assertRaisesRegex(RuntimeError, "explicit headless opt-in required"),
        ):
            run_on_hermes.main()

        selector.assert_not_called()

    def test_runtime_uses_configured_environment_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            build_env = Path(temp_dir) / "build.env"
            glitchtip_env = Path(temp_dir) / "glitchtip.env"
            build_env.write_text("BUILD_TOKEN=build-value\n", encoding="utf-8")
            glitchtip_env.write_text("GLITCHTIP_TOKEN=glitch-value\n", encoding="utf-8")

            env = run_on_hermes.load_runtime_env(
                {
                    run_on_hermes.RUNTIME_ENV: run_on_hermes.RUNTIME_NAME,
                    run_on_hermes.BUILD_ENV_PATH_ENV: str(build_env),
                    run_on_hermes.GLITCHTIP_ENV_PATH_ENV: str(glitchtip_env),
                }
            )

        self.assertEqual(env["BUILD_TOKEN"], "build-value")
        self.assertEqual(env["GLITCHTIP_TOKEN"], "glitch-value")

    def test_candidate_reports_unreviewed_pr_handoff(self):
        issue = {
            "prefix": "PROJ",
            "sequence_id": 7,
            "branch": "fix/PROJ-7-example",
            "title": "Fix example",
            "description": "Example",
            "task_dir": "/tmp/plane-task",
        }
        completed = subprocess.CompletedProcess(args=[], returncode=0)

        with (
            patch.object(run_on_hermes, "load_runtime_env", return_value={}),
            patch.object(run_on_hermes, "ensure_dependencies"),
            patch.object(
                run_on_hermes.subprocess, "run", return_value=completed
            ) as run,
        ):
            result = run_on_hermes.run_candidate(
                issue, Path("/tmp/worktree"), escalation=False
            )

        prompt = run.call_args.args[0][2]
        self.assertEqual(result, 0)
        self.assertIn("status: pr_created_unreviewed", prompt)
        self.assertIn("interactive parent review required", prompt)
        self.assertIn("Do not invoke the plane-do-issue skill again", prompt)
        self.assertIn("do not merge it", prompt)

    def test_invalid_environment_entry_does_not_expose_its_value(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            env_file = Path(temp_dir) / "build.env"
            env_file.write_text("invalid-key=private-value\n", encoding="utf-8")
            with self.assertRaises(RuntimeError) as raised:
                run_on_hermes.load_env_file({}, env_file, required=True)

        self.assertIn("line 1", str(raised.exception))
        self.assertNotIn("private-value", str(raised.exception))
        self.assertNotIn("invalid-key", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
