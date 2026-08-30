# PeakLab Agent Skills

Reusable agent skills used by PeakLab workflows. The repository is intentionally public and contains sanitized instructions only: no production tokens, private page IDs, internal hostnames, or customer data.

## Install

Install one skill with `npx skills add`:

```bash
npx skills add peak-lab/agents-skills@peaklab.ship-pr -y
```

Examples:

```bash
npx skills add peak-lab/agents-skills@peaklab.coolify-api -y
npx skills add peak-lab/agents-skills@peaklab.plane-api -y
npx skills add peak-lab/agents-skills@peaklab.plane-do-issue -y
npx skills add peak-lab/agents-skills@peaklab.plane-ship-watch -y
npx skills add peak-lab/agents-skills@peaklab.sync-ai-docs -y
```

Install every skill by selecting all entries interactively:

```bash
npx skills add peak-lab/agents-skills
```

## Available Skills

| Skill | Use when |
|---|---|
| `peaklab.coolify-api` | Managing Coolify deployments, applications, databases, services, servers, logs, env keys, and lifecycle operations. |
| `peaklab.plane-api` | Reading Plane configuration, metadata, issue lists, state transitions, and shared Plane API helpers. |
| `peaklab.client-audit` | Auditing a client project before quoting or starting work. |
| `peaklab.create-issue` | Creating comprehensive GitHub issues from descriptions, bug reports, feature requests, code context, or images. |
| `peaklab.do-issue` | Resolving a GitHub issue end to end through implementation and PR shipping. |
| `peaklab.fix-glitchtip` | Fixing GlitchTip errors end to end and shipping the fix. |
| `peaklab.infra-config` | Discovering and writing local infrastructure configuration for a project. |
| `peaklab.plane-create-issue` | Creating or drafting a validated Plane work item. |
| `peaklab.plane-do-issue` | Implementing one Plane issue through PR creation and async shipping handoff. |
| `peaklab.plane-ship-watch` | Watching a Plane-linked PR through CI, rebase/conflict handling, merge, and Plane sync. |
| `peaklab.ship-pr` | Finalizing a branch into a reviewed, clean, merged PR. |
| `peaklab.sync-ai-docs` | Syncing AGENTS.md, Claude compatibility docs, Codex rules, and shared agent assets. |
| `peaklab.track-error` | Tracking GlitchTip errors, creating linked work, fixing code, and resolving issues. |
| `peaklab.update-deps` | Handling dependency updates, Dependabot PRs, update PRs, and CI follow-up. |
| `peaklab.uptime-kuma` | Managing Uptime Kuma monitors, status pages, maintenance windows, and uptime checks. |

## Naming

Public names avoid `:` because `npx skills add owner/repo@skill` treats the value after `@` as the skill selector. Colon-based local names were converted to installable dot or hyphen names:

| Local style | Public skill |
|---|---|
| `plane:create-issue` | `peaklab.plane-create-issue` |
| `plane:do-issue` | `peaklab.plane-do-issue` |
| `plane:ship-watch` | `peaklab.plane-ship-watch` |
| `peaklab:sync-ai-docs` | `peaklab.sync-ai-docs` |

## Configuration

Skills that call external services expect credentials from gitignored local files or environment variables. Do not commit real values.

Common variables:

```dotenv
COOLIFY_URL=https://coolify.example.com/api/v1
COOLIFY_TOKEN=...
PLANE_PROJECT=https://plane.example.com/workspace/projects/project-id/issues/
PLANE_TOKEN=...
GLITCHTIP_URL=https://glitchtip.example.com
GLITCHTIP_TOKEN=...
UPTIME_KUMA_URL=https://monitoring.example.com
UPTIME_KUMA_TOKEN=...
```

## Safety

- External side effects such as deploys, merges, deletes, restarts, and issue updates require explicit user intent.
- Destructive actions require point-of-risk confirmation.
- Scripts redact token, secret, password, and key-shaped values before printing where possible.
- Public examples use `example.com`, fake UUIDs, and placeholder environment variables.

## Development

Validate Python helper scripts:

```bash
python3 -m py_compile peaklab.coolify-api/scripts/coolify.py peaklab.plane-api/*.py
cd peaklab.plane-api && python3 -m unittest test_plane_client.py
```

Check for accidental private references before publishing:

```bash
python3 - <<'PY'
from pathlib import Path
import re
patterns = re.compile(r'internal-host|BEGIN .*PRIVATE KEY|gh[pousr]_', re.I)
for path in Path('.').rglob('*'):
    if path.is_file() and '.git' not in path.parts:
        text = path.read_text(errors='ignore')
        if patterns.search(text):
            print(path)
PY
```
