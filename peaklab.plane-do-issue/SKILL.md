---
name: "peaklab.plane-do-issue"
description: "Use when the user asks to implement one Plane issue or the next eligible Plane ticket through a reviewed pull request."
effort: deep
argument-hint: "[PREFIX-N | UUID | URL | next] [--no-auto] [--tdd | --no-tdd] [--wait-merge | --async-merge | --no-merge] [--no-subagent]"
allowed-tools: "Bash(git :*), Bash(gh :*), Bash(rtk :*), Bash(python3 :*), Read, Write, Edit, MultiEdit, Skill, Agent, Task"
---

<overview>
Deliver one Plane issue as a reviewed pull request from an isolated worktree. The
default terminal state is a reviewed, unmerged PR. Merge only for an explicit
`--wait-merge` or `--async-merge` request.
</overview>

<constraints>
- Load `peaklab.plane-api` before Plane API work; use its client and dynamic state resolution.
- Never implement on the base branch or mutate the parent checkout, including `.gitignore`.
- Preserve existing assignees. Use the selector's JSON as the canonical issue, task path,
  execution-mode, and linked-worktree state; do not reconstruct those values.
- `task_dir` is the selector-provided path under `~/.agents/tasks/plane/`, never a directory in
  the source checkout.
- Keep one task artifact: `<task_dir>/analyze.md`. It holds acceptance criteria, premise and
  freshness evidence, plan, and validation results.
- The implementation worker runs APEX with `-e`, cannot spawn agents, and never performs the
  official QA review or merge. A normal self-check is allowed.
- The parent owns exactly one risk-tiered review gate. Its verdict is valid only for the reviewed
  head SHA while the base remains at the reviewed base SHA.
- Never schedule a future check. `--async-merge` means a live worker in the current agent session,
  not cron, a cloud routine, `/loop`, or another deferred mechanism.
</constraints>

<arguments>
- Empty or `next`: highest-priority non-EPIC Todo assigned to the current user, then an
  unclaimed Todo. Selection is stable among equal priorities.
- Explicit issue: `PREFIX-N`, sequence number, UUID, or Plane URL.
- `--no-auto`: pass APEX `-A`; otherwise pass `-a`.
- No TDD flag: use APEX's adaptive default. `--tdd` passes `-d` for strict TDD;
  `--no-tdd` passes `-D`.
- `--no-merge`: compatibility spelling for the default reviewed-PR handoff.
- `--wait-merge`: run the watcher synchronously in this turn.
- `--async-merge`: launch the watcher only when a live session worker can finish and report.
- `--no-subagent`: compatibility fallback; the parent performs implementation in the isolated
  worktree, then uses a separate reviewer for the official gate.
</arguments>

<workflow>
<step name="select">
Run once from the caller's checkout:

```bash
SKILL_DIR="<directory containing this loaded SKILL.md>"
python3 "$SKILL_DIR/scripts/select_issue.py" $ARGUMENTS
```

Stop on `found=false`; the selector clears stale shared state before lookup. It exact-matches
sequence IDs even when Plane ignores filters, skips EPICs for `next`, preserves assignees,
marks the selected issue In Progress, and returns `task_dir`, `worktree_path`, `linked_worktree`,
`branch`, `auto_mode`, `tdd_mode`, `merge_mode`, and `use_subagent`.
</step>

<step name="epic">
For an explicitly selected EPIC, analyze and split only. Use the Plane epic/story planners,
write the proposal to `analyze.md`, and return `needs_confirmation` before creating stories
unless the user explicitly requested story creation. Do not run implementation APEX.
</step>

<step name="prepare-worktree">
If `linked_worktree=true`, the selector has proved only that it is clean, non-detached, and not
the remote default branch. Before reuse, resolve the repository-policy base and verify the active
branch is an allowed task branch for this issue and has no unrelated commits. Otherwise stop;
never repurpose the linked worktree.

Otherwise read repository branch/base policy first, validate the selector's branch name, and
create an external isolated worktree; never add `.worktrees/` to `.gitignore`:

```bash
git fetch origin
WORKTREE_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/plane-${prefix}-${sequence_id}.XXXXXX")
WORKTREE="$WORKTREE_ROOT/worktree"
if git show-ref --verify --quiet "refs/heads/$branch"; then
  git worktree add "$WORKTREE" "$branch"
elif git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
  git worktree add -b "$branch" "$WORKTREE" "origin/$branch"
else
  git worktree add -b "$branch" "$WORKTREE" "origin/$BASE_BRANCH"
fi
```

`BASE_BRANCH` must be the repository-policy base resolved before this block. Reuse an existing
branch only when it belongs to this issue and is not checked out in another active worktree;
otherwise stop with the exact conflict.
If the parent `.env` exists and `$WORKTREE/.env` does not, copy it without printing contents
and run `chmod 600 "$WORKTREE/.env"`; never overwrite an existing target.
</step>

<step name="analyze">
The parent gives one implementation worker the selector JSON, absolute worktree path, and this
analysis contract. With `use_subagent=false`, the parent takes that implementation role locally.
The implementer must write `analyze.md` before editing:

- acceptance criteria from issue, comments, and parent; label genuinely inferred criteria;
- relevant `file:line` evidence after reading each cited file;
- current premise: behavior and referenced surfaces still exist;
- freshness: recent commits on target paths and merged PRs for the area;
- applicable cross-service contracts, auth/tenant boundaries, and schema ownership;
- an ordered implementation and validation plan.

When graphs exist and multiple packages are implicated, query affected packages. Return
`already_done` or `obsolete` with commit/PR/code evidence when appropriate. Return
`needs_clarification` with exact questions when material scope remains ambiguous; do not guess.
These Plane-specific findings are caller state for APEX: pass the artifact path and instruct
APEX to reuse its proven context rather than repeat discovery. Its plan section is the caller's
canonical plan; APEX amends it in place and must not create a second `plan.md`.
</step>

<step name="implement">
The worker follows repository/package `AGENTS.md`, edits only inside `WORKTREE`, and invokes:

```text
/apex <AUTO_FLAG> <optional TDD_FLAG> -e <issue intent + acceptance criteria + analyze.md path>
```

`AUTO_FLAG` is exactly `-a` or `-A`. Use `-d` only for explicit strict TDD, `-D` for explicit
no-TDD, and omit both for adaptive mode. `-e` prevents nested analysis agents.

The worker updates `analyze.md` with changed files and focused validation mapped to acceptance
criteria. Run broader or deployment-equivalent checks only when repository rules or change
risk require them. Collect browser screenshots only when visual behavior is an acceptance
criterion. Stage only scoped files, create a conventional commit, push the branch, and then
create/update the PR with `gh`. Return `pr_created` with issue, branch,
worktree path, PR URL/number, head SHA, criteria status, and validation. Never invoke
`peaklab.ship-pr`, wait for CI, perform the official QA review, launch the watcher, or merge.
</step>

<step name="handle-terminal-result">
- `needs_clarification`: comment exact questions through `peaklab.plane-api`, restore Todo,
  remove a newly-created clean worktree, and report.
- `already_done`: comment evidence and recommend closing; do not close without confirmation.
- `obsolete`: comment evidence, restore Todo, and recommend cancellation or rewrite; do not
  close/cancel without confirmation.
- `blocked`: keep the worktree and report the decision needed.
- `pr_created`: require `analyze.md`, the PR, and the reported head SHA, then review.

Resume the same worker for missing evidence or requested fixes. Do not respawn equivalent work.
</step>

<step name="review">
Before review, fetch the remote base, record its SHA, and verify the PR head is current with it.
If it needs rebasing, have the same worker rebase, validate, push, and return the new head first.

Launch one repository review agent: its deep/risk route for billing, authorization, tenant
boundaries, migrations, customer data, or cross-service contracts; its standard route
otherwise. Give it the exact PR diff, acceptance criteria, validation evidence, head SHA, and
base SHA. Require file/line findings classified blocking or non-blocking and a verdict for that
head/base pair.

Blocking findings return to the same worker; review the new SHA again. Stop after two cycles.
Post non-blocking findings as a PR comment. If no review agent is available, the parent performs
one equivalent explicit review. Record `reviewed_head=<sha>`, `reviewed_base=<sha>`, and
`review_verdict=clean|fixed`.
</step>

<step name="handoff">
- Default or `--no-merge`: report the reviewed PR and leave Plane In Progress.
- `--wait-merge`: invoke `peaklab.plane-ship-watch` now with PR, issue,
  `--reviewed-head <sha>`, `--reviewed-base <sha>`, `--review-verdict <verdict>`, and
  `--plane-skill-dir <SKILL_DIR>`; wait for its terminal result.
- `--async-merge`: pass the same arguments to a live `plane-ship-watcher` session worker only
  when the host guarantees it can complete and report. Otherwise stop at the reviewed PR and
  provide the explicit watcher command. Do not create deferred monitoring.

If the watcher returns `blocked_rebase_required` or `blocked_review_required`, resume the same
implementation worker, validate/push the new head, repeat the single parent review, and invoke
the watcher with the new head/base pair. Stop after two such cycles with exact evidence.
</step>
</workflow>

<status_safety>
`peaklab.plane-ship-watch` owns post-PR Plane transitions. It may call the resolved
`<SKILL_DIR>/scripts/finish_issue.py` with an explicit `--issue`
only after GitHub evidence proves merged or after a permanent documented blocker. State names
come from the same atomic Plane config source and resolve dynamically; unknown names fail.
</status_safety>

<acceptance_criteria>
- One issue yields either an evidence-backed terminal result or one reviewed PR.
- Analysis/planning/validation context exists once in `analyze.md` and is reused by APEX.
- Review verdict and merge checks refer to the same exact head/base SHA pair.
- Parent checkout stays byte-for-byte untouched by worktree preparation.
</acceptance_criteria>
