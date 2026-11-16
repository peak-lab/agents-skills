from __future__ import annotations

import datetime as dt
import importlib.util
import io
import json
import pathlib
import unittest

SPEC = importlib.util.spec_from_file_location("gh_wait", pathlib.Path(__file__).with_name("gh_wait.py"))
gh_wait = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gh_wait)

NOW = dt.datetime(2026, 11, 15, 12, 0, tzinfo=dt.timezone.utc)


class FakeGh:
    def __init__(self, routes: list[tuple[tuple[str, ...], list]]) -> None:
        self.routes = routes
        self.calls: list[list[str]] = []

    def __call__(self, args: list[str]) -> str:
        self.calls.append(args)
        for prefix, answers in self.routes:
            if tuple(args[: len(prefix)]) == prefix:
                answer = answers.pop(0) if len(answers) > 1 else answers[0]
                if isinstance(answer, Exception):
                    raise answer
                return answer if isinstance(answer, str) else json.dumps(answer)
        raise AssertionError(f"unexpected gh call {args}")


class Clock:
    def __init__(self) -> None:
        self.t = 0.0

    def sleep(self, seconds: float) -> None:
        self.t += seconds

    def __call__(self) -> float:
        return self.t


def waiter(fake: FakeGh) -> tuple[gh_wait.Waiter, io.StringIO]:
    clock, out = Clock(), io.StringIO()
    w = gh_wait.Waiter(run=fake, sleep=clock.sleep, clock=clock, now=lambda: NOW, out=out, interval=20,
                       aggregators=frozenset({"CI gate"}))
    return w, out


def run_payload(status: str, conclusion: str = "", jobs: list | None = None) -> dict:
    return {
        "status": status, "conclusion": conclusion, "url": "https://x/runs/9", "workflowName": "Release",
        "headSha": "abc", "headBranch": "main", "event": "workflow_dispatch", "jobs": jobs or [],
    }


class WaitRunTest(unittest.TestCase):
    def test_success_after_polling(self) -> None:
        fake = FakeGh([(("run", "view", "9"), [run_payload("in_progress"), run_payload("completed", "success")])])
        w, _ = waiter(fake)
        code, verdict = w.wait_run(9, 600)
        self.assertEqual(code, gh_wait.OK)
        self.assertEqual(verdict["conclusion"], "success")

    def test_failure_prints_only_failed_job_log_tail(self) -> None:
        jobs = [
            {"databaseId": 1, "name": "build", "status": "completed", "conclusion": "success"},
            {"databaseId": 2, "name": "smoke", "status": "completed", "conclusion": "failure", "url": "u"},
        ]
        log = "smoke\tRun curl\t2026-11-15T12:00:00.1234567Z curl: (22) 502\n"
        fake = FakeGh([
            (("run", "view", "9", "--job", "2"), [log]),
            (("run", "view", "9"), [run_payload("completed", "failure", jobs)]),
        ])
        w, out = waiter(fake)
        code, verdict = w.wait_run(9, 600)
        self.assertEqual(code, gh_wait.FAILED)
        self.assertEqual([j["name"] for j in verdict["failed_jobs"]], ["smoke"])
        self.assertIn("curl: (22) 502", out.getvalue())
        self.assertNotIn("2026-11-15T12:00:00", out.getvalue())
        self.assertEqual(verdict["rerun"], "gh run rerun 9 --failed")

    def test_timeout(self) -> None:
        fake = FakeGh([(("run", "view", "9"), [run_payload("queued")])])
        w, _ = waiter(fake)
        code, verdict = w.wait_run(9, 60)
        self.assertEqual(code, gh_wait.TIMEOUT)
        self.assertEqual(verdict["result"], "timeout")


class DispatchTest(unittest.TestCase):
    def test_resolves_the_run_created_after_dispatch(self) -> None:
        old = {"databaseId": 1, "createdAt": "2026-11-15T11:00:00Z", "url": "old", "headSha": "a"}
        mine = {"databaseId": 2, "createdAt": "2026-11-15T12:00:03Z", "url": "new", "headSha": "b"}
        fake = FakeGh([
            (("workflow", "run"), [""]),
            (("run", "list"), [[old], [mine, old]]),
            (("run", "view", "2"), [run_payload("completed", "success")]),
        ])
        w, _ = waiter(fake)
        code, verdict = w.dispatch("release.yml", "main", ["bump=patch", "dry_run=true"], 600, False)
        self.assertEqual(code, gh_wait.OK)
        self.assertEqual(verdict["run_id"], 2)
        self.assertIn(["-f", "bump=patch"], [fake.calls[0][i : i + 2] for i in range(len(fake.calls[0]))])

    def test_not_found(self) -> None:
        fake = FakeGh([(("workflow", "run"), [""]), (("run", "list"), [[]])])
        w, _ = waiter(fake)
        code, _ = w.dispatch("release.yml", "main", [], 600, False)
        self.assertEqual(code, gh_wait.NOT_FOUND)


class PrTest(unittest.TestCase):
    def check(self, name: str, bucket: str, link: str = "") -> dict:
        return {"name": name, "state": bucket.upper(), "bucket": bucket, "link": link, "workflow": "CI"}

    def test_failed_check_logs_resolved_from_link(self) -> None:
        link = "https://github.com/o/r/actions/runs/77/job/88"
        fake = FakeGh([
            (("pr", "checks"), [[self.check("a", "pending")], [self.check("a", "fail", link), self.check("b", "pass")]]),
            (("run", "view", "77", "--job", "88"), ["a\tstep\t2026-11-15T12:00:00Z boom\n"]),
        ])
        w, out = waiter(fake)
        code, verdict = w.pr("12", "o/r", False, None, 600)
        self.assertEqual(code, gh_wait.FAILED)
        self.assertEqual(verdict["failed_checks"][0]["name"], "a")
        self.assertIn("boom", out.getvalue())

    def test_waits_while_checks_are_not_registered_yet(self) -> None:
        fake = FakeGh([
            (("pr", "checks"), [RuntimeError("gh pr checks: no checks reported on the 'x' branch"),
                                [self.check("a", "pass")]]),
        ])
        w, _ = waiter(fake)
        code, verdict = w.pr("12", "o/r", False, None, 600)
        self.assertEqual(code, gh_wait.OK)
        self.assertEqual(verdict["checks"], 1)

    def queue(self, state: str, queued: bool, auto: bool = True) -> dict:
        pr = {"state": state, "isInMergeQueue": queued, "headRefOid": "h",
              "autoMergeRequest": {"enabledAt": "t"} if auto else None, "mergeQueueEntry": None}
        return {"data": {"repository": {"pullRequest": pr}}}

    def test_enqueue_waits_until_merged(self) -> None:
        fake = FakeGh([
            (("pr", "merge"), [""]),
            (("pr", "checks"), [[self.check("a", "pass")]]),
            (("api", "graphql"), [self.queue("OPEN", False), self.queue("OPEN", True), self.queue("MERGED", False)]),
        ])
        w, _ = waiter(fake)
        code, verdict = w.pr("12", "o/r", True, "h", 3600)
        self.assertEqual(code, gh_wait.OK)
        self.assertEqual(verdict["result"], "merged")
        self.assertEqual(fake.calls[0], ["pr", "merge", "12", "--auto", "--squash", "--match-head-commit", "h"])

    def test_dequeued_reports_merge_group_failure(self) -> None:
        jobs = [{"databaseId": 5, "name": "CI gate", "status": "completed", "conclusion": "failure", "url": "u"}]
        fake = FakeGh([
            (("pr", "merge"), [""]),
            (("pr", "checks"), [[self.check("a", "pass")]]),
            (("api", "graphql"), [self.queue("OPEN", True), self.queue("OPEN", False, auto=False)]),
            (("run", "list"), [[{"databaseId": 31, "headBranch": "gh-readonly-queue/main/pr-12-abc",
                                 "conclusion": "failure", "status": "completed", "url": "u"}]]),
            (("run", "view", "31", "--job"), ["x\ty\t2026-11-15T12:00:00Z gate red\n"]),
            (("run", "view", "31"), [run_payload("completed", "failure", jobs)]),
        ])
        w, out = waiter(fake)
        code, verdict = w.pr("12", "o/r", True, None, 3600)
        self.assertEqual(code, gh_wait.FAILED)
        self.assertEqual(verdict["result"], "dequeued")
        self.assertEqual(verdict["merge_group"]["run_id"], 31)
        self.assertIn("gate red", out.getvalue())


class UsefulTailTest(unittest.TestCase):
    def test_strips_prefix_colour_passed_tests_and_cleanup(self) -> None:
        raw = "\n".join([
            "job\tstep\t\ufeff2026-11-15T12:00:00.1Z ##[group]Run tests",
            "job\tstep\t2026-11-15T12:00:01.1Z  ^[[32m\u2713^[[39m a.test.ts",
            "job\tstep\t2026-11-15T12:00:02.1Z \x1b[41m FAIL \x1b[49m b.test.ts",
            "job\tUNKNOWN STEP\tError: boom",
            "job\tstep\t2026-11-15T12:00:03.1Z Post job cleanup.",
            "job\tstep\t2026-11-15T12:00:04.1Z container noise",
        ])
        self.assertEqual(gh_wait.useful_tail(raw, 40), [" FAIL  b.test.ts", "Error: boom"])


class MainTest(unittest.TestCase):
    def test_last_line_is_json_verdict(self) -> None:
        fake = FakeGh([(("run", "view", "9"), [run_payload("completed", "success")])])
        w, out = waiter(fake)
        code = gh_wait.main(["run", "9"], waiter=w)
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out.getvalue().strip().splitlines()[-1])["result"], "success")


if __name__ == "__main__":
    unittest.main()
