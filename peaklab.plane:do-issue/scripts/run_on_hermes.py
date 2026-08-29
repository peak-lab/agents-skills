#!/usr/bin/env python3
"""Run one Plane issue safely from the Hermes host."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
SELECTOR = SKILL_ROOT / "scripts" / "select_issue.py"
BUILD_ENV_FILE = Path("/etc/example-plane-build.env")
GLITCHTIP_ENV_FILE = Path("/etc/example-glitchtip.env")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("issue", nargs="?", help="Plane identifier, for example PUSHR-1375")
    parser.add_argument("--no-merge", action="store_true", default=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--preflight", action="store_true")
    return parser.parse_args()


def selector(issue: str, cwd: Path) -> dict[str, object]:
    completed = subprocess.run(
        [sys.executable, str(SELECTOR), issue, "--auto"],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        timeout=180,
    )
    return json.loads(completed.stdout)


def is_escalation(issue: dict[str, object]) -> bool:
    text = " ".join(
        str(issue.get(key) or "")
        for key in ("description", "description_html", "title")
    ).lower()
    return "escalate" in text or "owner package cannot be proven" in text


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def ticket_context(issue: dict[str, object]) -> str:
    parser = TextExtractor()
    parser.feed(str(issue.get("description_html") or issue.get("description") or ""))
    return " ".join(" ".join(parser.parts).split())[:2_000]


def write_escalation_analysis(issue: dict[str, object]) -> Path:
    task_dir = Path(str(issue["task_dir"]))
    task_dir.mkdir(parents=True, exist_ok=True)
    analysis = task_dir / "analyze.md"
    analysis.write_text(
        "# Analysis\n\n"
        f"- Issue: {issue['prefix']}-{issue['sequence_id']} — {issue['title']}\n"
        "- Verdict: blocked. The GlitchTip ticket is explicitly routed as an escalation: "
        "no owning package or actionable in-app source frame is proven.\n"
        "- No product file, branch commit, pull request, deployment, GlitchTip state, or merge was created.\n",
        encoding="utf-8",
    )
    return analysis


def load_env_file(env: dict[str, str], path: Path, *, required: bool) -> None:
    if not path.is_file():
        if required:
            raise RuntimeError(f"missing Hermes runtime environment: {path}")
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not key.replace("_", "").isalnum() or not key.isupper():
            raise RuntimeError(f"invalid Hermes build environment entry: {raw_line!r}")
        env[key] = value


def load_runtime_env() -> dict[str, str]:
    env = os.environ.copy()
    load_env_file(env, BUILD_ENV_FILE, required=True)
    load_env_file(env, GLITCHTIP_ENV_FILE, required=False)
    return env


def ensure_dependencies(cwd: Path, env: dict[str, str]) -> None:
    subprocess.run(
        ["corepack", "pnpm", "install", "--frozen-lockfile"],
        cwd=cwd,
        env=env,
        check=True,
        timeout=600,
    )


def run_candidate(issue: dict[str, object], cwd: Path, *, escalation: bool) -> int:
    env = load_runtime_env()
    ensure_dependencies(cwd, env)
    route = (
        "The ticket is an escalation. First inspect only its linked GlitchTip source issues via read-only API calls. "
        "If no in-app frame and safe owner package can be proven, write a blocked analyze.md with the sanitised evidence and stop without code. "
        "Only if the live evidence proves a single safe package and root cause may you continue with the direct worker flow. "
        if escalation
        else "The ticket passed the deterministic escalation gate. Continue with the direct fallback worker flow. "
    )
    prompt = (
        "You are already the implementation worker launched by the installed plane-do-issue "
        "Hermes runtime. Do not invoke the plane-do-issue skill again: that would recursively "
        "start another orchestration run. Resolve exactly "
        f"{issue['prefix']}-{issue['sequence_id']} in this worktree. {route}Work only in this checkout; "
        f"write artifacts only to {issue['task_dir']} (never create .agents/tasks inside the worktree). "
        f"The Plane title is: {issue['title']}. Sanitised ticket context: {ticket_context(issue)}. Never use Agent, ScheduleWakeup, "
        "CronCreate, RemoteTrigger, Monitor, a deferred mechanism, merge, deploy, or resolve GlitchTip. "
        "When GLITCHTIP_TOKEN is present, use it only for read-only GlitchTip API requests needed to inspect the "
        "ticket's linked source issues. Never print, persist, commit, or send the token or raw event/request data. "
        "This Hermes host has 3.7 GiB RAM. Do not run a Front build:prod here: that script hard-codes a 4 GiB "
        "Node heap and can OOM the host. Run the relevant type-check, lint:ci/lint:ds and targeted tests instead, "
        "then record that build:prod remains a CI gate. "
        "Write analyze.md before edits, then plan.md and implementation.md; use TDD where meaningful. "
        "Create a reviewed PR only after analysis and validation, and stop at --no-merge."
    )
    return subprocess.run(
        [
            "claude", "-p", prompt, "--model", "sonnet", "--max-turns", "60",
            "--max-budget-usd", "12", "--permission-mode", "auto",
            "--output-format", "stream-json", "--verbose", "--no-session-persistence",
        ],
        cwd=cwd,
        env=env,
        check=False,
    ).returncode


def main() -> int:
    args = parse_args()
    cwd = Path.cwd()
    if args.preflight:
        env = load_runtime_env()
        ensure_dependencies(cwd, env)
        print(json.dumps({"preflight": True, "build_env": "loaded", "dependencies": "installed"}))
        return 0
    if not args.issue:
        raise SystemExit("issue is required unless --preflight is used")
    if args.dry_run:
        print(json.dumps({"dry_run": True, "issue": args.issue, "merge_mode": "no-merge"}))
        return 0
    issue = selector(args.issue, cwd)
    if not issue.get("found"):
        print(json.dumps(issue, ensure_ascii=False))
        return 0
    escalation = is_escalation(issue)
    if escalation and not load_runtime_env().get("GLITCHTIP_TOKEN"):
        analysis = write_escalation_analysis(issue)
        print(
            "RESULT\n"
            "status: blocked\n"
            f"issue: {issue['prefix']}-{issue['sequence_id']}\n"
            f"branch: {issue['branch']}\n"
            "pr_url: \n"
            f"evidence: {analysis}\n"
            "notes: GlitchTip escalation; no proven package owner or actionable source frame."
        )
        return 0
    return run_candidate(issue, cwd, escalation=escalation)


if __name__ == "__main__":
    raise SystemExit(main())
