---
name: peaklab.gh-do-issue
description: "Implement GitHub issues through APEX and the PR workflow. Use peaklab.glitchtip-do-issue for GlitchTip errors."
effort: deep
argument-hint: "[issue-number...] [--swarm [N]] [--base BRANCH] [--draft] [--no-auto] [--no-tdd] [--async-merge | --wait-merge | --no-merge] [--no-subagent]"
---

# GitHub Issue Delivery

Select GitHub work, then read [the shared execution contract](references/execution.md).
It owns worktree isolation, APEX invocation, QA, delivery and cleanup; this file owns
GitHub selection and status. Dependencies: `apex` and `peaklab.ship-pr`.

## Inputs and defaults

| Input | Meaning |
|---|---|
| Empty / `next` | Select one actionable issue by priority |
| `N`, `#N`, GitHub issue URL | Fetch the specified issue |
| Several issue numbers | Process only that bounded set |
| `--swarm [N]` | Select up to N issues; default 3 |
| `--base BRANCH` | Explicit base, subject to repository branch policy |
| `--draft` | Open draft PRs; never merge drafts |
| `--auto` / `--no-auto` | Proceed on agreed scope / pause for plan approval |
| `--tdd` / `--no-tdd` | Test-first / disable test-first, retain validation |
| `--no-merge` | Reviewed PR only; default unless delivery was requested |
| `--wait-merge` | Complete authorized delivery in this turn |
| `--async-merge` | Explicit session-worker delivery, subject to host support |
| `--no-subagent` | Execute one issue inline under the same isolation/QA contract |

Automatic execution and adaptive testing are defaults. Reject contradictory modes and invalid
batch sizes before mutation. Parse numeric option values before collecting IDs: `--swarm 3`
must not also select #3. Explicit IDs and `--swarm` are alternative selectors.
A URL must belong to the target repository.

## Select and understand

1. For explicit IDs, fetch each directly with `gh issue view`, including number, title, body,
   comments, labels, assignees, state and URL. Do not fetch the whole queue first.
2. For automatic selection, fetch open candidates with `gh issue list --json`, including
   assignees. Paginate when truncation would exclude eligible work. Prefer issues assigned
   to the current user, then unassigned priority-labelled issues, then the oldest unassigned
   actionable issue. Never silently take another user's work.
3. Rank within each group: `priority:critical|urgent`, `high`, `medium`, `low`, unlabelled;
   break ties by issue number. Skip planning containers and unresolved blockers.
4. Query open PRs with their bodies/head branches and task ownership before creating work.
   Match exact issue references; #12 is not #123. Distinguish abandoned artifacts from active
   tasks before deciding to skip or resume.
5. Establish whether the premise still holds from the description, comments and current code.
   Check relevant history/merged PRs when needed to distinguish shipped, obsolete and active
   work. Reuse reliable evidence for the same revision.

An empty description alone is not a blocker if title, comments and code define the behavior.
Infer reversible details explicitly; ask only about a material acceptance criterion or product
decision. Summarize the selected IDs and outcomes.

## Mission

Provide the issue context once, base policy, authorized checkout, task directory, modes,
acceptance criteria, known files and existing analysis. Link long artifacts instead of copying
them. The worker reads the shared contract and repository instructions.

Use a caller-supplied task directory or the harness task directory. Keep one canonical plan/status
record; existing analyze/plan/implementation files may be referenced rather than regenerated.
Include `Closes #N` in the PR body for every GitHub issue demonstrably covered, using body files
for multiline `gh` input. A PR reference alone does not prove its acceptance criteria.

## Terminal results

| Result | GitHub action |
|---|---|
| `pr_created` | Report PR, validation and verdict; leave issue open |
| `merged` | Verify merger and whether GitHub closed the issue |
| `already_done` | Present merged/code evidence; close only when the request authorizes closure |
| `obsolete` | Explain the obsolete premise; request a decision before closing or rewriting |
| `needs_confirmation` | Present the current plan; record approval and resume the same worker |
| `needs_clarification` | Return the missing decision and retain useful evidence |
| `needs_planning` | Return decision-sized unknowns; do not implement or publish planning tickets implicitly |
| `blocked` | Preserve checkout; report failing condition and next safe action |
| `no_changes` | Explain why no implementation was needed; do not imply resolution |

Limit comments/status changes to the requested issue workflow. Do not create unrelated issues,
chain to new work or arm deferred monitoring. Finish with one concise result per issue:
ID, status, PR, validation/review and blocker.
