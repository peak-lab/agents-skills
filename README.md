# PeakLab Agent Skills

Reusable workflows for Codex, Claude Code, and other agents that support the Agent Skills format.
The repository contains sanitized instructions only: no production credentials, private page IDs,
internal hostnames, or customer data.

Each top-level directory is an independently installable skill. Skills cover implementation and
review, GitHub and Plane delivery, GlitchTip incident handling, and PeakLab infrastructure operations.

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
npx skills add peak-lab/agents-skills@peaklab.glitchtip-do-issue -y
```

Install every skill by selecting all entries interactively:

```bash
npx skills add peak-lab/agents-skills
```

For a reproducible non-interactive installation, select every skill explicitly for the target
harness. For example, with Claude Code:

```bash
npx skills add peak-lab/agents-skills -g --skill '*' --agent claude-code --copy -y
```

Re-run the same command to update an installed skill. Install the whole repository for orchestrated
workflows so their called skills are available too.

## Common workflows

| Goal | Recommended skill |
|---|---|
| Implement and validate a code change | `apex` |
| Review a branch or pull request | `review-code` |
| Create a comprehensive GitHub issue | `peaklab.gh-create-issue` |
| Resolve one or more GitHub issues in isolated worktrees | `peaklab.gh-do-issue` |
| Drain a GlitchTip inbox sequentially in the current checkout | `peaklab.fix-glitchtip` |
| Resolve GlitchTip root-cause clusters using isolated worktrees and QA gates | `peaklab.glitchtip-do-issue` |
| Implement a Plane issue and follow its delivery lifecycle | `peaklab.plane-do-issue` |

## Available Skills

| Skill | Use when |
|---|---|
| `apex` | Implementing a feature or fix through the Analyze-Plan-Execute-eXamine workflow with validation. |
| `review-code` | Reviewing code or a PR through a multi-agent deep review focused on high-impact issues. |
| `peaklab.glitchtip-do-issue` | Resolving one or more GlitchTip root-cause clusters through isolated worktrees, QA gates, sequential merge, and post-merge resolution. |
| `peaklab.coolify-api` | Managing Coolify deployments, applications, databases, services, servers, logs, env keys, and lifecycle operations. |
| `peaklab.plane-api` | Reading Plane configuration, metadata, issue lists, state transitions, and shared Plane API helpers. |
| `peaklab.client-audit` | Auditing a client project before quoting or starting work. |
| `peaklab.gh-create-issue` | Creating comprehensive GitHub issues from descriptions, bug reports, feature requests, code context, or images. |
| `peaklab.gh-do-issue` | Resolving a GitHub issue end to end through implementation and PR shipping. |
| `peaklab.fix-glitchtip` | Fixing GlitchTip errors end to end and shipping the fix. |
| `peaklab.improve-skill` | Auditing and improving an agent skill or command against the authoring conventions. |
| `peaklab.infra-config` | Discovering and writing local infrastructure configuration for a project. |
| `peaklab.plane-create-issue` | Creating or drafting a validated Plane work item. |
| `peaklab.plane-do-issue` | Implementing one Plane issue through PR creation and async shipping handoff. |
| `peaklab.plane-init` | Bootstrapping a new Plane project with its standard modules, labels, and weekly cycles. |
| `peaklab.plane-status` | Reading a compact Plane board snapshot: in-progress work, backlog priorities, next issues. |
| `peaklab.plane-archive` | Archiving completed Plane issues, with a dry run and an age threshold. |
| `peaklab.plane-ship-watch` | Watching a Plane-linked PR through CI, rebase/conflict handling, merge, and Plane sync. |
| `peaklab.ship-pr` | Finalizing a branch into a reviewed, clean, merged PR. |
| `peaklab.sync-ai-docs` | Syncing AGENTS.md, Claude compatibility docs, Codex rules, and shared agent assets. |
| `peaklab.track-error` | Tracking GlitchTip errors, creating linked work, fixing code, and resolving issues. |
| `peaklab.update-deps` | Handling dependency updates, Dependabot PRs, update PRs, and CI follow-up. |
| `peaklab.uptime-kuma` | Managing Uptime Kuma monitors, status pages, maintenance windows, and uptime checks. |

## Composition

Several skills call others:

- `peaklab.gh-do-issue`, `peaklab.fix-glitchtip`, and `peaklab.glitchtip-do-issue` use `apex` during implementation.
- `peaklab.plane-*` skills read shared configuration through `peaklab.plane-api`.
- `peaklab.client-audit` delegates code-quality analysis to `review-code`.
- `peaklab.glitchtip-do-issue` and `peaklab.gh-do-issue` can use the harness agents `issue-resolver`, `issue-resolver-deep`,
  `issue-qa-reviewer`, `code-reviewer`, and `issue-ship-watcher` when they are installed. Their
  documented inline fallback handles one issue or cluster when those agent definitions are unavailable.

Installing a caller without its called skills leaves dangling references. Install the complete
repository for unattended workflows, then provision any harness-specific agent definitions described
by your agent configuration.

The repository contains every skill invoked by another bundled skill. Harness agents are optional:
the GitHub and GlitchTip workflows fall back to their documented inline mode when those definitions
are unavailable.

[`skill-dependencies.json`](skill-dependencies.json) is the source of truth for composition.
`python3 scripts/check_portability.py` verifies that every caller and dependency exists, every skill
name matches its directory, installed-skill paths resolve, legacy names are absent from skill files,
and no workstation-specific home path was committed.

## Naming

Public names avoid `:` because `npx skills add owner/repo@skill` treats the value after `@` as the skill selector. Colon-based local names were converted to installable dot or hyphen names:

| Local style | Public skill |
|---|---|
| `glitchtip-do-issue` | `peaklab.glitchtip-do-issue` |
| `peaklab.do-issue` | `peaklab.gh-do-issue` |
| `peaklab.create-issue` | `peaklab.gh-create-issue` |
| `plane:create-issue` | `peaklab.plane-create-issue` |
| `plane:do-issue` | `peaklab.plane-do-issue` |
| `plane:ship-watch` | `peaklab.plane-ship-watch` |
| `peaklab:sync-ai-docs` | `peaklab.sync-ai-docs` |
| `peaklab:improve-skill` | `peaklab.improve-skill` |
| `plane:status` | `peaklab.plane-status` |
| `plane:archive` | `peaklab.plane-archive` |

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
GLITCHTIP_ORG=example-org
UPTIME_KUMA_URL=https://monitoring.example.com
UPTIME_KUMA_TOKEN=...
```

For GlitchTip workflows, set `GLITCHTIP_URL`, `GLITCHTIP_TOKEN`, and `GLITCHTIP_ORG` for the
organization slug used by your instance. The skills validate access with a read-only API request before retrieving issue data.
Keep credentials in environment variables or gitignored local configuration.

## Safety

- External side effects such as deploys, merges, deletes, restarts, and issue updates require explicit user intent.
- Destructive actions require point-of-risk confirmation.
- Scripts redact token, secret, password, and key-shaped values before printing where possible.
- Public examples use `example.com`, fake UUIDs, and placeholder environment variables.

## Development

Validate skill discovery and Python helper scripts:

```bash
npx skills add . --list
python3 scripts/check_portability.py
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
