# PeakLab Agent Skills

Reusable skills for Codex, Claude Code, and other agents that support the Agent Skills format.
Use them to implement changes, review code, handle issues, and prepare releases.

A skill gives your agent a repeatable workflow. Your project keeps its own rules, toolchain,
and credentials. Native subagents are optional.

## Get started

With Node 24+ and your coding agent installed, run this from your project:

```bash
npx skills add peak-lab/agents-skills --skill apex review-code tdd handoff --agent codex
```

For Claude Code, replace `codex` with `claude-code`. Add `-g` only for a user-wide installation.
This starter set needs no service credentials or native agents.

Open a new agent session in the project, then ask:

> Use apex to fix [bug]. Acceptance: [expected behavior]. Run the relevant tests. Do not commit, push or open a PR.

Supply a reproducible bug and an observable result. Then try:

> Use review-code to review these local changes, including new source files. Do not edit.

Use `tdd` when you want test-first work and `handoff` when another session needs to continue.
You do not need to run all four skills in sequence.

## Choose your next task

| I want to… | Use | Setup |
|---|---|---|
| Implement and test a change | `apex` | Included above |
| Review code or a PR | `review-code` | Included above; GitHub CLI for remote PRs |
| Work test-first | `tdd` | Included above |
| Continue in another session | `handoff` | Included above |
| Implement a GitHub issue | `peaklab.gh-do-issue` | [Install GitHub workflow](docs/installation.md#github-issues) |
| Implement a Plane issue | `peaklab.plane-do-issue` | [Install Plane workflow](docs/installation.md#plane-issues) |
| Fix a GlitchTip error | `peaklab.glitchtip-do-issue` | [Install GlitchTip workflow](docs/installation.md#glitchtip-errors) |
| Finalize an existing PR | `peaklab.ship-pr` | [Install GitHub workflow](docs/installation.md#github-issues) |

Issue workflows stop at a reviewed PR by default. Request merging or delivery explicitly.
No deferred monitoring is created implicitly. Keep credentials in environment variables or
gitignored configuration. See [workflow options and authorization](docs/team-workflows.md#workflow-options-and-authorization).

For other tasks, see [examples and prerequisites](docs/catalogue.md).

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
| Documentation and context | `find-docs`, `humanize`, `handoff`, `peaklab.sync-ai-docs`, `peaklab.improve-skill`, `context-optimizer` |
| Agent coordination | `orchestration`, `orca-cli`, `computer-use` |

Service skills need their service credentials. Orca skills need the Orca runtime; QA skills
need qa-tracker, and app scaffolding needs the project generator. Check the selected skill first.

</details>

## Using the skills

- [Install, update, and troubleshoot](docs/installation.md)
- [Choose a skill by task](docs/catalogue.md)
- [Work as a team](docs/team-workflows.md)
- [Advanced: plugins and distribution](docs/distribution.md)
- [Advanced: optional native agents](docs/agents.md)

## Development

To change this catalogue, follow the [contributor guide](docs/contributing.md), including its
[discovery, portability, and test commands](docs/contributing.md#validation).
It also links the templates, workflow contracts, evaluations, and intake requirements.

Seven complementary engineering skills are adapted from Matt Pocock's MIT-licensed catalogue.
See [third-party notices](THIRD_PARTY_NOTICES.md) for attribution, source revision, and license.
