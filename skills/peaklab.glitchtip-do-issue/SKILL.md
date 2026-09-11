---
name: peaklab.glitchtip-do-issue
description: Use when the user asks to fix GlitchTip errors as root-cause clusters, with isolated implementation and reviewed PRs.
effort: deep
argument-hint: "[id|url...] [--project SLUG] [--level fatal|error|warning] [--swarm [N]] [--limit N] [--base BRANCH] [--draft] [--no-auto] [--no-tdd] [--async-merge | --wait-merge | --no-merge] [--no-resolve] [--no-subagent]"
---

# GlitchTip Issue Delivery

One demonstrated root cause covering one or more GlitchTip IDs is one unit of work.
Use this workflow for isolated fixes or bounded batches. `peaklab.fix-glitchtip` owns an
inline inbox drain; `peaklab.track-error` owns an error needing a GitHub issue as its record.

Before implementation, read the installed `peaklab.gh-do-issue` skill's
[shared execution contract](../peaklab.gh-do-issue/references/execution.md).
It owns worktrees, APEX, QA and requested delivery. This adapter owns GlitchTip evidence
and resolution. Dependencies: `peaklab.gh-do-issue`, `apex`, `peaklab.ship-pr`.

## Inputs and modes

| Input | Meaning |
|---|---|
| Empty | Select one highest-ranked unresolved cluster |
| IDs / issue URLs | Cluster seeds; verify project/environment |
| `--project SLUG` | Explicit project |
| `--level fatal\|error\|warning` | Minimum severity; default error |
| `--limit N` | Maximum inbox candidates considered; default 20 |
| `--swarm [N]` | Select up to N clusters; default 3 |
| `--base`, `--draft`, `--no-subagent` | Base override, draft PR, or single-cluster inline work |
| `--auto` / `--no-auto` | Automatic agreed-scope work / plan approval |
| `--tdd` / `--no-tdd` | Test-first / opt out while retaining verification |
| `--no-merge` | Reviewed PR only; default unless delivery requested |
| `--wait-merge` / `--async-merge` | Explicit delivery with the shared contract's session limits |
| `--no-resolve` | No GlitchTip mutation, including comments |

Validate options before mutation. Numeric option values are not IDs; seeds and `--swarm`
are alternative selectors. Reject conflicting modes and nonpositive limits. Automatic execution
and adaptive testing are defaults. Fatal errors need deeper investigation/review; ask only for
new authority or an unresolved product decision. Drafts are never merged.

## Shared service contract

Read [the GlitchTip evidence and resolution contract](references/glitchtip-contract.md) before
API access. It owns credentials, transport, data minimization and all resolution gates used
by this skill, `peaklab.fix-glitchtip` and `peaklab.track-error`.

## Select and prove clusters

1. For seeds, fetch `/issues/<id>/` and use the actual project; verify any explicit project
   matches. Otherwise map configured/repository metadata to the projects endpoint; ask when
   several projects are plausible.
2. Fetch unresolved candidates from `/projects/<org>/<project>/issues/`. Rank considered
   candidates by severity then count. State limits/pagination truncation; a bounded ranking
   or empty page does not establish a globally empty inbox.
3. Read relevant events, including `/issues/<id>/events/latest/`. Retain only sanitized
   exception type/message, culprit, in-app frames, release, environment and diagnostic context.
   For issues spanning environments, inspect enough evidence to isolate them.
4. Group only when exception, normalized message, frame and culprit match, or one demonstrated
   failing dependency explains all members. Matching titles alone are insufficient. A wrapper
   and underlying exception may share a cause; prove that relationship in code/events.
5. Never combine projects/environments. Record covered and rejected IDs, shared cause and
   restored behavior. Redact identities, request bodies, headers and private breadcrumbs.
6. Check existing PR/task ownership by exact IDs before creating work. Read source/history to
   distinguish active bugs, already-fixed behavior, stale signal and noise. A merged base-branch
   fix does not prove deployment in the emitting environment.

Use a filesystem-safe cluster slug plus a stable member ID to avoid collisions. One cluster
gets one branch/worktree/PR. If cause remains unknown, report missing evidence or a decision;
do not implement speculative suppression.

## Execute and review

Pass the shared executor IDs/permalinks, sanitized evidence, environment/release, scope,
criteria, task-state path and modes. Resolvers use APEX inline, preserve regression evidence
and never call the GlitchTip API.

PRs list every covered GlitchTip ID, common cause and validation. Never use GitHub `Closes #N`
for GlitchTip IDs. QA checks each member; remove uncovered IDs from the claim and keep them open.

## Finish

Apply the shared service contract after execution. A reviewed PR is `pr_created`, not merged;
`merged` without verified deployment still leaves GlitchTip unresolved. For
`needs_confirmation` or `needs_clarification`, return the plan/decision and resume the same
worker after an explicit answer; `needs_planning` ends implementation without status writes.
Report one row per cluster: IDs, PR, code status, deployment evidence, GlitchTip status and
next action. No automatic queue chaining, background deployment or scheduled rechecks.
