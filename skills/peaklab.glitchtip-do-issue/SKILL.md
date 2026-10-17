---
name: peaklab.glitchtip-do-issue
description: "Resolve GlitchTip errors through issue tracking, implementation and QA. Use peaklab.gh-do-issue for a GitHub issue queue."
effort: deep
argument-hint: "[id|url...] [--project SLUG] [--level fatal|error|warning|info|debug] [--swarm [N] | --all] [--inline] [--limit N] [--base BRANCH] [--draft] [--no-auto] [--no-tdd] [--async-merge | --wait-merge | --no-merge] [--no-resolve] [--no-subagent]"
---

# GlitchTip Issue Delivery

One demonstrated root cause covering one or more GlitchTip IDs is one unit of work, for
isolated fixes and bounded inbox passes alike. Isolation is the
default; use `--inline` for the current checkout. `peaklab.track-error` instead keeps a GitHub
issue as the error's permanent record.

Before implementation, read the
[shared execution contract](../peaklab.gh-do-issue/references/execution.md): it owns worktrees,
APEX, QA and requested delivery. This adapter owns GlitchTip evidence and resolution. Dependencies: `peaklab.gh-do-issue`, `apex`, `peaklab.ship-pr`.

## Inputs and modes

| Input | Meaning |
|---|---|
| Empty | Select one highest-ranked unresolved cluster |
| IDs / issue URLs | Cluster seeds; verify project/environment |
| `--project SLUG` | Explicit project |
| `--level fatal\|error\|warning\|info\|debug` | Minimum severity; default error, ordered as listed |
| `--limit N` | Maximum inbox candidates considered; default 20 |
| `--swarm [N]` | Select up to N clusters; default 3 |
| `--all` | Process all clusters from the bounded candidate set sequentially; no refresh loop |
| `--inline` | Use the current checkout sequentially; implies no implementation subagent |
| `--base`, `--draft` | Base override or draft PR |
| `--no-subagent` | Implement one cluster in the current session, with checkout isolation still required unless `--inline` |
| `--auto` / `--no-auto` | Automatic agreed-scope work / plan approval |
| `--tdd` / `--no-tdd` | Test-first / opt out while retaining verification |
| `--no-merge` | Reviewed PR only; default unless delivery requested |
| `--wait-merge` / `--async-merge` | Explicit delivery with the shared contract's session limits |
| `--no-resolve` | No GlitchTip mutation, including comments |

Validate options before mutation. Numeric option values are not IDs; seeds, `--swarm` and
`--all` are alternative selectors. Reject conflicting modes and nonpositive limits;
`--inline` conflicts with `--swarm` and `--async-merge`, and `--no-subagent` conflicts with
batch selectors except sequential `--inline --all`. Fatal errors need deeper
investigation/review; ask only for new authority or an unresolved product decision. Drafts are
never merged.

## Shared service contract

Read [the GlitchTip evidence and resolution contract](references/glitchtip-contract.md) before
API access. It owns credentials, transport, data minimization, clustering evidence and all
resolution gates, shared with `peaklab.track-error`.

## Select and prove clusters

1. For seeds, fetch `/issues/<id>/` and use the actual project; verify any explicit project
   matches. Otherwise map configured/repository metadata to the projects endpoint; ask when
   several projects are plausible.
2. Fetch unresolved candidates from `/projects/<org>/<project>/issues/`, ranked by severity
   then count, stating limits/pagination truncation per the contract.
3. Read relevant events, including `/issues/<id>/events/latest/`, retaining only the sanitized
   evidence the contract allows. For issues spanning environments, inspect enough to isolate them.
4. Group only when exception, normalized message, frame and culprit match, or one demonstrated
   failing dependency explains all members. A wrapper and underlying exception may share a
   cause; prove that relationship in code/events.
5. Never combine projects/environments. Record covered and rejected IDs, shared cause and
   restored behavior.
6. Check existing PR/task ownership by exact IDs before creating work. Read source/history to
   distinguish active bugs, already-fixed behavior, stale signal and noise. A merged base-branch
   fix does not prove deployment in the emitting environment.

Use a filesystem-safe cluster slug plus a stable member ID to avoid collisions. One cluster
gets one branch/worktree/PR. If cause remains unknown, report missing evidence or a decision;
do not implement speculative suppression.

## Execute and review

For `--inline`, replace only the shared executor's checkout-preparation steps with these rules:

- Bind the current checkout, repository, resolved base and canonical task state. Never implement
  on the base branch or a detached HEAD. Create a task branch only when safe; reuse a branch
  only after verifying its commits belong to the cluster. Preserve unrelated edits and stop
  on inseparable ownership; never auto-stash or force-switch.
- Implement locally via the shared APEX mapping and keep its single official QA/delivery owner.
  Automatic execution remains the default; use `--no-auto` for plan approval.
- For `--inline --all`, start each next independent cluster on a separate clean branch from the
  resolved base. Never stack it on the previous unmerged PR. Stop if switching is unsafe.
  An explicitly requested inline pass permits these safe branch switches, not deletion of user work.

With `--all`, record blocked/uncertain clusters and continue only with independent clusters
that can be prepared safely, each with its own task state and PR. Do not refetch the inbox
or extend the candidate set automatically. Other modes use the shared checkout preparation.

Pass the shared executor IDs/permalinks, sanitized evidence, environment/release, scope,
criteria, task-state path and modes. Resolvers use APEX inline, keep regression evidence and
never call the GlitchTip API.

PRs list every covered GlitchTip ID, common cause and validation. Never use GitHub `Closes #N`
for GlitchTip IDs. QA checks each member; remove uncovered IDs from the claim and keep them open.

## Finish

Apply the contract's resolution gate after execution: `pr_created` or `merged` without verified
deployment leaves GlitchTip unresolved. For
`needs_confirmation` or `needs_clarification`, return the plan/decision and resume the same
worker after an explicit answer; `needs_planning` ends implementation without status writes.
Report one row per cluster: IDs, PR, code status, deployment evidence, GlitchTip status and
next action. No automatic queue chaining, background deployment or scheduled rechecks.
