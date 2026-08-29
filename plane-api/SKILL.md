---
name: plane-api
description: Use when Plane API configuration, metadata lookup, issue listing, updates, status transitions, or issue-ID resolution are needed. Delegates new issue creation to peaklab.plane-create-issue.
effort: fast
allowed-tools: Bash(rtk :*), Read, Write, Skill
---

<overview>
Interact with the Plane project management API using Python. This skill defines the shared bootstrap and helpers that other commands (peaklab.plane-do-issue, peaklab.fix-glitchtip, etc.) rely on.

New issue creation is owned by `peaklab.plane-create-issue`. For creation requests, load that skill and use this skill only for shared configuration, client access, and project metadata lookup.
</overview>

<shared-scripts>
Reusable script helpers live in `~/.agents/skills/plane-api/plane_client.py`.

- `PlaneConfigLoader` owns config discovery from project settings, `.env`, and global settings.
- `PlaneProject` owns URL-derived project metadata and issue URLs.
- `PlaneClient` owns HTTP requests, auth headers, browser User-Agent, and `results()` pagination unwrapping.

Prefer importing these helpers from `init_project.py` or future scripts instead of duplicating config/API code. New creation flows must invoke `peaklab.plane-create-issue`; this shared API skill intentionally exposes no separate creation helper.

Related script: `~/.agents/skills/plane-api/sync_issue_link.py` links a Plane issue with a git branch and GitHub PR by adding a Plane comment, updating a marked PR body block, and saving `.codex/plane/links/<ISSUE>.json`.
</shared-scripts>

<constraints>
- Always run `<bootstrap>` before any API call
- Never hardcode state IDs — always resolve dynamically via `<state-resolution>`
- Use Python for all API calls — never bash curl chains for JSON/HTML payloads
- Store `PLANE_TOKEN` in `~/.agents/.env` (global, chmod 600) or a gitignored project `.env` — never commit it
- Load `PLANE_TOKEN` and `PLANE_PROJECT` atomically from the same source; never combine a token from one source with a project host from another
- Always unwrap paginated responses via `results()` — list endpoints return `{results: []}`
- Delegate every new issue creation request to `peaklab.plane-create-issue`; do not POST a new issue directly from this skill
</constraints>

<configuration>
Credential priority: project `.env` → `~/.agents/.env` → legacy project `settings.local.json`.

```
PLANE_TOKEN=plane_api_xxx
PLANE_PROJECT=https://HOST/WORKSPACE/projects/UUID/issues/
```
</configuration>

<bootstrap>
Run once per session. Defines `api()`, `results()`, `BASE`, `WP`, `WORKSPACE`, `PROJECT_ID` through the shared atomic config loader.

```python
import sys
from pathlib import Path

PLANE_API_DIR = Path.home() / '.agents/skills/plane-api'
sys.path.insert(0, str(PLANE_API_DIR))

from plane_client import load_plane_client

CLIENT = load_plane_client()
HOST = CLIENT.project.host
WORKSPACE = CLIENT.project.workspace
PROJECT_ID = CLIENT.project.project_id
BASE = CLIENT.project.base_url
WP = CLIENT.project.path

def api(method, path, data=None):
    return CLIENT.request(method, path, data)

def results(path):
    return CLIENT.results(path)
```

`results()` follows Plane's cursor pagination and returns **every** row, not just the first
page. Do not hand-roll paging on top of it. `request()` stays raw: it returns the single-page
envelope, so reading `["results"]` from it silently truncates.

Note that `?sequence_ids=N` is **not applied server-side** on this deployment — the full list
comes back regardless. Always filter client-side on `sequence_id`, or a lookup will silently
resolve to the wrong issue.
</bootstrap>

<full-context>
Extended setup used by commands that need PREFIX, current user, and all state IDs.
Run after `<bootstrap>`.

```python
# Project prefix (e.g. "PROJ") + current user ID
PREFIX = api('GET', f'{WP}/')['identifier']
ME_ID  = api('GET', '/users/me/')['id']

# State resolution — always dynamic
states = results(f'{WP}/states/')

by_group = {}
for s in states:
    key = f"{s['group']}_{s['name'].lower().replace(' ', '_')}"
    by_group.setdefault(s['group'], s['id'])   # first of group = fallback
    by_group[key] = s['id']

STATE_IN_PROGRESS = by_group.get('started_in_progress', by_group.get('started'))
STATE_TO_REVIEW   = by_group.get('started_to_review')
STATE_DONE        = by_group.get('completed_done', by_group.get('completed'))
STATE_TODO        = next((s['id'] for s in states if s['name'].lower() == 'todo'), None)

STARTED_IDS   = [s['id'] for s in states if s['group'] == 'started']
UNSTARTED_IDS = [s['id'] for s in states if s['group'] in ('unstarted', 'backlog')]
TODO_IDS      = [STATE_TODO] if STATE_TODO else UNSTARTED_IDS
```
</full-context>

<operations>

## Quick Reference

| Operation | Call |
|-----------|------|
| List issues (all) | `results(f'{WP}/issues/')` |
| Filter by state | `results(f'{WP}/issues/?state={STATE_ID}')` |
| Filter by group | `results(f'{WP}/issues/?state__in={",".join(STARTED_IDS)}')` |
| Filter by assignee | `results(f'{WP}/issues/?assignees__in={ME_ID}')` |
| Get by sequence ID | `next(i for i in results(f'{WP}/issues/?sequence_ids={seq}') if i['sequence_id'] == seq)` |
| Create issue | Delegate to `peaklab.plane-create-issue` |
| Update issue | `api('PATCH', f'{WP}/issues/{UUID}/', data)` |
| Move to state | `api('PATCH', f'{WP}/issues/{UUID}/', {'state': STATE_ID})` |
| Add comment | `api('POST', f'{WP}/issues/{UUID}/comments/', {'comment_html': '<p>…</p>'})` |
| Get states | `results(f'{WP}/states/')` |
| Get current user | `api('GET', '/users/me/')` |
| Get project prefix | `api('GET', f'{WP}/')['identifier']` |

## Issue Selection Pattern

Used by commands that need to pick the best available issue:

```python
PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3, "none": 4, "": 5}

def fetch_issues(state_ids, assignee_id=None, per_page=100):
    ids = ','.join(state_ids)
    path = f'{WP}/issues/?state__in={ids}&per_page={per_page}'
    if assignee_id: path += f'&assignees__in={assignee_id}'
    return results(path)

def best_issue(issues, exclude_others=False):
    """Pick highest-priority issue. With exclude_others=True, skip issues claimed by someone else."""
    if exclude_others:
        issues = [i for i in issues
                  if not i.get('assignees') or ME_ID in (i.get('assignees') or [])]
    return min(issues, key=lambda x: PRIORITY_ORDER.get(x.get('priority', ''), 5), default=None)

# Typical usage (commands like peaklab.plane-do-issue):
issue = best_issue(fetch_issues(STARTED_IDS + UNSTARTED_IDS, assignee_id=ME_ID))
if not issue:
    issue = best_issue(fetch_issues(UNSTARTED_IDS), exclude_others=True)
```

## Status Transitions

```python
def move_to(issue_uuid, state_id):
    api('PATCH', f'{WP}/issues/{issue_uuid}/', {'state': state_id})

def comment(issue_uuid, html):
    api('POST', f'{WP}/issues/{issue_uuid}/comments/', {'comment_html': html})

# Common transitions:
move_to(UUID, STATE_IN_PROGRESS)
move_to(UUID, STATE_DONE)
comment(UUID, f'<p>PR mergée : <a href="{PR_URL}">{PR_URL}</a></p>')
```

## Creating Issues

Use `peaklab.plane-create-issue`. It owns payload drafting and validation, current `/work-items/` endpoint selection, legacy compatibility, duplicate safety, and result reporting. Do not issue a creation POST directly from another workflow.

## Cycles

`POST /cycles/` requires `owned_by` AND `project_id` in the body (not just URL path):

```python
api('POST', f'{WP}/cycles/', {
    'name': 'Avril-S1', 'start_date': '2026-04-07', 'end_date': '2026-04-13',
    'owned_by': ME_ID, 'project_id': PROJECT_ID
})
```

</operations>

<gotchas>

| Trap | Fix |
|------|-----|
| `WP` in URL constructor | `WP` is relative (no `BASE`) — `api()` adds `BASE` itself. Never do `f'{BASE}{WP}/…'` |
| Hardcoded state IDs | Always fetch from `/states/` — IDs differ per project |
| `{results: []}` not unwrapped | Use `results()` not `api('GET', …)` directly |
| `sequence_ids=N` paginates | Returns `{results:[]}` — always access `.results` |
| `sequence_ids=N` not filtered | Some instances ignore the filter and return the full list — always filter client-side on `i['sequence_id'] == N` |
| JSON with HTML in bash | Delegate new creation to `peaklab.plane-create-issue` |
| `POST /cycles/` fails 400 | Include `owned_by` + `project_id` in body |
| Token committed to git | Keep project `.env` gitignored; global token belongs in `~/.agents/.env` |
| Python `urllib` returns 403 | Cloudflare blocks default Python UA — `api()` now sets a browser UA, but verify if copied manually |

</gotchas>
