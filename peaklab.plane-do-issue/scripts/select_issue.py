#!/usr/bin/env python3
"""Select or fetch a Plane issue and move it to In Progress."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SKILL_ROOT / "peaklab.plane-api"))

from plane_client import load_plane_client  # noqa: E402


STATE_FILE = Path(tempfile.gettempdir()) / "plane-do-issue-state.json"
PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3, "none": 4, "": 5}
STOP_WORDS = {
    "le",
    "la",
    "les",
    "de",
    "des",
    "du",
    "un",
    "une",
    "et",
    "pour",
    "dans",
    "sur",
    "avec",
    "au",
    "aux",
    "the",
    "a",
    "an",
    "to",
    "of",
    "in",
    "for",
    "with",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("issue", nargs="?", default="", help="PREFIX-N, N, UUID, URL, next, or empty")
    auto_mode = parser.add_mutually_exclusive_group()
    auto_mode.add_argument("--auto", dest="auto", action="store_true", default=True, help="use the default non-interactive execution")
    auto_mode.add_argument("--no-auto", dest="auto", action="store_false", help="retain urgent/high confirmation pauses")
    tdd_mode = parser.add_mutually_exclusive_group()
    tdd_mode.add_argument("--tdd", dest="tdd", action="store_true", default=True, help="use the default APEX RED-GREEN-REFACTOR execution")
    tdd_mode.add_argument("--no-tdd", dest="tdd", action="store_false", help="opt out of APEX RED-GREEN-REFACTOR execution")
    return parser.parse_args()


def get_context(client):
    project_path = client.project.path
    project = client.request("GET", f"{project_path}/")
    me_id = client.request("GET", "/users/me/")["id"]
    states = client.results(f"{project_path}/states/")

    by_group: dict[str, str] = {}
    for state in states:
        key = f"{state['group']}_{state['name'].lower().replace(' ', '_')}"
        by_group.setdefault(state["group"], state["id"])
        by_group[key] = state["id"]

    state_todo = next((s["id"] for s in states if s.get("name", "").lower() == "todo"), None)
    unstarted_ids = [s["id"] for s in states if s["group"] in ("unstarted", "backlog")]

    return {
        "project_path": project_path,
        "prefix": project["identifier"],
        "me_id": me_id,
        "states": states,
        "state_in_progress": by_group.get("started_in_progress", by_group.get("started")),
        "todo_ids": [state_todo] if state_todo else unstarted_ids,
    }


def results(client, path: str) -> list[dict]:
    return client.results(path)


def fetch_all_issues(client, project_path: str, per_page: int = 100) -> list[dict]:
    issues: list[dict] = []
    cursor: str | None = None

    while True:
        path = f"{project_path}/issues/?per_page={per_page}"
        if cursor:
            path += f"&cursor={cursor}"

        response = client.request("GET", path)
        if isinstance(response, list):
            issues.extend(response)
            return issues

        if not isinstance(response, dict):
            return issues

        page = response.get("results") or []
        issues.extend(page)

        if not response.get("next_page_results"):
            return issues

        next_cursor = response.get("next_cursor")
        if not next_cursor or next_cursor == cursor:
            return issues
        cursor = next_cursor


def fetch_issues(client, project_path: str, state_ids: list[str], assignee_id: str | None = None):
    # Plane instances differ in how they handle state__in filtering. Fetch a bounded
    # page and filter client-side so completed/started issues are never reselected.
    issues = fetch_all_issues(client, project_path)
    issues = [issue for issue in issues if issue.get("state") in state_ids]
    if assignee_id:
        issues = [issue for issue in issues if assignee_id in (issue.get("assignees") or [])]
    return issues


def is_epic_issue(issue: dict) -> bool:
    title = issue.get("name") or ""
    return bool(re.match(r"\s*\[EPIC\b", title, re.I))


def best_issue(
    issues: list[dict],
    me_id: str,
    exclude_others: bool = False,
    exclude_epics: bool = True,
) -> dict | None:
    if exclude_others:
        issues = [
            issue
            for issue in issues
            if not issue.get("assignees") or me_id in (issue.get("assignees") or [])
        ]
    if exclude_epics:
        issues = [issue for issue in issues if not is_epic_issue(issue)]
    return min(
        issues,
        key=lambda issue: PRIORITY_ORDER.get(issue.get("priority") or "", 5),
        default=None,
    )


def fetch_issue_by_sequence(client, project_path: str, seq: str) -> dict | None:
    # Some Plane instances ignore sequence_ids/sequence_id filters and return a
    # generic page, or return no matches. Always verify the exact sequence ID and
    # fall back to bounded client-side filtering before reporting a miss.
    matches = results(client, f"{project_path}/issues/?sequence_ids={seq}&per_page=10")
    exact = next((issue for issue in matches if str(issue.get("sequence_id")) == seq), None)
    if exact:
        return exact

    issues = fetch_all_issues(client, project_path)
    return next((issue for issue in issues if str(issue.get("sequence_id")) == seq), None)


def issue_from_arg(client, ctx: dict, raw_arg: str) -> tuple[dict | None, str]:
    arg = raw_arg.strip()
    project_path = ctx["project_path"]

    if not arg or arg == "next":
        issue = best_issue(
            fetch_issues(client, project_path, ctx["todo_ids"], assignee_id=ctx["me_id"]),
            ctx["me_id"],
            exclude_epics=True,
        )
        if issue:
            return issue, "assignée"
        return (
            best_issue(
                fetch_issues(client, project_path, ctx["todo_ids"]),
                ctx["me_id"],
                exclude_others=True,
                exclude_epics=True,
            ),
            "globale",
        )

    uuid_match = re.search(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        arg,
        re.I,
    )
    if uuid_match:
        return client.request("GET", f"{project_path}/issues/{uuid_match.group(0)}/"), "spécifique"

    prefixed_match = re.search(r"\b([A-Za-z][A-Za-z0-9_-]*)-(\d+)\b", arg)
    if prefixed_match:
        prefix, seq = prefixed_match.groups()
        if prefix.upper() != ctx["prefix"].upper():
            raise SystemExit(f"Préfixe invalide: {prefix!r} (attendu: {ctx['prefix']})")
        return fetch_issue_by_sequence(client, project_path, seq), "spécifique"

    seq_match = re.search(r"\d+$", arg)
    if not seq_match:
        raise SystemExit(f"Argument invalide: {arg!r}")

    seq = seq_match.group(0)
    return fetch_issue_by_sequence(client, project_path, seq), "spécifique"


def infer_branch_type(title: str) -> str:
    lowered = title.lower()
    if re.search(r"\b(fix|bug|corriger|reparer|réparer|erreur|crash)\b", lowered):
        return "fix"
    if re.search(r"\b(refactor|refactoriser)\b", lowered):
        return "refactor"
    if re.search(r"\b(doc|docs|documentation)\b", lowered):
        return "docs"
    if re.search(r"\b(test|tests)\b", lowered):
        return "test"
    if re.search(r"\b(perf|performance|optimiser)\b", lowered):
        return "perf"
    if re.search(r"\b(chore|ci|maintenance)\b", lowered):
        return "chore"
    return "feat"


def slugify(title: str) -> str:
    ascii_title = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", ascii_title.lower())
    keywords = [word for word in words if word not in STOP_WORDS][:4] or ["plane-task"]
    return "-".join(keywords)[:40].strip("-")


def enrich_issue(client, project_path: str, issue: dict) -> dict:
    extras: dict[str, object] = {"labels": [], "comments": [], "parent": None, "context_warnings": []}
    warnings: list[str] = extras["context_warnings"]  # type: ignore[assignment]

    image_count = (issue.get("description_html") or "").count("<image-component")
    if image_count:
        warnings.append(
            f"description contient {image_count} image(s) non récupérable(s) par API — "
            "consulter le ticket dans Plane si le texte seul est ambigu"
        )

    if issue.get("labels"):
        try:
            label_names = {label["id"]: label["name"] for label in client.results(f"{project_path}/labels/")}
            extras["labels"] = [label_names.get(label_id, label_id) for label_id in issue["labels"]]
        except Exception as exc:
            warnings.append(f"labels indisponibles: {exc}")

    try:
        raw_comments = client.results(f"{project_path}/issues/{issue['id']}/comments/")
        raw_comments.sort(key=lambda c: c.get("created_at") or "")
        extras["comments"] = [
            {
                "created_at": comment.get("created_at", ""),
                "author": (comment.get("actor_detail") or {}).get("display_name", ""),
                "text": comment.get("comment_stripped") or comment.get("comment_html") or "",
            }
            for comment in raw_comments[-10:]
        ]
    except Exception as exc:
        warnings.append(f"commentaires indisponibles: {exc}")

    parent_id = issue.get("parent")
    if parent_id:
        try:
            parent = client.request("GET", f"{project_path}/issues/{parent_id}/")
            extras["parent"] = {
                "sequence_id": parent.get("sequence_id"),
                "title": parent.get("name", ""),
                "description": parent.get("description_stripped", "") or "",
            }
        except Exception as exc:
            warnings.append(f"parent indisponible: {exc}")

    return extras


def clear_state_file() -> None:
    try:
        STATE_FILE.unlink()
    except FileNotFoundError:
        pass


def write_state_file(output: dict[str, object]) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=STATE_FILE.parent,
            prefix=f".{STATE_FILE.name}.",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            json.dump(output, temporary, ensure_ascii=False, indent=2)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        temporary_path.replace(STATE_FILE)
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def worktree_context(cwd: Path) -> tuple[Path, str | None, str | None]:
    def git(*args: str) -> str:
        return subprocess.run(
            ["git", *args], cwd=cwd, check=True, text=True, capture_output=True
        ).stdout.strip()

    try:
        git_dir = Path(git("rev-parse", "--git-dir"))
        git_dir = git_dir if git_dir.is_absolute() else (cwd / git_dir).resolve()
        worktrees = [
            line.removeprefix("worktree ")
            for line in git("worktree", "list", "--porcelain").splitlines()
            if line.startswith("worktree ")
        ]
        if not worktrees:
            return cwd, None, "Impossible de déterminer le checkout principal."
        primary_root = Path(worktrees[0])
        if not git_dir.is_file():
            return primary_root, None, None
        branch = git("branch", "--show-current")
        dirty = git("status", "--short")
        base_ref = git("symbolic-ref", "refs/remotes/origin/HEAD")
        base_branch = base_ref.rsplit("/", 1)[-1]
    except subprocess.CalledProcessError as exc:
        return cwd, None, f"Impossible de vérifier le worktree actif: {exc.stderr.strip()}"

    if not branch:
        return primary_root, None, "Le worktree actif est détaché; créez ou sélectionnez une branche avant de lancer l'issue."
    if dirty:
        return primary_root, None, "Le worktree actif contient des modifications; validez ou isolez-les avant de lancer l'issue."
    if branch == base_branch:
        return primary_root, None, f"Le worktree actif est sur la branche de base ({base_branch}); utilisez une branche de travail."
    return primary_root, branch, None


def main() -> int:
    clear_state_file()
    args = parse_args()
    task_root, active_branch, worktree_error = worktree_context(Path.cwd())
    if worktree_error:
        print(json.dumps({"found": False, "message": worktree_error}, ensure_ascii=False))
        return 0
    client = load_plane_client()
    ctx = get_context(client)
    if not ctx["state_in_progress"]:
        print(json.dumps({"found": False, "message": "L'état Plane In Progress est introuvable; aucune issue n'a été modifiée."}, ensure_ascii=False))
        return 0
    issue, selection = issue_from_arg(client, ctx, args.issue)

    if not issue:
        arg = args.issue.strip()
        message = (
            f"Issue introuvable dans le projet Plane configuré: {arg}"
            if arg and arg != "next"
            else "Aucune issue disponible en Todo."
        )
        print(json.dumps({"found": False, "message": message}, ensure_ascii=False))
        return 0

    assignees = list(issue.get("assignees") or [])
    if ctx["me_id"] not in assignees:
        assignees.append(ctx["me_id"])

    payload: dict[str, object] = {"state": ctx["state_in_progress"], "assignees": assignees}
    if not issue.get("start_date"):
        payload["start_date"] = dt.date.today().isoformat()

    client.request("PATCH", f"{ctx['project_path']}/issues/{issue['id']}/", payload)

    title = issue.get("name", "")
    seq = issue.get("sequence_id")
    branch_type = infer_branch_type(title)
    slug = slugify(title)
    extras = enrich_issue(client, ctx["project_path"], issue)
    output = {
        "found": True,
        "selection": selection,
        "prefix": ctx["prefix"],
        "sequence_id": seq,
        "id": issue["id"],
        "title": title,
        "priority": issue.get("priority", "none"),
        "description": issue.get("description_stripped", "") or "",
        "description_html": issue.get("description_html", "") or "",
        "updated_at": issue.get("updated_at", ""),
        "labels": extras["labels"],
        "parent": extras["parent"],
        "comments": extras["comments"],
        "context_warnings": extras["context_warnings"],
        "state": "In Progress",
        "auto_mode": args.auto,
        "skip_confirm": args.auto,
        "tdd_mode": args.tdd,
        "branch": active_branch or f"{branch_type}/{ctx['prefix']}-{seq}-{slug}",
        "task_dir": str(task_root / ".agents" / "tasks" / f"{ctx['prefix']}-{seq}-{slug}"),
    }

    write_state_file(output)
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
