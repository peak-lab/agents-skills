---
name: peaklab.improve-skill
description: Use when auditing or improving an existing agent skill or command for clarity, reliable triggering, portability, or workflow regressions.
effort: deep
---

# Improve a Skill

Improve the decisions a skill enables, not its formatting for its own sake. Treat the agent as
capable: retain instructions that add domain knowledge, prevent demonstrated failures, or
define a real contract. A shorter file is not evidence of faster or better execution.

## Scope and authority

- Audit requests are read-only. Edit only when improvement or implementation is requested.
- Read the actual file from disk; injected skill text may substitute argument placeholders.
- Resolve the selected repository and skill root first. This catalogue uses
  `skills/<name>/SKILL.md`. Other layouts are possible; an empty match is an error, not a pass.
- Preserve public names, invocation policies, user choices and unrelated edits. A change to
  flags, defaults, results, approvals or side effects must be intentional and checked through callers.
- Use the host's available tools. Slash commands, skill tools and direct instruction reading
  are alternative invocation mechanisms; none grants extra authority.

## Inspect the behavior before editing

Read the entrypoint, the resources relevant to the requested modes, and direct callers.
For a batch, inspect shared contracts once and group related callers instead of rewriting each
in isolation. Use the repository's dependency manifest and tests when available.

Check in this order; mark non-applicable items N/A rather than adding boilerplate:

| Priority | Check | Evidence |
|---|---|---|
| Correctness | Capability and triggers match actual behavior | A realistic request and its expected result |
| Boundaries | Scope, approvals, destructive actions and stopping conditions remain explicit | Positive and refusal/stop cases |
| Composition | One owner per action; called skills/resources are available | Dependency closure and resolved links |
| Portability | No private paths, implicit global configuration, unavailable agents or hidden build step | Fresh installation in the supported host |
| Verification | The workflow distinguishes proposed, executed, validated and externally confirmed results | Tests or observed artifacts bound to the examined revision |
| Clarity | Essential decisions remain in the entrypoint; optional detail loads only when relevant | Trace which files an ordinary task needs |
| Efficiency | No duplicated analysis, mandatory reviewer quotas or generic model advice | Same useful outcome with less unnecessary work |

## Authoring conventions

- Keep name and description precise enough to distinguish neighboring skills. Descriptions
  explain capability and trigger; exclusions are useful only for likely routing confusion.
- Preserve this catalogue's `peaklab.` names and matching directory names. New names must work
  with the supported installers; do not rename public packages merely to satisfy a generic linter.
- Shared effort expresses `fast`, `standard` or `deep` intent where used. Concrete models belong
  in native agent definitions, not shared skill metadata.
- Agent-facing instructions are English; responses follow the user's language.
- Use clear Markdown or semantic XML. Do not convert between them without a concrete benefit.
- Keep substantial mode-specific procedures in linked references. Do not split a short,
  self-contained skill or add a required read that provides no new information.
- Explain fragile constraints briefly. Use examples where they disambiguate behavior, not
  to prescribe one universal stack, number of steps or output template.
- Distinguish a command file from a skill by its location and frontmatter; both can contain
  argument placeholders, so placeholders alone do not identify the type.

## Executable resources and credentials

Reuse tested service helpers. New repository tooling follows the project's TypeScript/Bun
conventions; do not rewrite functioning Python helpers solely for language uniformity.
Whatever the language, build structured payloads with its JSON serializer, preserve exit codes,
and make required runtimes/dependencies explicit. An installed skill must not depend on a build
artifact that the installer does not ship. Resolve logical resource identifiers before execution.

Keep the service loader's documented credential precedence and atomic host/token selection.
Do not replace it with a generic per-key fallback, source env files as shell code, log secret
values, hardcode project/state IDs, or commit credentials. For a genuinely new integration,
define and test precedence rather than copying an unrelated service's loader.

## Apply the smallest useful change

Fix behavior and caller inconsistencies before polishing prose. Remove duplication only after
identifying its canonical owner. Preserve recovery paths, stale-evidence checks and explicit
authorization even when they add length. Stop when no actionable issue remains.

Do not copy popular skills wholesale. Inspect the upstream source and license, verify the idea
fits this catalogue, and record provenance for any copied/adapted material. Popularity and
security badges do not establish task quality or authorize installation.

## Verify

1. Run repository discovery/link/metadata checks and tests for changed helpers.
2. Trace changed modes through callers, including missing tools/configuration and partial failure.
3. For substantial behavior changes, try realistic prompts with only the skill and raw task
   artifacts in a disposable workspace. Include one intended use and one near-miss or stop case.
   Do not expose expected answers to the evaluating agent.
4. Compare observable decisions/results with the previous skill or a no-skill baseline when
   claiming improvement. Use the same task and environment; record tool availability and revision.
5. Separate static checks, helper tests, dry-run decisions and real task execution in the report.
   Do not claim model correctness, measured speedups or universal safety from text assertions.

## Report

Give the actionable findings or applied changes, preserved capabilities, intentional behavior
changes, validation performed and remaining limits. Report a size delta only as size, never as
a measured performance gain. Do not publish, install globally, commit or push unless requested.
