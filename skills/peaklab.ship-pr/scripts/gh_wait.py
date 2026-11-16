#!/usr/bin/env python3
"""Block on a GitHub Actions run, a workflow dispatch, a tag deploy or a pull request.

One call replaces the `gh run list` / `gh run view` / `gh pr checks` polling an agent otherwise
repeats: it resolves the run, waits in place, and on failure prints only the failed jobs and the
tail of their failed-step logs.

    gh_wait.py run 123456789
    gh_wait.py dispatch release.yml --ref main -f bump=patch -f dry_run=true
    gh_wait.py deploy-for-tag v1.42.0
    gh_wait.py pr 123 [--enqueue --head <sha> --strategy squash]

The last stdout line is a JSON verdict. Exit codes: 0 success, 1 failure, 2 timeout, 3 not found.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import time
from collections.abc import Callable
from typing import Any

OK, FAILED, TIMEOUT, NOT_FOUND = 0, 1, 2, 3
FAILED_CONCLUSIONS = {"failure", "cancelled", "timed_out", "startup_failure", "action_required"}
JOB_URL = re.compile(r"/actions/runs/(\d+)/job/(\d+)")
LOG_PREFIX = re.compile(r"^[^\t]*\t[^\t]*\t(?:\ufeff?\d{4}-\d\d-\d\dT[\d:.]+Z ?)?")
ANSI = re.compile(r"(?:\x1b|\^\[)\[[0-9;]*m")

Runner = Callable[[list[str]], str]


def gh(args: list[str]) -> str:
    done = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)}: {done.stderr.strip()}")
    return done.stdout


class Waiter:
    def __init__(
        self,
        run: Runner = gh,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        now: Callable[[], dt.datetime] = lambda: dt.datetime.now(dt.timezone.utc),
        out: Any = sys.stdout,
        interval: float = 20,
        log_lines: int = 40,
        aggregators: frozenset[str] = frozenset(),
        strategy: str = "squash",
    ) -> None:
        self.gh, self.sleep, self.clock, self.now, self.out = run, sleep, clock, now, out
        self.interval, self.log_lines = interval, log_lines
        self.aggregators, self.strategy = aggregators, strategy

    def say(self, line: str) -> None:
        print(line, file=self.out, flush=True)

    def json(self, args: list[str]) -> Any:
        return json.loads(self.gh(args) or "null")

    def poll(self, fetch: Callable[[], Any], timeout: float) -> Any:
        deadline = self.clock() + timeout
        while True:
            value = fetch()
            if value is not None:
                return value
            if self.clock() >= deadline:
                return None
            self.sleep(self.interval)

    def failed_logs(self, run_id: int | str, jobs: list[dict]) -> list[dict]:
        failed = [j for j in jobs if j.get("conclusion") in FAILED_CONCLUSIONS]
        real = [j for j in failed if j.get("name") not in self.aggregators]
        for job in real or failed:
            self.say(f"--- FAILED {job.get('name')} ({job.get('conclusion')}) {job.get('url', '')}")
            try:
                raw = self.gh(["run", "view", str(run_id), "--job", str(job["databaseId"]), "--log-failed"])
            except RuntimeError as error:
                self.say(f"(log unavailable: {error})")
                continue
            for line in useful_tail(raw, self.log_lines):
                self.say(line)
        return [{"name": j.get("name"), "conclusion": j.get("conclusion"), "url": j.get("url")} for j in failed]

    def wait_run(self, run_id: int | str, timeout: float) -> tuple[int, dict]:
        fields = "status,conclusion,url,workflowName,headSha,headBranch,event,jobs"
        seen = {"progress": None}

        def fetch() -> dict | None:
            run = self.json(["run", "view", str(run_id), "--json", fields])
            jobs = run.get("jobs") or []
            progress = (run["status"], sum(1 for j in jobs if j.get("status") == "completed"), len(jobs))
            if progress != seen["progress"]:
                seen["progress"] = progress
                self.say(f"run {run_id} {run.get('workflowName')}: {progress[0]} ({progress[1]}/{progress[2]} jobs)")
            return run if run["status"] == "completed" else None

        run = self.poll(fetch, timeout)
        if run is None:
            return TIMEOUT, {"result": "timeout", "run_id": int(run_id)}
        verdict = {
            "result": "success" if run["conclusion"] in ("success", "skipped", "neutral") else "failure",
            "run_id": int(run_id),
            "workflow": run.get("workflowName"),
            "conclusion": run["conclusion"],
            "head_sha": run.get("headSha"),
            "url": run.get("url"),
        }
        if verdict["result"] == "failure":
            verdict["failed_jobs"] = self.failed_logs(run_id, run.get("jobs") or [])
            verdict["rerun"] = f"gh run rerun {run_id} --failed"
            return FAILED, verdict
        return OK, verdict

    def find_run(self, workflow: str, event: str, branch: str, since: dt.datetime, timeout: float) -> dict | None:
        def fetch() -> dict | None:
            rows = self.json([
                "run", "list", "--workflow", workflow, "--event", event, "--branch", branch,
                "--limit", "20", "--json", "databaseId,createdAt,url,headSha",
            ]) or []
            fresh = [r for r in rows if parse_time(r["createdAt"]) >= since]
            return min(fresh, key=lambda r: r["createdAt"]) if fresh else None

        return self.poll(fetch, timeout)

    def dispatch(self, workflow: str, ref: str, fields: list[str], timeout: float, no_wait: bool) -> tuple[int, dict]:
        since = self.now() - dt.timedelta(seconds=5)
        args = ["workflow", "run", workflow, "--ref", ref]
        for field in fields:
            args += ["-f", field]
        self.gh(args)
        run = self.find_run(workflow, "workflow_dispatch", ref, since, 300)
        if run is None:
            return NOT_FOUND, {"result": "not_found", "workflow": workflow, "ref": ref}
        self.say(f"dispatched {workflow} -> run {run['databaseId']} {run['url']}")
        if no_wait:
            return OK, {"result": "dispatched", "run_id": run["databaseId"], "url": run["url"]}
        return self.wait_run(run["databaseId"], timeout)

    def deploy_for_tag(self, tag: str, workflow: str, timeout: float) -> tuple[int, dict]:
        epoch = dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc)
        run = self.find_run(workflow, "push", tag, epoch, 600)
        if run is None:
            return NOT_FOUND, {"result": "not_found", "workflow": workflow, "tag": tag}
        self.say(f"{workflow} for {tag} -> run {run['databaseId']} {run['url']}")
        return self.wait_run(run["databaseId"], timeout)

    def wait_checks(self, pr: str, timeout: float) -> tuple[int, dict]:
        def fetch() -> list | None:
            try:
                checks = self.json(["pr", "checks", pr, "--json", "name,state,bucket,link,workflow"]) or []
            except RuntimeError as error:
                if "no checks reported" not in str(error):
                    raise
                checks = []
            pending = [c for c in checks if c["bucket"] == "pending"]
            if checks and not pending:
                return checks
            self.say(f"pr {pr}: {len(pending)} pending / {len(checks)} checks")
            return None

        checks = self.poll(fetch, timeout)
        if checks is None:
            return TIMEOUT, {"result": "timeout", "pr": int(pr)}
        failed = [c for c in checks if c["bucket"] in ("fail", "cancel")]
        if not failed:
            return OK, {"result": "success", "pr": int(pr), "checks": len(checks)}
        verdict: dict = {"result": "failure", "pr": int(pr), "failed_checks": []}
        for check in failed:
            match = JOB_URL.search(check.get("link") or "")
            verdict["failed_checks"].append({"name": check["name"], "link": check.get("link")})
            if match:
                run_id, job_id = match.groups()
                self.failed_logs(run_id, [{
                    "databaseId": job_id, "name": check["name"], "conclusion": "failure", "url": check.get("link"),
                }])
        return FAILED, verdict

    def queue_state(self, repo: str, pr: str) -> dict:
        owner, name = repo.split("/", 1)
        query = (
            "query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n)"
            "{state isInMergeQueue headRefOid autoMergeRequest{enabledAt} mergeQueueEntry{state position}}}}"
        )
        data = self.json(["api", "graphql", "-f", f"query={query}", "-f", f"o={owner}", "-f", f"r={name}", "-F", f"n={pr}"])
        return data["data"]["repository"]["pullRequest"]

    def merge_group_failure(self, pr: str) -> dict | None:
        rows = self.json([
            "run", "list", "--event", "merge_group", "--limit", "30",
            "--json", "databaseId,headBranch,conclusion,status,url",
        ]) or []
        mine = [r for r in rows if f"/pr-{pr}-" in (r.get("headBranch") or "") and r.get("status") == "completed"]
        failed = [r for r in mine if r.get("conclusion") in FAILED_CONCLUSIONS]
        return failed[0] if failed else None

    def pr(self, pr: str, repo: str, enqueue: bool, head: str | None, timeout: float) -> tuple[int, dict]:
        start = self.clock()
        if enqueue:
            args = ["pr", "merge", pr, "--auto", f"--{self.strategy}"]
            if head:
                args += ["--match-head-commit", head]
            self.gh(args)
            self.say(f"pr {pr}: auto-merge enabled, GitHub enqueues once checks pass")
        code, verdict = self.wait_checks(pr, timeout)
        if code != OK or not enqueue:
            return code, verdict
        last = {"state": None}

        def fetch() -> dict | None:
            state = self.queue_state(repo, pr)
            entry = state.get("mergeQueueEntry") or {}
            label = (state["state"], state["isInMergeQueue"], entry.get("state"), entry.get("position"))
            if label != last["state"]:
                last["state"] = label
                self.say(f"pr {pr}: {state['state']} in_queue={state['isInMergeQueue']} entry={entry or '-'}")
            if state["state"] in ("MERGED", "CLOSED"):
                return state
            if not state["isInMergeQueue"] and (last.get("was_queued") or not state.get("autoMergeRequest")):
                return state
            last["was_queued"] = last.get("was_queued") or state["isInMergeQueue"]
            return None

        remaining = max(60.0, timeout - (self.clock() - start))
        state = self.poll(fetch, remaining)
        if state is None:
            return TIMEOUT, {
                "result": "queue_timeout", "pr": int(pr),
                "hint": "no merge_group run for 20 min usually means GitHub lost the event: dequeue and re-enqueue",
            }
        if state["state"] == "MERGED":
            return OK, {"result": "merged", "pr": int(pr)}
        verdict = {"result": "dequeued", "pr": int(pr), "state": state["state"]}
        run = self.merge_group_failure(pr)
        if run:
            code, run_verdict = self.wait_run(run["databaseId"], 60)
            verdict["merge_group"] = run_verdict
        return FAILED, verdict


def useful_tail(raw: str, limit: int) -> list[str]:
    lines: list[str] = []
    for line in raw.splitlines():
        line = ANSI.sub("", LOG_PREFIX.sub("", line)).rstrip()
        if line.startswith(("Post job cleanup", "Stop and remove container")):
            break
        if line.strip() and not line.startswith(("##[group]", "##[endgroup]")) and "✓" not in line:
            lines.append(line)
    return lines[-limit:]


def parse_time(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def current_repo(run: Runner) -> str:
    return run(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).strip()


def main(argv: list[str] | None = None, waiter: Waiter | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--timeout", type=float, default=3600, help="seconds (default 3600)")
    parser.add_argument("--interval", type=float, default=20, help="poll interval in seconds (default 20)")
    parser.add_argument(
        "--aggregator", action="append", default=[],
        help="job that only reports the others (e.g. a required 'CI gate'): its log is skipped when another job failed",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run").add_argument("run_id")
    dispatch = sub.add_parser("dispatch")
    dispatch.add_argument("workflow")
    dispatch.add_argument("--ref", default="main")
    dispatch.add_argument("-f", "--field", action="append", default=[])
    dispatch.add_argument("--no-wait", action="store_true")
    deploy = sub.add_parser("deploy-for-tag")
    deploy.add_argument("tag")
    deploy.add_argument("--workflow", default="deploy.yml")
    pr = sub.add_parser("pr")
    pr.add_argument("number")
    pr.add_argument("--enqueue", action="store_true", help="enable auto-merge, then wait for MERGED")
    pr.add_argument("--head", help="reviewed head SHA, passed as --match-head-commit")
    pr.add_argument("--repo")
    pr.add_argument("--strategy", choices=["squash", "merge", "rebase"], default="squash",
                    help="merge strategy passed with --enqueue; a merge queue applies its own")
    args = parser.parse_args(argv)

    w = waiter or Waiter()
    w.interval = args.interval
    w.aggregators = frozenset(args.aggregator) or w.aggregators
    if args.cmd == "pr":
        w.strategy = args.strategy
    try:
        if args.cmd == "run":
            code, verdict = w.wait_run(args.run_id, args.timeout)
        elif args.cmd == "dispatch":
            code, verdict = w.dispatch(args.workflow, args.ref, args.field, args.timeout, args.no_wait)
        elif args.cmd == "deploy-for-tag":
            code, verdict = w.deploy_for_tag(args.tag, args.workflow, args.timeout)
        else:
            repo = args.repo or current_repo(w.gh)
            code, verdict = w.pr(args.number, repo, args.enqueue, args.head, args.timeout)
    except RuntimeError as error:
        code, verdict = FAILED, {"result": "error", "error": str(error)}
    w.say(json.dumps(verdict, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
