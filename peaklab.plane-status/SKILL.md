---
name: "peaklab.plane-status"
description: "Use when the user asks for a quick Plane board/status overview, current in-progress tickets, backlog priorities, or next Plane issues without opening the Plane app."
effort: fast
allowed-tools: "Bash(python3:*), Read"
argument-hint: "[--mine] [--limit N]"
---

<overview>
Show a compact Plane board snapshot using the shared `peaklab.plane-api` client and dynamic state resolution.
</overview>

<constraints>
- Load Plane config through `peaklab.plane-api`; never hardcode tokens, workspace IDs, project IDs, or state IDs.
- Use Python API helpers, not curl chains.
- Do not mutate Plane state.
- Keep output compact: grouped board counts plus top priority next issues.
</constraints>

<workflow>
1. Import `~/.agents/skills/peaklab.plane-api/plane_client.py`.
2. Fetch project metadata and states.
3. Resolve unstarted/backlog, started, and review states dynamically by `group` and `name`.
4. Fetch active issues with pagination unwrapped through `client.results()`.
5. Print grouped status and top backlog issues by priority.
</workflow>

<python_template>
```python
import sys
sys.path.insert(0, "/Users/faharihamadasidi/.agents/skills/peaklab.plane-api")
from plane_client import load_plane_client

client = load_plane_client()
project = client.request("GET", f"{client.project.path}/")
states = client.results(f"{client.project.path}/states/")
issues = client.results(f"{client.project.path}/issues/?per_page=100")
```
</python_template>

<output_format>
```text
BOARD STATUS
Backlog      [N] PUSHR-123 - Title (high)
In Progress  [N] PUSHR-124 - Title (medium)
In Review    [N] PUSHR-125 - Title (low)

Next up
1. PUSHR-126 - Title (urgent)
2. PUSHR-127 - Title (high)
3. PUSHR-128 - Title (medium)
```
</output_format>

<gotchas>
| Trap | Fix |
|---|---|
| Plane API ignores a filter | Fetch a bounded page and filter client-side. |
| State names differ by project | Use state `group` first, state name second. |
| Missing credentials | Report the missing config path; do not print token values. |
</gotchas>
