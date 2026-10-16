---
name: peaklab.plane-api
description: "Read or update Plane data and resolve configuration or IDs. Use peaklab.plane-create-issue for new issues."
effort: fast
allowed-tools: Bash(rtk :*), Read, Write, Skill
---

<overview>
Canonical owner of the shared Plane configuration, Python client, state resolution and metadata lookup used by every Plane workflow. Other Plane skills link here instead of restating these rules.

Routing: creating an issue belongs exclusively to `peaklab.plane-create-issue`. This skill may search for duplicates and resolve metadata for it, but never POSTs a new issue.
</overview>

<shared-scripts>
Helpers live beside this file; resolve the package's absolute directory from the loaded `SKILL.md`, not a fixed harness home, and run them from the target project's checkout so its configuration is used.

- [plane_client.py](plane_client.py): `PlaneConfigLoader` (config discovery), `PlaneProject` (URL-derived metadata, issue URLs), `PlaneClient` (auth headers, browser User-Agent, `results()` pagination). Import it rather than duplicating config or HTTP code.
- [init_project.py](init_project.py): idempotent modules/labels/cycles setup used by `peaklab.plane-init`.
- [sync_issue_link.py](sync_issue_link.py): links a Plane issue to a git branch and GitHub PR (Plane comment, marked PR body block, `.claude/plane/links/<ISSUE>.json`, kept for compatibility regardless of host).
</shared-scripts>

<configuration>
```
PLANE_TOKEN=plane_api_xxx
PLANE_PROJECT=https://HOST/WORKSPACE/projects/UUID/issues/
```

Sources, first complete one wins: project `.env` → `~/.agents/.env` → legacy `.claude/settings.local.json` (project, then home). `PLANE_TOKEN` and `PLANE_PROJECT` are always loaded together from the same source, never mixed. Keep the project `.env` gitignored and the global file `chmod 600`; never commit or print the token. When configuration is missing, report which keys are absent without exposing values.
</configuration>

<constraints>
- Run `<bootstrap>` before any API call; use Python for every call, never curl chains with JSON/HTML payloads.
- Never hardcode workspace, project, state, label or member IDs; resolve them as below.
- Never POST a new issue from this skill; delegate to `peaklab.plane-create-issue`.
</constraints>

<bootstrap>
Run once per session, replacing the placeholder with the resolved package path. Defines `api()`, `results()`, `BASE`, `WP`, `WORKSPACE`, `PROJECT_ID`.

```python
import sys
from pathlib import Path

PLANE_API_DIR = Path("<resolved directory of loaded peaklab.plane-api>")
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

`results()` follows cursor pagination and returns every row. `request()` returns one raw page, so reading `["results"]` from it silently truncates.
</bootstrap>

<full-context>
Run after `<bootstrap>` when a workflow needs the prefix, current user or state IDs. State IDs differ per project: always resolve them here.

```python
PREFIX = api('GET', f'{WP}/')['identifier']
ME_ID  = api('GET', '/users/me/')['id']

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

<id-resolution>
When a user names a label, module, state, member, type or parent, list the project resource with `results()` and match case-insensitively on the exact name or readable identifier. On zero or several matches, show the candidates and ask; never guess, drop the field silently, or create the missing resource unless asked.
</id-resolution>

<operations>
| Operation | Call |
|-----------|------|
| List issues | `results(f'{WP}/issues/')` |
| Filter by state / group | `results(f'{WP}/issues/?state__in={",".join(STARTED_IDS)}')` |
| Filter by assignee | `results(f'{WP}/issues/?assignees__in={ME_ID}')` |
| Get by sequence ID | `next(i for i in results(f'{WP}/issues/?sequence_ids={seq}') if i['sequence_id'] == seq)` |
| Create issue | Delegate to `peaklab.plane-create-issue` |
| Update / move state | `api('PATCH', f'{WP}/issues/{UUID}/', {'state': STATE_ID})` |
| Add comment | `api('POST', f'{WP}/issues/{UUID}/comments/', {'comment_html': '<p>…</p>'})` |
| Create cycle | `api('POST', f'{WP}/cycles/', {'name': …, 'start_date': …, 'end_date': …, 'owned_by': ME_ID, 'project_id': PROJECT_ID})` |

Issue selection used by `peaklab.plane-do-issue`:

```python
PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3, "none": 4, "": 5}

def fetch_issues(state_ids, assignee_id=None, per_page=100):
    path = f'{WP}/issues/?state__in={",".join(state_ids)}&per_page={per_page}'
    if assignee_id: path += f'&assignees__in={assignee_id}'
    return results(path)

def best_issue(issues, exclude_others=False):
    if exclude_others:
        issues = [i for i in issues if not i.get('assignees') or ME_ID in i['assignees']]
    return min(issues, key=lambda x: PRIORITY_ORDER.get(x.get('priority', ''), 5), default=None)

issue = best_issue(fetch_issues(STARTED_IDS + UNSTARTED_IDS, assignee_id=ME_ID)) \
    or best_issue(fetch_issues(UNSTARTED_IDS), exclude_others=True)
```
</operations>

<gotchas>
| Trap | Fix |
|------|-----|
| `f'{BASE}{WP}/…'` | `WP` is relative; `api()` prepends `BASE` itself |
| `?sequence_ids=N` ignored server-side | The full list comes back: always filter client-side on `sequence_id` |
| `POST /cycles/` returns 400 | Body needs `owned_by` and `project_id`, not just the URL path |
| `urllib` gets 403 | Cloudflare blocks the default Python UA; `PlaneClient` sets a browser UA, keep it if copying code |
</gotchas>
