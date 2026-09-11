# PeakLab Agent Skills

Reusable workflows for Codex, Claude Code, and other agents that support the Agent Skills format.
The repository contains instructions and helper scripts: no production credentials, private page IDs,
internal hostnames, or customer data.

Each directory under [`skills/`](skills/) is a selectable skill package; orchestrators also require
their declared dependencies. Skills cover implementation and
review, GitHub and Plane delivery, GlitchTip incident handling, and PeakLab infrastructure operations.

## Install

Start with four complementary skills, installed in the current project. Select your actual harness:

```bash
npx skills add peak-lab/agents-skills --skill apex review-code tdd handoff --agent codex
```

Use `--agent claude-code` for Claude Code. This starter set needs no service credentials or
native agent installation. See the [first-task walkthrough](docs/team-workflows.md#first-task).

Select one skill with `npx skills add` (this does not install its dependencies automatically):

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
npx skills add peak-lab/agents-skills@domain-modeling -y
npx skills add peak-lab/agents-skills@tdd -y
```

Install every skill by selecting all entries interactively:

```bash
npx skills add peak-lab/agents-skills
```

For a non-interactive installation, select every skill explicitly for the target
harness. For example, with Claude Code:

```bash
npx skills add peak-lab/agents-skills --skill '*' --agent claude-code --copy -y
```

Re-run the same command to update an installed skill. Install the whole repository for orchestrated
workflows so their called skills are available too.
Add `-g` only for an intentional personal global installation. For a repeatable team rollout,
install from a local checkout of an agreed, reviewed commit; a moving remote branch is not a pin.

## Structure and distribution

Skills are published from [`skills/`](skills/); each package keeps its `SKILL.md` and local
resources together. Native agent definitions are maintained separately for Claude Code and Codex.
For installation channels, plugin use, and maintenance, see the
[distribution guide](docs/distribution.md). For the native agent layout and installation, see the
[agent guide](docs/agents.md).

For shared setup, ownership and the smallest useful workflow, see the
[team guide](docs/team-workflows.md). It explains which entry point to use, what callers pass,
and which runtime-specific integrations are optional.

The sync-ai-docs skill also bundles 30 reviewed stack-rule templates and a read-only TypeScript/Bun
renderer. See [shared rule templates](docs/rule-templates.md) to regenerate project rules without
depending on someone's global configuration.

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
| `review-code` | Reviewing code or a PR with risk-appropriate review depth and optional independent specialists. |
| `domain-modeling` | Maintaining a precise business glossary and durable architectural decisions. |
| `to-spec` | Turning established context into an implementation-ready product specification. |
| `to-tickets` | Breaking approved work into dependency-aware, vertical-slice tickets. |
| `wayfinder` | Mapping large, uncertain initiatives through decision tickets before delivery. |
| `grilling` | Stress-testing plans and decisions with a structured interview. |
| `handoff` | Creating a concise, redacted continuation brief for the next agent session. |
| `tdd` | Applying behavior-focused red-green-refactor development. |
| `peaklab.glitchtip-do-issue` | Fixing GlitchTip root-cause clusters through reviewed PRs, with explicit delivery and evidence-based error resolution. |
| `peaklab.coolify-api` | Managing Coolify deployments, applications, databases, services, servers, logs, env keys, and lifecycle operations. |
| `peaklab.plane-api` | Reading Plane configuration, metadata, issue lists, state transitions, and shared Plane API helpers. |
| `peaklab.client-audit` | Auditing a client project before quoting or starting work. |
| `peaklab.gh-create-issue` | Creating comprehensive GitHub issues from descriptions, bug reports, feature requests, code context, or images. |
| `peaklab.gh-do-issue` | Resolving a GitHub issue end to end through implementation and PR shipping. |
| `peaklab.fix-glitchtip` | Fixing GlitchTip errors end to end and shipping the fix. |
| `peaklab.improve-skill` | Auditing and improving an agent skill or command against the authoring conventions. |
| `peaklab.infra-config` | Discovering and writing local infrastructure configuration for a project. |
| `peaklab.plane-create-issue` | Creating or drafting a validated Plane work item. |
| `peaklab.plane-do-issue` | Implementing one Plane issue through a reviewed PR, with explicit optional delivery. |
| `peaklab.plane-init` | Bootstrapping a new Plane project with its standard modules, labels, and weekly cycles. |
| `peaklab.plane-status` | Reading a compact Plane board snapshot: in-progress work, backlog priorities, next issues. |
| `peaklab.plane-archive` | Archiving completed Plane issues, with a dry run and an age threshold. |
| `peaklab.plane-ship-watch` | Checking a reviewed Plane-linked PR, merging its verified head, and syncing Plane; returning code/rebase work to its owner. |
| `peaklab.ship-pr` | Finalizing a branch into a reviewed, clean, merged PR. |
| `peaklab.sync-ai-docs` | Syncing AGENTS.md, Claude compatibility docs, Codex rules, and shared agent assets. |
| `peaklab.track-error` | Linking one GlitchTip error to a GitHub issue and reviewed fix, with optional delivery and evidence-gated resolution. |
| `peaklab.update-deps` | Handling dependency updates, Dependabot PRs, update PRs, and CI follow-up. |
| `peaklab.uptime-kuma` | Managing Uptime Kuma monitors, status pages, maintenance windows, and uptime checks. |

## Composition

Several skills call others:

- `peaklab.gh-do-issue`, `peaklab.plane-do-issue`, `peaklab.fix-glitchtip`, and `peaklab.glitchtip-do-issue` use `apex` during implementation.
- GitHub and GlitchTip issue adapters share the execution contract bundled inside
  `skills/peaklab.gh-do-issue/references/execution.md`; install that dependency with the GlitchTip skill.
- All three GlitchTip entry points share configuration/evidence/resolution rules in
  `skills/peaklab.glitchtip-do-issue/references/glitchtip-contract.md`.
- `peaklab.plane-*` skills read shared configuration through `peaklab.plane-api`.
- `peaklab.client-audit` delegates code-quality analysis to `review-code`.
- `peaklab.glitchtip-do-issue` and `peaklab.gh-do-issue` can use the harness agents `issue-resolver`, `issue-resolver-deep`,
  `issue-qa-reviewer`, `code-reviewer`, and `issue-ship-watcher` when they are installed. Their
  documented inline fallback handles one issue or cluster when those agent definitions are unavailable.

Installing a caller without its called skills leaves dangling references. Install the complete
repository for unattended workflows, then provision any harness-specific agent definitions described
by your agent configuration.

`skill-dependencies.json` documents composition; it is not an installer hook. For a selective
installation, install every dependency transitively, preserving each package's `references/`
and `scripts/` directories alongside the other skill packages.

The repository contains every skill invoked by another bundled skill. Harness agents are optional:
the GitHub and GlitchTip workflows fall back to their documented inline mode when those definitions
are unavailable.

## Complementary engineering workflow

`apex` remains the implementation workflow. It reuses a caller's current analysis, keeps one plan
of observable behavior slices, and runs verification appropriate to the patch. Its legacy flags
and step filenames remain available; optional paths load only when needed. Use
`domain-modeling`, `to-spec`, `to-tickets`,
`wayfinder`, `grilling`, `handoff`, and `tdd` independently when their focused workflow fits the
stage of work better.

The seven complementary skills are adapted from Matt Pocock's MIT-licensed
[`mattpocock/skills`](https://github.com/mattpocock/skills) catalogue. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for the pinned source revision and full notice.

[`skill-dependencies.json`](skill-dependencies.json) is the source of truth for composition.
`bun run check:portability` verifies YAML metadata, callers/dependencies, matching package names,
nested Markdown resources and local links, declared cross-skill links, legacy names,
workstation-specific home paths and direct execution of unresolved skill URIs. Use real Markdown
links for required cross-skill references so they can be checked against the manifest. The checker
does not infer every dependency from prose, execute the workflows or prove model behavior.

## Issue workflow behavior

- GitHub, Plane and GlitchTip issue workflows stop at a reviewed PR by default. Request delivery
  explicitly, or use `--wait-merge`. `--no-merge` always stops at the PR; drafts never merge.
- `--async-merge` requests a live session worker only when the host supports it. It does not
  create deferred monitoring, scheduled wake-ups or recurring jobs.
- `--no-auto` and `--no-tdd` are passed explicitly to APEX as `-A` and `-D`. Disabling TDD does
  not disable validation. Standalone APEX adapts test-first work to the behavior under change.
- One owner records the official review with the examined revision. Delivery reuses current
  evidence and renews it after relevant changes, rather than unconditionally reviewing twice.
- GlitchTip distinguishes reviewed PR, merged fix, deployed release and verified regression.
  Resolution requires evidence for the affected environment; merge alone is insufficient.
- These are repository artifacts. Updating the catalogue does not overwrite installed copies
  under `~/.agents/skills` or another harness's skill directory; reinstall after delivery.

## Naming

Each skill has one canonical name: the package directory, `SKILL.md` name, dependency manifest
and direct local installation use the same identifier. There is no separate local alias scheme.

- PeakLab workflows: `peaklab.<domain>-<action>`, for example `peaklab.gh-do-issue`,
  `peaklab.plane-do-issue`, and `peaklab.glitchtip-do-issue`.
- General-purpose skills keep their established names: `apex`, `review-code`, `tdd`, etc.

Use these exact names locally and when sharing the catalogue. The portability check rejects
legacy workflow names and directory/frontmatter mismatches. Existing personal installations
are not renamed automatically by editing this repository.

Claude plugins add a runtime namespace around the same canonical name; this is not another
package name or a local alias. Prefer direct installation for identical invocation identifiers
across hosts. See [distribution channels](docs/distribution.md).

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

Develop and validate the native agent CLI with Bun (Node 24+ runs the built npm executable):

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
node dist/cli.js --help
bun run smoke:package
```

The TypeScript CLI replaces the Python agent installer, preserving its version-1 update state.
It does not replace the Python helpers bundled in the individual skills. npm publication of
`@peak-lab/agents` is a separate, explicit release step; see the [agent guide](docs/agents.md).

Validate skill discovery and Python helper scripts:

```bash
npx skills add . --list
bun run check:portability
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 -m unittest discover -s skills/apex -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-do-issue -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-api -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-create-issue/scripts -p 'test_*.py'
python3 -m py_compile skills/peaklab.coolify-api/scripts/coolify.py skills/peaklab.plane-api/*.py
```

Also review the [contract scenarios](docs/contract-scenarios.md) when changing orchestration.

The [controlled skill evaluation runner](docs/skill-evaluations.md) adds 12 behavior cases and
20 routing queries. `bun run eval:check` validates them without invoking a model. Claude/Codex
evaluations require explicit `--execute`, host/model selection and bounded budgets; they run
against simulated actions and fixtures, not production services or native skill discovery.
Helper unit tests, static contract guards and semantic scenario review serve different purposes.
See [skill quality](docs/skill-quality.md) for upstream inspiration and behavior evaluation cases.

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
