#!/usr/bin/env python3
"""Move the selected Plane issue to its terminal state and add a PR comment.

Targets default to the project's Done state on --merged and --released, and its In Review
state on --blocked. Override any of them per Plane config source with PLANE_MERGED_STATE,
PLANE_RELEASED_STATE, or PLANE_BLOCKED_STATE, set to the exact state name.

Where a project treats a merge as "not shipped yet", set PLANE_MERGED_STATE to the review
state and leave PLANE_RELEASED_STATE unset: merges park the issue, the release closes it.
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SKILL_ROOT / "peaklab.plane-api"))

from plane_client import load_plane_client  # noqa: E402


STATE_FILE = Path(tempfile.gettempdir()) / "plane-do-issue-state.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    status = parser.add_mutually_exclusive_group(required=True)
    status.add_argument("--merged", action="store_true")
    status.add_argument("--blocked", action="store_true")
    status.add_argument(
        "--released",
        action="store_true",
        help="the issue shipped to production in a release; pair with --release-url",
    )
    parser.add_argument(
        "--issue",
        default="",
        help="PREFIX-N; resolve the issue via the Plane API instead of the shared state file",
    )
    parser.add_argument("--pr-url", default="")
    parser.add_argument("--release-url", default="", help="GitHub Release URL, with --released")
    parser.add_argument("--version", default="", help="released SemVer tag, with --released")
    parser.add_argument("--reason", default="")
    return parser.parse_args()


def resolve_issue(client, project_path: str, args: argparse.Namespace) -> tuple[str, str]:
    if args.issue:
        from select_issue import fetch_issue_by_sequence

        prefix, _, seq = args.issue.rpartition("-")
        if not prefix or not seq.isdigit():
            raise SystemExit(f"Invalid --issue value: {args.issue!r} (expected PREFIX-N)")
        issue = fetch_issue_by_sequence(client, project_path, seq)
        if not issue:
            raise SystemExit(f"Issue {args.issue} not found via Plane API")
        return issue["id"], f"{prefix}-{issue['sequence_id']}"

    if not STATE_FILE.exists():
        raise SystemExit(
            f"State file not found: {STATE_FILE}. "
            "Pass --issue PREFIX-N to target the issue explicitly."
        )
    state = json.loads(STATE_FILE.read_text())
    return state["id"], f"{state['prefix']}-{state['sequence_id']}"


def resolve_by_name(states: list[dict], name: str) -> tuple[str, str]:
    """Resolve a configured state name exactly, or fail loudly with the valid choices."""
    wanted = name.strip().lower()
    for plane_state in states:
        if plane_state["name"].lower() == wanted:
            return plane_state["id"], plane_state["name"]
    available = ", ".join(sorted(plane_state["name"] for plane_state in states))
    raise SystemExit(
        f"Configured Plane state {name!r} does not exist in this project. Available: {available}"
    )


def main() -> int:
    args = parse_args()
    client = load_plane_client()
    project_path = client.project.path
    issue_id, issue_ref = resolve_issue(client, project_path, args)
    states = client.results(f"{project_path}/states/")

    by_group: dict[str, str] = {}
    for plane_state in states:
        key = f"{plane_state['group']}_{plane_state['name'].lower().replace(' ', '_')}"
        by_group.setdefault(plane_state["group"], plane_state["id"])
        by_group[key] = plane_state["id"]

    defaults = client.config.defaults
    if args.released:
        configured = defaults.get("PLANE_RELEASED_STATE")
        version = args.version or "production"
        comment = f"Livré en production ({version})"
        fallback = by_group.get("completed_done", by_group.get("completed"))
        fallback_label = "Done"
    elif args.merged:
        configured = defaults.get("PLANE_MERGED_STATE")
        comment = "PR mergée"
        fallback = by_group.get("completed_done", by_group.get("completed"))
        fallback_label = "Done"
    else:
        configured = defaults.get("PLANE_BLOCKED_STATE")
        comment = "PR en attente de review"
        fallback = by_group.get("started_in_review", by_group.get("started_to_review"))
        fallback_label = "In Review"

    if configured:
        target_state, label = resolve_by_name(states, configured)
    else:
        target_state, label = fallback, fallback_label

    if not target_state:
        raise SystemExit("Could not resolve target Plane state")

    client.request("PATCH", f"{project_path}/issues/{issue_id}/", {"state": target_state})

    link = args.release_url if args.released else args.pr_url
    if link:
        text = f'<p>{comment} : <a href="{link}">{link}</a></p>'
        if args.reason:
            text += f"<p>{args.reason}</p>"
        client.request("POST", f"{project_path}/issues/{issue_id}/comments/", {"comment_html": text})

    print(f"{issue_ref} -> {label}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
