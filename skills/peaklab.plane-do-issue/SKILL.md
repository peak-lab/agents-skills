---
name: "peaklab.plane-do-issue"
description: "Implement a Plane issue through the PR workflow. Use peaklab.plane-status for board inspection."
effort: deep
argument-hint: "[PREFIX-N | UUID | URL | next] [--no-auto] [--tdd | --no-tdd] [--wait-merge | --async-merge | --no-merge] [--no-subagent]"
allowed-tools: "Bash(git :*), Bash(gh :*), Bash(rtk :*), Bash(python3 :*), Read, Write, Edit, MultiEdit, Skill, Agent, Task"
---

<overview>
Deliver one Plane issue as a reviewed, unmerged pull request from an isolated worktree. Merge
only for an explicit `--wait-merge` or `--async-merge` request.
</overview>

<constraints>
- Load `peaklab.plane-api` before Plane API work; use its client and dynamic state resolution.
- Never implement on the base branch or mutate the parent checkout, including `.gitignore`.
- Preserve existing assignees. The selector's JSON is canonical for issue, task path,
  execution modes, and linked-worktree state; never reconstruct those values.
- `task_dir` is the selector-provided path under `~/.agents/tasks/plane/`, never in the checkout.
- Keep one task artifact, `<task_dir>/analyze.md`: acceptance criteria, premise and freshness
  evidence, plan, and validation results.
- Give that artifact one writer at a time: implementer, then parent during review, then watcher
  during authorized shipping. Hand off the path and current head/base explicitly; the previous
  owner stops writing first. Reviewers return findings to the owner. Preserve evidence and
  repair counters in place; no competing status reports.
- The implementation worker runs APEX with `-e`, cannot spawn agents, and never performs the
  official QA review or merge. A normal self-check is allowed.
- The parent owns exactly one risk-tiered review gate, valid only for the reviewed head SHA
  while the base stays at the reviewed base SHA.
- Never schedule a future check. `--async-merge` means a live worker in the current session, not
  cron, a cloud routine, `/loop`, or any deferred mechanism.
- Use one shared repair budget of two worker mutation cycles across review fixes, rebases, CI
  fixes, and conflict resolution. A new pushed head consumes one cycle regardless of its cause;
  never reset the budget between causes.
</constraints>

<arguments>
- Empty or `next`: highest-priority non-EPIC Todo assigned to the current user, then an
  unclaimed Todo; stable among equal priorities.
- Explicit issue: `PREFIX-N`, sequence number, UUID, or Plane URL.
- `--no-auto`: pass APEX `-A`; otherwise pass `-a`.
- No TDD flag: use APEX's adaptive default. `--tdd` passes `-d` for strict TDD;
  `--no-tdd` passes `-D`.
- `--no-merge`: compatibility spelling for the default reviewed-PR handoff.
- `--wait-merge`: run the watcher synchronously in this turn.
- `--async-merge`: launch the watcher only when a live session worker can finish and report.
- `--no-subagent`: the parent implements in the isolated worktree, then uses a separate
  reviewer for the official gate.
</arguments>

<headless_runtime>
The optional Hermes wrapper is active only when the caller explicitly sets
`PLANE_DO_ISSUE_RUNTIME=hermes`; never infer it from a hostname, path, or installed binary.

When enabled, skip the generic workflow below: resolve `SKILL_DIR` from the loaded skill and
invoke the wrapper directly once. It supports only an explicit issue in auto/adaptive-TDD,
PR-only mode. Before selection, reject `--no-auto`, `--tdd`, `--no-tdd`,
`--wait-merge`, `--async-merge`, `--no-subagent`, or anything other than an exact `PREFIX-N` issue
with an explanation that the caller must unset `PLANE_DO_ISSUE_RUNTIME` and use the normal workflow
for those modes. Never silently drop requested flags to enter this wrapper.

Run it only from a clean, registered external linked worktree whose non-base branch belongs to
that issue. Before its selector can mutate Plane, the wrapper verifies checkout, repository,
branch, and issue association and fails closed; it never creates or repairs isolation:

```bash
python3 "$SKILL_DIR/scripts/run_on_hermes.py" <PREFIX-N> --no-merge
```

The host must provide `claude`, `corepack`, and `pnpm`, plus an absolute build environment file
through `PLANE_HERMES_BUILD_ENV_FILE`. It may provide a GlitchTip environment file through
`PLANE_HERMES_GLITCHTIP_ENV_FILE`. The wrapper performs its own selector call and bounded agent
run; never invoke this skill recursively, spawn another agent, perform or claim the official
parent review, merge, deploy, or mutate GlitchTip from that run. A normal self-check is required.
A created PR is explicitly reported as unreviewed and handed off for an interactive parent review.
</headless_runtime>

<implementation_routing>
Before launching the implementation worker, inspect the target repository's declared agent
definitions and scoped instructions. Prefer the owning specialist for a scoped package and a
declared cross-package owner when the change spans boundaries. Treat billing or entitlements,
authorization or tenant boundaries, migrations, customer data, and cross-service contracts as
high risk: use the deepest appropriate declared owner.

Do not invent or require private agent names. With no matching specialist or subagent facility,
the parent implements in the isolated worktree after loading the same instructions inline. A
project-agnostic Plane worker is optional. Pass the ownership route, scoped instructions, and
escalation boundary to the worker.
</implementation_routing>

<workflow>
<step name="select">
Run once from the caller's checkout:

```bash
SKILL_DIR="<directory containing this loaded SKILL.md>"
python3 "$SKILL_DIR/scripts/select_issue.py" $ARGUMENTS
```

Stop on `found=false`. The selector clears stale shared state, exact-matches sequence IDs,
skips EPICs for `next`, preserves assignees, marks the issue In Progress, and returns `task_dir`, `worktree_path`, `linked_worktree`,
`branch`, `auto_mode`, `tdd_mode`, `merge_mode`, and `use_subagent`.
</step>

<step name="epic">
For an explicitly selected EPIC, analyze and split only with the Plane epic/story planners:
write the proposal to `analyze.md` and return `needs_confirmation` before creating stories unless
the user explicitly requested creation. Do not run implementation APEX.
</step>

<step name="prepare-worktree">
If `linked_worktree=true`, the selector proved only that it is clean, non-detached, and not the
remote default branch. Before reuse, resolve the repository-policy base and verify the branch is
an allowed task branch for this issue with no unrelated commits; otherwise stop. Never repurpose
the linked worktree.

Otherwise read branch/base policy, validate the selector's branch name, and create an external
isolated worktree; never add `.worktrees/` to `.gitignore`:

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
The parent selects the worker via `<implementation_routing>` and gives it the selector JSON,
absolute worktree path, ownership boundary, and this contract. With `use_subagent=false` or no
callable specialist, the parent takes that role and loads the specialist instructions itself.
The implementer writes `analyze.md` before editing:

- acceptance criteria from issue, comments, and parent; label genuinely inferred criteria;
- relevant `file:line` evidence after reading each cited file;
- current premise: behavior and referenced surfaces still exist;
- freshness: recent commits on target paths and merged PRs for the area;
- applicable cross-service contracts, auth/tenant boundaries, and schema ownership;
- an ordered implementation and validation plan.

When graphs exist and multiple packages are implicated, query affected packages. Return
`already_done` or `obsolete` with commit/PR/code evidence, or `needs_clarification` with exact
questions when material scope is ambiguous; do not guess. Pass the artifact path to APEX as
caller state so it reuses this context instead of repeating discovery. Its plan section is the
canonical plan; APEX amends it in place and must not create a second `plan.md`.
</step>

<step name="implement">
The worker follows repository/package `AGENTS.md` and edits only inside `WORKTREE`. Invoke the
installed `apex` skill (or read its instructions when no skill facility exists) with:

```text
<AUTO_FLAG> <optional TDD_FLAG> -e <issue intent + acceptance criteria + analyze.md path>
```

`AUTO_FLAG` (`-a`/`-A`) and the optional `-d`/`-D` follow `<arguments>`; omit the TDD flag for
adaptive mode. `-e` prevents nested analysis agents.

The worker updates `analyze.md` with changed files and focused validation mapped to acceptance
criteria. Run broader checks only when repository rules or change risk require them; collect
screenshots only when visual behavior is an acceptance criterion. Stage only scoped files,
create a conventional commit, push, and create/update the PR with `gh`. Return `pr_created`
with issue, branch, worktree path, PR URL/number, head SHA, criteria status, and validation.
Never invoke
`peaklab.ship-pr`, wait for CI, perform the official QA review, launch the watcher, or merge.

If APEX returns `needs_confirmation` (the expected `--no-auto` / `-A` approval gate), preserve
its canonical plan and return that status to the parent without editing.
</step>

<step name="handle-terminal-result">
- `needs_confirmation`: show the canonical plan to the user. On approval, resume the same worker
  with the existing artifact and explicit decision; on rejection, restore Todo and remove only a
  newly-created clean worktree.
- `needs_clarification`: comment exact questions through `peaklab.plane-api`, restore Todo,
  remove a newly-created clean worktree, and report.
- `already_done`: comment evidence and recommend closing; do not close without confirmation.
- `obsolete`: comment evidence, restore Todo, and recommend cancellation or rewrite; do not
  cancel without confirmation.
- `blocked`: keep the worktree and report the decision needed.
- `pr_created`: require `analyze.md`, the PR, and the reported head SHA, then review.

Resume the same worker for missing evidence or requested fixes; never respawn equivalent work.
After a result the worker stops autonomous tools, messages and artifact edits. Check evidence
once, then resume only for a specific gap, in-scope blocker or authorized next phase, handing
artifact ownership back when needed. Keep the worker resumable through review and release it at
the requested terminal state. Evidence invalidating a result still goes to the parent. No report
polishing, acknowledgment loops or unsolicited memory work.
</step>

<step name="review">
Initialize `repair_cycles=0` once before the first parent review and carry it through every
review and watcher handoff; never reset it after a successful intermediate repair.
Fetch the remote base, record its SHA, and verify the PR head is current with it. If not, the
same worker rebases, validates, pushes, and returns the new head first; that consumes one cycle.

Launch one repository review agent: its deep route for the high-risk areas listed in
`<implementation_routing>`, its standard route otherwise. Give it the exact PR diff, acceptance
criteria, validation evidence, head SHA, and base SHA. Require file/line findings classified
blocking or non-blocking and a verdict for that head/base pair.
The reviewer independently examines the diff and affected interactions, verifies the supplied
validation's scope, revision and environment, and reruns only missing or invalidated checks.
Unsupported summaries cannot replace evidence. It returns one compact verdict, concrete findings
and evidence gaps. Keep the author's checkout unchanged: a necessary pre-fix regression
experiment runs in a disposable checkout or copy with isolated test resources, cleaned up after.
Never revert the author's files or write to shared services; reuse valid regression proof.

Blocking findings return to the same worker while budget remains; increment after it pushes a
new head, then review that SHA again. Stop once two total cycles are consumed across review and
shipping. Post non-blocking findings as a PR comment. Without a review agent, the parent performs
one equivalent explicit review. Record `reviewed_head=<sha>`, `reviewed_base=<sha>`, and
`review_verdict=clean|fixed`.
</step>

<step name="handoff">
- Default or `--no-merge`: report the reviewed PR and leave Plane In Progress.
- `--wait-merge`: invoke `peaklab.plane-ship-watch` now with full PR URL, `--repo <OWNER/REPO>`, `--issue <PREFIX-N>`,
  `--reviewed-head <sha>`, `--reviewed-base <sha>`, `--review-verdict <verdict>`, and
  `--plane-skill-dir <SKILL_DIR>`; wait for its terminal result.
- `--async-merge`: pass the same arguments to a live `plane-ship-watcher` session worker only
  when the host guarantees it can complete and report; otherwise stop at the reviewed PR with
  the explicit watcher command. Never create deferred monitoring.

Handle watcher results against the same shared repair budget:

- `blocked_review_required` or `blocked_rebase_required`: resume the same worker, rebase when
  needed, validate, push, repeat the parent review, and invoke the watcher with the new pair.
- `blocked_ci`: resume the same worker only when the watcher proves the failure is attributable
  to this change and safely in scope; pass the failed check URL and logs.
- `blocked_conflict`: resume the same worker only for a localized conflict whose resolution
  follows from the issue intent and repository rules; require a completed rebase.
- Both CI and conflict repairs require focused validation, a new push, and a new parent review.
- Infrastructure failures, flaky or third-party failures, broad conflicts, product-semantic
  uncertainty, policy failures, missing CI, merge-queue wait exhaustion, and issue mismatches
  remain terminal blockers. Do not mutate code or Plane for them.

Every resumed worker mutation that produces a new head increments the shared repair counter.
Stop after two total cycles with the exact evidence and decision needed.
</step>
</workflow>

<status_safety>
`peaklab.plane-ship-watch` owns post-PR Plane transitions. It may call the resolved
`<SKILL_DIR>/scripts/finish_issue.py` with an explicit `--issue` only after GitHub evidence
proves merged or after a permanent documented blocker. State names
come from the same atomic Plane config source and resolve dynamically; unknown names fail.
</status_safety>

<acceptance_criteria>
- One issue yields either an evidence-backed terminal result or one reviewed PR.
- Analysis/planning/validation context exists once in `analyze.md` and is reused by APEX.
- Review verdict and merge checks refer to the same exact head/base SHA pair.
- Parent checkout stays byte-for-byte untouched by worktree preparation.
</acceptance_criteria>
