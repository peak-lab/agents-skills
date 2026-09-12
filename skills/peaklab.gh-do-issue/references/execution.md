# Shared Issue Execution Contract

Used by GitHub and GlitchTip adapters. The adapter owns source selection/status; this contract
owns implementation, QA and delivery, including inline execution.

## Ownership and modes

- The orchestrator selects work, prepares checkouts and owns the official QA verdict.
  Workers implement, validate, commit, push and open PRs only within assigned checkouts.
- A single bounded task may run inline. Parallel tasks need distinct branches/checkouts and
  explicit file ownership. Delegate only within available host capacity; no forced agent quota.
- Use repository ownership agents where available. Auth, billing, tenant isolation, migrations,
  privacy, security, infrastructure and cross-service changes require corresponding expertise.
  If no named agent exists, use a capable available worker or execute locally under the same
  gates. Report a missing capability rather than inventing tools or weakening the review.
- Resolve model/effort from the agent definition and host routing policy. Pass explicit values
  when required by the host; a Claude model field does not automatically configure Codex.
- Stop after a reviewed PR by default. Delivery intent or `--wait-merge` authorizes shipping;
  `--no-merge` stops at PR and draft mode prevents merge.
- `--async-merge` explicitly requests one session worker for the batch. Verify host support
  and report its handle/pending work. If unsupported, report reviewed PRs and the limitation.
  This never authorizes scheduled wake-ups, cron or self-rearming routines.

## Prepare the checkout

1. Read repository/package instructions, record initial git status, resolve base from repository
   policy, explicit argument or remote default, and fetch that base.
2. Compare `git rev-parse --path-format=absolute --git-dir` with
   `git rev-parse --path-format=absolute --git-common-dir`: differing directories identify a
   linked worktree. Do not test whether the result of `--git-dir` is a file.
3. Reuse a linked checkout only for one task on its existing non-base, non-detached branch,
   with a clean state or verified changes solely belonging to this task. Never share it for a batch.
4. Otherwise create one branch/worktree per task from the resolved base. Use an already ignored
   `.worktrees/` or an external task directory. If needed add only that directory to Git's local
   exclude file; do not modify the parent's tracked `.gitignore`.
5. Existing branches/checkouts require verified ownership. Do not auto-stash user changes,
   force reuse, reset work or switch the parent's branch to implement an issue.
6. Copy the parent `.env` and documented package envs only when source exists and target does
   not; mode 600, no printing, overwrites or hook bypasses.
7. Record absolute checkout/base SHA/branch/task paths. Resume an existing task from its original
   baseline after checking current state.

## Implement

Give the worker source IDs, relevant context or pointers, scope/exclusions, acceptance criteria,
known evidence, checkout/base, task directory and modes. All repository commands run in that
checkout. The worker is not alone: preserve others' edits and report scope expansion.

Use APEX inline (`-e`) with supplied analysis/plan and canonical task state:

| Caller setting | APEX argument |
|---|---|
| Automatic / interactive | `-a` / `-A` |
| Explicit test-first / explicit opt-out | `-d` / `-D` |
| Adaptive testing | Omit both TDD flags and record the chosen verification |

Omitting a default-on flag does not disable it. Do not pass `-b`, `-pr`, `-m` or `-x`:
checkout setup and official QA are owned here. Self-checks remain the worker's job.
Without a Skill tool, read the installed APEX instructions and follow their applicable steps.
For `-A`, carry approval for the current plan revision or return `needs_confirmation` to the
parent before edits. A reusable plan is not automatically an approved plan. Resume that same
worker only with the user's decision recorded against the plan revision.

Reuse reliable analysis; verify ticket relevance before editing. Use one plan of observable
behavior slices with file ownership, dependencies and verification. Reproducible bugs need a
regression check; docs/configuration need checks that apply. Unknown product behavior requires
a user decision, not a speculative implementation.

Implement, run applicable checks, self-check the diff and open the PR through `gh`.
Commit only task-owned changes/hunks; no co-author or generated attribution. Never merge from
an implementation worker. Return:

```text
status: pr_created | needs_confirmation | needs_clarification | needs_planning | already_done | obsolete | blocked | no_changes
source_ids: ...
worktree: absolute path
branch: ...
repository: owner/repo
head_sha: ...
pr_url: ...
task_state: absolute path
validation: commands/results, revision and relevant environment
criteria: met / partial / not applicable, with evidence
blocker_or_next_action: ...
```

GlitchTip adds cluster coverage and may return `stale_signal` or `noise` for triage.
Consume results as they arrive; review ready PRs without waiting for the slowest worker.
For idle-without-result, inspect artifacts/git/PR state and resume the same worker. A commit
and PR alone do not demonstrate validation.

## QA once

Assign one reviewer appropriate to risk, or review locally if delegation is unavailable.
Review the task patch against baseline, criteria and repository rules. GlitchTip QA explicitly
checks every claimed ID. Add a specialist only for an independent risk that warrants it.

Record verdict (`review_completed_no_blockers`, `review_blockers_fixed` or
`review_blocked_do_not_merge`), head/base SHA, reviewer, scope and findings in task state.
In-scope fixes are authorized work: resume the same worker, validate affected paths and review
the changed patch. Use the [shipping correction contract](../../peaklab.ship-pr/SKILL.md#3-one-correction-loop)
for QA repairs: persist `repair_budget: {limit: 3, used: N}` and `repair_attempts` in the canonical
task state, increment before each hypothesis-driven repair batch, and retain failed attempts.
Initialize zero only for fresh work; reconstruct legacy history or ask when unknown. A repeated
failure without new evidence or a supported new hypothesis stops with `no_progress`.
At the shared limit, report any remaining blocker; do not hand unresolved QA to shipping to
obtain another budget. Successful QA carries all used attempts into delivery.

Reuse validation only while code, dependencies, configuration and relevant environment remain
unchanged. Any changed review head/base requires checking the delta and renewing the verdict.

## Deliver and finish

For each requested delivery, bind the exact target from that task's result:

```text
peaklab.ship-pr --pr <PR_URL> --repo <OWNER/REPO> --worktree <ABSOLUTE_PATH> --task-state <ABSOLUTE_TASK_PATH> --base <BASE> --auto-fix
```

Pass the task-state path, expected branch/head/base, QA verdict, validation evidence and persisted
`repair_budget`, `repair_attempts`, `ci_wait_seconds` (zero before any CI wait). The delivery owner
continues these counters; a new worker, invocation or push never resets them. Reuse a current
clean review without another full review; only changed evidence requires delta review.
All local shipping commands run in that task's checkout, never the parent's by inference;
GitHub calls use the explicit repository and PR. A target mismatch blocks that delivery.
If the host has no Skill tool or rejects `disable-model-invocation`, the shipping owner reads
the installed `peaklab.ship-pr/SKILL.md` and follows its same target/review/CI/merge gates
directly. Tool availability grants no extra authority. No alternate, weaker shipping loop.

It consumes current evidence and renews stale/missing checks. Return the verified `merged`,
`pr_created` or `blocked` status with PR/repository/head; callers must not infer merge from return.
One owner handles shipping; do not assign another reviewer/watcher the same responsibility.

Merge batches sequentially. Synchronization with a moving base requires renewed checks.
Require successful configured CI on the current head and merge with `--match-head-commit`.
Establish no-CI configuration explicitly; an empty check list alone is insufficient.
The adapter decides source status only after its evidence requirements are met.

Remove only worktrees created by this run after successful authorized delivery, with no
uncommitted or unpushed work. Use normal `git worktree remove`, never `--force`.
Preserve reused checkouts and unfinished work. Stop resources owned by this run on every
terminal path, except an explicitly requested shipping worker handed off with its handle.
Report results and pending actions without scheduling future work.
