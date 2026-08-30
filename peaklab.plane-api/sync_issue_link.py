#!/usr/bin/env python3
"""Synchronize links between a Plane issue, the current branch, and a GitHub PR.

Usage:
    python3 ~/.agents/skills/peaklab.plane-api/sync_issue_link.py [ISSUE] [options]

ISSUE can be a Plane UUID, a Plane URL, PREFIX-123, or just 123.
If omitted, the script tries to infer PREFIX-123 from the branch name.

Options:
    --branch=<name>       Branch to link. Defaults to the current git branch.
    --pr=<number|url>     PR to link. Defaults to `gh pr view` for the branch.
    --repo=<path>         Git repository path. Defaults to the current directory.
    --force-comment       Add a Plane comment even when the link state is unchanged.
    --no-plane-comment    Do not add a Plane comment.
    --no-pr-body          Do not add/update the Plane block in the PR body.
    --dry-run             Print planned changes without writing them.
"""
import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import quote, urlparse, parse_qs

from plane_client import PlaneConfigError, load_plane_client


PLANE_SYNC_START = "<!-- plane-sync:start -->"
PLANE_SYNC_END = "<!-- plane-sync:end -->"
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
ISSUE_REF_RE = re.compile(r"(?<![A-Z0-9])([A-Z][A-Z0-9]+)-(\d+)(?![A-Z0-9])")


@dataclass(frozen=True)
class PlaneIssue:
    uuid: str
    sequence_id: str
    prefix: str
    title: str
    url: str

    @property
    def ref(self):
        return f"{self.prefix}-{self.sequence_id}" if self.prefix else self.sequence_id


@dataclass(frozen=True)
class GitLink:
    branch: str
    branch_url: Optional[str]
    repo_url: Optional[str]


@dataclass(frozen=True)
class PullRequest:
    number: Optional[str]
    title: str
    url: str
    body: str
    edit_target: Optional[str]
    editable: bool


@dataclass(frozen=True)
class SyncLinks:
    issue: PlaneIssue
    git: GitLink
    pr: Optional[PullRequest]


class CommandError(RuntimeError):
    pass


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("issue", nargs="?")
    parser.add_argument("--branch")
    parser.add_argument("--pr")
    parser.add_argument("--repo", default=os.getcwd())
    parser.add_argument("--force-comment", action="store_true")
    parser.add_argument("--no-plane-comment", action="store_true")
    parser.add_argument("--no-pr-body", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def run_command(args, cwd, check=False):
    try:
        completed = subprocess.run(
            args,
            cwd=cwd,
            check=check,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError as error:
        raise CommandError(f"Command not found: {args[0]}") from error

    if completed.returncode != 0:
        if check:
            detail = completed.stderr.strip() or completed.stdout.strip()
            raise CommandError(f"{' '.join(args)} failed: {detail}")
        return None

    return completed.stdout.strip()


def current_branch(repo):
    branch = run_command(["git", "branch", "--show-current"], repo)
    if not branch:
        raise CommandError("Cannot resolve current branch")
    return branch


def origin_repo_url(repo):
    remote_url = run_command(["git", "remote", "get-url", "origin"], repo)
    if not remote_url:
        return None
    return normalize_git_remote(remote_url)


def normalize_git_remote(remote_url):
    remote_url = remote_url.strip()
    git_ssh = re.match(r"git@([^:]+):(.+?)(?:\.git)?$", remote_url)
    if git_ssh:
        return f"https://{git_ssh.group(1)}/{git_ssh.group(2)}"

    ssh_url = re.match(r"ssh://git@([^/]+)/(.+?)(?:\.git)?$", remote_url)
    if ssh_url:
        return f"https://{ssh_url.group(1)}/{ssh_url.group(2)}"

    if remote_url.startswith("http://") or remote_url.startswith("https://"):
        return re.sub(r"\.git$", "", remote_url)

    return None


def branch_url(repo_url, branch):
    if not repo_url:
        return None
    return f"{repo_url}/tree/{quote(branch, safe='/')}"


def git_link(repo, branch_arg):
    branch = branch_arg or current_branch(repo)
    repo_url = origin_repo_url(repo)
    return GitLink(branch=branch, branch_url=branch_url(repo_url, branch), repo_url=repo_url)


def gh_pr_view(repo, pr_arg=None):
    args = ["gh", "pr", "view"]
    if pr_arg:
        args.append(pr_arg)
    args.extend(["--json", "number,title,url,headRefName,body"])

    output = run_command(args, repo)
    if not output:
        return None

    data = json.loads(output)
    number = str(data.get("number") or "") or None
    return PullRequest(
        number=number,
        title=data.get("title") or "",
        url=data.get("url") or "",
        body=data.get("body") or "",
        edit_target=pr_arg or number,
        editable=True,
    )


def fallback_pr_from_arg(pr_arg):
    if not pr_arg:
        return None
    if pr_arg.startswith("http://") or pr_arg.startswith("https://"):
        match = re.search(r"/pull/(\d+)", pr_arg)
        number = match.group(1) if match else None
        return PullRequest(
            number=number,
            title="",
            url=pr_arg,
            body="",
            edit_target=pr_arg,
            editable=False,
        )
    if pr_arg.isdigit():
        return PullRequest(
            number=pr_arg,
            title="",
            url="",
            body="",
            edit_target=pr_arg,
            editable=False,
        )
    return None


def resolve_pr(repo, pr_arg):
    try:
        return gh_pr_view(repo, pr_arg)
    except (CommandError, json.JSONDecodeError):
        return fallback_pr_from_arg(pr_arg)


def project_prefix(client):
    project_info = client.request("GET", f"{client.project.path}/")
    return project_info.get("identifier", "")


def infer_issue_ref(branch, prefix):
    matches = ISSUE_REF_RE.findall(branch.upper())
    if not matches:
        return None
    for found_prefix, sequence_id in matches:
        if found_prefix == prefix:
            return f"{found_prefix}-{sequence_id}"
    found_prefix, sequence_id = matches[0]
    return f"{found_prefix}-{sequence_id}"


def issue_uuid_from_url(value):
    parsed = urlparse(value)
    query_issue = parse_qs(parsed.query).get("issue")
    if query_issue:
        return query_issue[0]

    path_parts = [part for part in parsed.path.split("/") if part]
    for part in reversed(path_parts):
        if UUID_RE.match(part):
            return part
    return None


def issue_sequence_from_ref(value):
    match = re.search(r"(?:[A-Z][A-Z0-9]+-)?(\d+)$", value, re.IGNORECASE)
    return match.group(1) if match else None


def resolve_issue(client, issue_arg, branch):
    prefix = project_prefix(client)
    issue_ref = issue_arg or infer_issue_ref(branch, prefix)
    if not issue_ref:
        raise PlaneConfigError(
            "Issue argument is required when branch does not contain PREFIX-123"
        )

    issue_uuid = issue_uuid_from_url(issue_ref) if "://" in issue_ref else None
    if issue_uuid or UUID_RE.match(issue_ref):
        issue = client.request("GET", f"{client.project.path}/issues/{issue_uuid or issue_ref}/")
        return plane_issue_from_api(client, issue, prefix)

    sequence_id = issue_sequence_from_ref(issue_ref)
    if not sequence_id:
        raise PlaneConfigError(f"Cannot parse issue reference: {issue_ref}")

    issues = client.results(f"{client.project.path}/issues/?sequence_ids={sequence_id}")
    issue = next(
        (candidate for candidate in issues if str(candidate.get("sequence_id")) == sequence_id),
        None,
    )
    if not issue:
        raise PlaneConfigError(f"Issue {prefix}-{sequence_id} not found")
    return plane_issue_from_api(client, issue, prefix)


def plane_issue_from_api(client, issue, prefix):
    issue_uuid = issue["id"]
    sequence_id = str(issue.get("sequence_id") or "")
    return PlaneIssue(
        uuid=issue_uuid,
        sequence_id=sequence_id,
        prefix=prefix,
        title=issue.get("name") or "",
        url=client.project.issue_url(issue_uuid),
    )


def html_link(url, text):
    safe_text = html.escape(text)
    if not url:
        return safe_text
    return f'<a href="{html.escape(url, quote=True)}">{safe_text}</a>'


def plane_comment_html(links):
    rows = [
        f"<li>Issue: {html_link(links.issue.url, links.issue.ref)}</li>",
        f"<li>Branche: {html_link(links.git.branch_url, links.git.branch)}</li>",
    ]
    if links.pr and links.pr.url:
        pr_label = f"#{links.pr.number}" if links.pr.number else links.pr.url
        if links.pr.title:
            pr_label = f"{pr_label} - {links.pr.title}"
        rows.append(f"<li>PR: {html_link(links.pr.url, pr_label)}</li>")

    return "<p>Liens synchronises:</p><ul>" + "".join(rows) + "</ul>"


def pr_body_block(links):
    lines = [
        PLANE_SYNC_START,
        f"Plane issue: [{links.issue.ref}]({links.issue.url})",
        f"Branch: `{links.git.branch}`",
    ]
    if links.git.branch_url:
        lines.append(f"Branch URL: {links.git.branch_url}")
    lines.append(PLANE_SYNC_END)
    return "\n".join(lines)


def upsert_pr_body(body, links):
    block = pr_body_block(links)
    pattern = re.compile(
        rf"{re.escape(PLANE_SYNC_START)}.*?{re.escape(PLANE_SYNC_END)}",
        re.DOTALL,
    )
    if pattern.search(body or ""):
        return pattern.sub(block, body)
    separator = "\n\n" if body else ""
    return f"{body or ''}{separator}{block}\n"


def add_plane_comment(client, links):
    return client.request(
        "POST",
        f"{client.project.path}/issues/{links.issue.uuid}/comments/",
        {"comment_html": plane_comment_html(links)},
    )


def edit_pr_body(repo, pr, body):
    if not pr.edit_target:
        raise CommandError("Cannot edit PR body without a PR number or URL")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", delete=False) as body_file:
            body_file.write(body)
            temp_path = body_file.name
        run_command(["gh", "pr", "edit", pr.edit_target, "--body-file", temp_path], repo, True)
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


def link_identity(links):
    return {
        "issue": {
            "uuid": links.issue.uuid,
            "ref": links.issue.ref,
            "title": links.issue.title,
            "url": links.issue.url,
        },
        "branch": {
            "name": links.git.branch,
            "url": links.git.branch_url,
            "repo_url": links.git.repo_url,
        },
        "pr": None
        if not links.pr
        else {
            "number": links.pr.number,
            "title": links.pr.title,
            "url": links.pr.url,
        },
    }


def state_path(repo, issue_ref):
    safe_ref = re.sub(r"[^A-Za-z0-9_.-]+", "-", issue_ref)
    return repo / ".claude/plane/links" / f"{safe_ref}.json"


def save_state(repo, links):
    path = state_path(repo, links.issue.ref)
    path.parent.mkdir(parents=True, exist_ok=True)
    state = link_identity(links)
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    with path.open("w") as state_file:
        json.dump(state, state_file, ensure_ascii=False, indent=2)
    return path


def load_state(repo, issue_ref):
    path = state_path(repo, issue_ref)
    if not path.exists():
        return None
    with path.open() as state_file:
        state = json.load(state_file)
    state.pop("updated_at", None)
    return state


def print_plan(links, will_comment, will_edit_pr, will_save_state):
    print(f"Issue: {links.issue.ref} - {links.issue.title}")
    print(f"Issue URL: {links.issue.url}")
    print(f"Branch: {links.git.branch}")
    if links.git.branch_url:
        print(f"Branch URL: {links.git.branch_url}")
    if links.pr:
        pr_label = f"#{links.pr.number}" if links.pr.number else "(unknown number)"
        print(f"PR: {pr_label} {links.pr.url}".strip())
    else:
        print("PR: none detected")
    print(f"Plane comment: {'yes' if will_comment else 'no'}")
    print(f"PR body sync: {'yes' if will_edit_pr else 'no'}")
    print(f"Local state: {'yes' if will_save_state else 'no'}")


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    repo = Path(args.repo).resolve()

    try:
        git = git_link(repo, args.branch)
        client = load_plane_client(cwd=repo)
        issue = resolve_issue(client, args.issue, git.branch)
        pr_target = args.pr or (git.branch if args.branch else None)
        pr = resolve_pr(repo, pr_target)
        links = SyncLinks(issue=issue, git=git, pr=pr)
        link_unchanged = load_state(repo, issue.ref) == link_identity(links)

        will_comment = not args.no_plane_comment and (
            args.force_comment or not link_unchanged
        )
        will_edit_pr = bool(pr and pr.editable and not args.no_pr_body)
        will_save_state = True

        print_plan(links, will_comment, will_edit_pr, will_save_state)
        if args.dry_run:
            return 0

        if will_comment:
            add_plane_comment(client, links)
        if will_edit_pr:
            edit_pr_body(repo, pr, upsert_pr_body(pr.body, links))
        state_file = save_state(repo, links)
        print(f"Saved: {state_file}")
        return 0
    except (CommandError, PlaneConfigError, OSError, KeyError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
