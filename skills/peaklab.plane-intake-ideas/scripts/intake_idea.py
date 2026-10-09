#!/usr/bin/env python3
"""Create and list "[Idée]" entries in a Plane project's Intake."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PLANE_API_DIR = Path(__file__).resolve().parents[2] / "peaklab.plane-api"
sys.path.insert(0, str(PLANE_API_DIR))

from plane_client import load_plane_client  # noqa: E402

PREFIX = "[Idée]"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create", help="create one Intake idea and label it")
    create.add_argument("--title", required=True)
    create.add_argument("--html-file", required=True)
    create.add_argument("--labels", default="", help="comma-separated label names, created if missing")
    create.add_argument("--dry-run", action="store_true")

    listing = sub.add_parser("list", help="list Intake ideas, optionally filtered by label")
    listing.add_argument("--label", default="")
    listing.add_argument("--all-states", action="store_true", help="include accepted/declined entries")
    return parser.parse_args()


def intake_url(project, issue_id: str) -> str:
    return (f"https://{project.host}/{project.workspace}/projects/{project.project_id}"
            f"/intake/?currentTab=open&inboxIssueId={issue_id}")


def resolve_labels(client, names: list[str]) -> list[str]:
    wp = client.project.path
    existing = {label["name"]: label["id"] for label in client.results(f"{wp}/labels/")}
    ids = []
    for name in names:
        if name not in existing:
            existing[name] = client.request("POST", f"{wp}/labels/", {"name": name})["id"]
        ids.append(existing[name])
    return ids


def create(args: argparse.Namespace, client=None) -> int:
    title = args.title if args.title.startswith(PREFIX) else f"{PREFIX} {args.title}"
    html = Path(args.html_file).read_text(encoding="utf-8")
    labels = [name.strip() for name in args.labels.split(",") if name.strip()]
    if args.dry_run:
        print(json.dumps({"name": title, "labels": labels, "html_chars": len(html)}, ensure_ascii=False))
        return 0

    client = client or load_plane_client()
    wp = client.project.path
    created = client.request("POST", f"{wp}/intake-issues/",
                             {"issue": {"name": title, "description_html": html, "priority": "none"}})
    issue_id = created["issue"]
    applied: list[str] = []
    if labels:
        patched = client.request("PATCH", f"{wp}/work-items/{issue_id}/",
                                 {"labels": resolve_labels(client, labels)})
        names = {label["id"]: label["name"] for label in client.results(f"{wp}/labels/")}
        applied = [names.get(i, i) for i in patched.get("labels", [])]
    seq = (created.get("issue_detail") or {}).get("sequence_id")
    identifier = client.request("GET", f"{wp}/")["identifier"]
    print(json.dumps({"id": f"{identifier}-{seq}" if seq else None, "issue_id": issue_id, "title": title,
                      "labels": applied, "url": intake_url(client.project, issue_id)}, ensure_ascii=False))
    return 0


def list_ideas(args: argparse.Namespace, client=None) -> int:
    client = client or load_plane_client()
    wp = client.project.path
    identifier = client.request("GET", f"{wp}/")["identifier"]
    label_id = None
    if args.label:
        label_id = next((l["id"] for l in client.results(f"{wp}/labels/") if l["name"] == args.label), None)
        if label_id is None:
            print(f"label not found: {args.label}", file=sys.stderr)
            return 1
    for entry in client.results(f"{wp}/intake-issues/"):
        detail = entry.get("issue_detail") or {}
        if not (detail.get("name") or "").startswith(PREFIX):
            continue
        if not args.all_states and entry.get("status") != -2:
            continue
        if label_id and label_id not in (detail.get("label_ids") or detail.get("labels") or []):
            continue
        print(json.dumps({"id": f"{identifier}-{detail.get('sequence_id')}", "status": entry.get("status"),
                          "title": detail["name"], "url": intake_url(client.project, entry["issue"])},
                         ensure_ascii=False))
    return 0


def main() -> int:
    args = parse_args()
    return create(args) if args.command == "create" else list_ideas(args)


if __name__ == "__main__":
    raise SystemExit(main())
