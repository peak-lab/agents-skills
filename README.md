# PeakLab Agent Skills

Reusable skills for Codex, Claude Code, and other agents that support the Agent Skills format.
Use them to implement changes, review code, handle issues, and prepare releases.

This repository provides instructions and helper scripts. Your project keeps its own rules,
toolchain, and credentials. Native agent definitions are optional.

## Get started

Run this from the project where you want to use the skills:

```bash
npx skills add peak-lab/agents-skills --skill apex review-code tdd handoff --agent codex
```

For Claude Code, use `--agent claude-code`. Add `-g` only for a user-wide installation.
This starter set needs no service credentials or native agents.

Then ask your agent:

> Use apex to fix [bug]. Acceptance: [expected behavior]. Run the relevant tests. Do not commit, push or open a PR.

See the [first-task walkthrough](docs/team-workflows.md#first-task) for an example workflow.

## Choose a skill

| Task | Skill |
|---|---|
| Implement and test a change | `apex` |
| Review code or a PR | `review-code` |
| Work test-first | `tdd` |
| Prepare a handoff to another session | `handoff` |
| Implement a GitHub issue | `peaklab.gh-do-issue` |
| Implement a Plane issue | `peaklab.plane-do-issue` |
| Fix a GlitchTip error | `peaklab.glitchtip-do-issue` |
| Review and finalize an existing PR | `peaklab.ship-pr` |

You do not need to run every skill in sequence. Choose the one that matches your starting point.

<details>
<summary>Full catalogue</summary>

Each package lives in [skills/](skills/); its `SKILL.md` describes usage and prerequisites.

| Area | Skills |
|---|---|
| Implementation | `apex`, `debug-code`, `refactor`, `clean-code`, `tdd`, `optimize-prisma-query` |
| Review and QA | `review-code`, `qa-session`, `peaklab.fix-qa-bug` |
| Planning | `domain-modeling`, `to-spec`, `to-tickets`, `wayfinder`, `grilling`, `ultrathink`, `peaklab.client-audit` |
| GitHub delivery | `peaklab.gh-create-issue`, `peaklab.gh-do-issue`, `peaklab.ship-pr`, `peaklab.update-deps` |
| Plane | `peaklab.plane-api`, `peaklab.plane-create-issue`, `peaklab.plane-do-issue`, `peaklab.plane-init`, `peaklab.plane-status`, `peaklab.plane-archive`, `peaklab.plane-ship-watch` |
| Errors and infrastructure | `peaklab.glitchtip-do-issue`, `peaklab.track-error`, `peaklab.coolify-api`, `peaklab.infra-config`, `peaklab.uptime-kuma` |
| UI and scaffolding | `frontend-design`, `shadcn`, `create-peaklab-app` |
| Documentation and context | `find-docs`, `humanize`, `handoff`, `peaklab.sync-ai-docs`, `peaklab.improve-skill` |
| Agent coordination | `orchestration`, `orca-cli`, `computer-use` |

Service skills need their service credentials. Orca skills need the Orca runtime; QA skills
need qa-tracker, and app scaffolding needs the project generator. Check the selected skill first.

</details>

## Install more or update

Browse the available skills interactively:

```bash
npx skills add peak-lab/agents-skills
```

Some skills call other skills. Selective installation does not install those dependencies
automatically. From a local checkout of this catalogue, preview the complete selection:

```bash
bun scripts/skill-context.ts --skill peaklab.gh-do-issue
```

The command prints the required packages and an installation command; it changes nothing.
See the [dependency guide](docs/context-budget.md) or start with a [profile](skill-profiles.json).

To update, rerun your installation command. Preserve local customizations first. For updates
with backups and conflict checks, use [canonical synchronization](docs/skill-sync.md).
For a repeatable team setup, install from a local checkout of an agreed commit.

Updating this repository does not update installed copies. Plugin installation and optional
native agents are covered in the [distribution guide](docs/distribution.md).

## Before running issue workflows

- GitHub, Plane, and GlitchTip workflows stop at a reviewed PR by default. Request delivery
  explicitly or use `--wait-merge`. `--no-merge` stops at the PR; drafts never merge.
- Use `--no-auto` for plan approval. `--no-tdd` disables test-first work, not validation.
- A merged fix is not proof of deployment. GlitchTip resolution needs verified deployment
  and regression evidence in the affected environment.
- No deferred monitoring is created implicitly. `--async-merge` uses a live session worker
  only when the host supports it.
- Keep credentials in environment variables or gitignored configuration, never in this catalogue.
  Deploys, merges, deletes, restarts, and issue updates require user intent; destructive actions
  require confirmation at the point of risk.

See the [team workflow guide](docs/team-workflows.md) for ownership, review, and handoff rules.

## Documentation

- [Installation channels and plugins](docs/distribution.md)
- [Optional native agents](docs/agents.md)
- [Skill synchronization and backups](docs/skill-sync.md)
- [Shared project-rule templates](docs/rule-templates.md)
- [Workflow contract scenarios](docs/contract-scenarios.md)
- [Skill quality and evaluation](docs/skill-quality.md)
- [Controlled evaluation runner](docs/skill-evaluations.md)

## Development

Repository tooling uses Bun; the packaged CLI targets Node 24+. Python helpers target Python 3.13+.

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build
node dist/cli.js --help
bun run smoke:package
```

Validate discovery, portability, and bundled helpers:

```bash
npx skills add . --list
bun run check:portability
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 -m unittest discover -s skills/apex -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-do-issue -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-api -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-create-issue/scripts -p 'test_*.py'
python3 -m py_compile skills/peaklab.coolify-api/scripts/coolify.py skills/peaklab.plane-api/*.py
bun run eval:check
```

Keep packages in `skills/<name>/SKILL.md` and declare cross-skill dependencies in
[skill-dependencies.json](skill-dependencies.json). Preserve public names and review the
[contract scenarios](docs/contract-scenarios.md) when changing workflow behavior.
Static checks and helper tests do not prove model behavior; model evaluations require explicit
execution and bounded budgets. Publishing the native-agent CLI is a separate release step.

Seven complementary engineering skills are adapted from Matt Pocock's MIT-licensed catalogue.
See [third-party notices](THIRD_PARTY_NOTICES.md) for attribution, source revision, and license.
