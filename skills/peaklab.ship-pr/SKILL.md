---
name: peaklab.ship-pr
description: "Review and finalize a branch into a merged PR when the user requests shipping."
effort: deep
disable-model-invocation: true
allowed-tools: "Bash(git :*), Bash(gh :*), Bash(pnpm :*), Bash(curl :*), Bash(jq :*), Bash(python3 :*), Read, Edit, MultiEdit, Skill, Agent, Task"
argument-hint: "[--pr NUMBER|URL --repo OWNER/REPO --worktree PATH --task-state PATH] [--base BRANCH] [--draft] [--no-merge] [--auto-fix] [--plane]"
---

# Ship a PR

Deliver the bound PR using existing evidence, one correction loop, and a verified merge.
Do not turn delivery into a new implementation or cleanup project.

## Arguments and authority

| Argument | Meaning |
|---|---|
| `--pr NUMBER\|URL` | Existing PR; otherwise resolve the standalone checkout branch |
| `--repo OWNER/REPO` | Repository; otherwise resolve the standalone checkout remote |
| `--worktree PATH` | Absolute checkout; otherwise the standalone current checkout |
| `--task-state PATH` | Canonical artifact; required with all three target flags for composed calls |
| `--base BRANCH` | Explicit base subject to policy; otherwise preserve a valid existing PR base |
| `--draft` | Create a draft; never mark a draft ready or merge automatically |
| `--no-merge` | Stop after local validation and review; skip CI waiting and merge |
| `--auto-fix` | Compatibility flag; in-scope blocking fixes are already part of delivery |
| `--plane` | After merge, sync confirmed Plane tickets; offer missing tickets |

Only one delivery owner runs this workflow. The caller retains source selection/status and
checkout cleanup. If nested invocation is unavailable, read this installed file and use available
tools; do not enable it globally or start another shipping loop.
Never force-push, bypass protections, include unrelated edits, or add generated/co-author attribution.
Product decisions, scope expansion and unrelated issue creation require user authorization.
Every stop below goes through "Return and stop"; it is not an immediate unrecorded response.
Notation `blocked: reason` means separate fields `status: blocked` and `reason`, not a combined status.

## 1. Bind the target and resume state

Composed calls require `--pr`, `--repo`, `--worktree`, `--task-state` together. Read the artifact
in place: repository, PR URL, absolute checkout, branch, expected head/base SHAs, base branch,
scope/criteria, validation commands/results with revision/environment, and a review record or
its explicit absence. Map equivalent field names explicitly; missing/ambiguous identities return
`blocked: target_mismatch`. Do not create a second task state or infer the parent's checkout.

Standalone calls resolve these identities once and reuse a task-specific artifact on resumption.
Record `REPO`, `WORKTREE`, `BRANCH`, `PR_NUMBER`, `HEAD_SHA`, `BASE_SHA`.
Run local commands only in `WORKTREE`; scope every `gh` command with `--repo "$REPO"` or its
explicit repository API path. Verify the checkout remote and PR head repository mapping.
An unmapped fork or branch/head mismatch blocks fixes; never reset, stash or switch another
checkout to make it match. Preserve initial user-owned hunks.

Fetch PR state, head/base and draft flag. A merged PR returns its verified result and only an
explicitly requested sync; a closed unmerged PR returns `closed_unmerged`.
Without an explicit PR, find one for the bound branch; multiple matches need disambiguation.
If absent, create it following repository conventions with an explicit resolved base and any
requested draft flag. Preserve a policy-valid existing base. Retarget only with authority and
invalidate affected evidence. Never substitute another PR for an explicit target.

Persist recovery state before corrections:

- `repair_budget: {limit: 3, used: N}`, shared across caller QA, local gates, review and CI.
- `repair_attempts`: blocker ID, evidence, hypothesis, head/base, changed paths and result.
- `ci_wait_seconds`: accumulated pending-CI wait, initially zero; default allowance 1200 seconds.
- Current review verdict, covered head/base/scope, validation evidence and terminal reason.

Reuse counters across phase changes, workers, pushes and invocations. For legacy state reconstruct
prior attempts from recorded history; unknown history requires clarification, not a guessed zero.
Initialize zero only for a confirmed fresh task with no previous corrections. Only an explicit
user grant extends exhausted budgets; record it. Do not automatically restart after a terminal blocker.

## 2. Validate and review once

Fetch the authoritative PR changed-path set and patch for the verified head/base pair before
reusing or starting review:

```bash
gh pr diff "$PR_NUMBER" --repo "$REPO" --name-only
gh pr diff "$PR_NUMBER" --repo "$REPO" --patch
```

Compare that set with task scope and any incoming review scope. A reusable review must cover every
changed path and the acceptance-relevant interactions between them; matching head/base SHAs do not
make a partial scope complete. Review uncovered or unexpected paths and renew the combined verdict.

Discover applicable checks from repository instructions/scripts. Reuse results only when their
recorded commands cover the checks applicable to the complete changed-path set and code, dependencies,
configuration and relevant environment still match. A matching revision does not broaden narrow
validation evidence. Otherwise run affected checks, including appropriate structural checks for
documentation. Preserve exit codes and diagnostic output. Failures enter section 3; there is no
separate local-fix loop.

An explicit review is mandatory before merge; CI success is not a review. Reuse a valid incoming
verdict for the exact head/base, scope and environment: do not launch another full review.
If absent, review the task diff against criteria and policy. Delegate when useful, adding a specialist
only for a distinct risk; otherwise write findings locally. Cover applicable logic, authorization,
tenant boundaries, failure modes, tests and unrelated changes.

- **Blocking**: demonstrated correctness/security regression, unmet acceptance criterion or required
  repository gate. Record file/line or check, impact and a reproducible case or concrete code-path
  argument. Validate reviewer claims before changing code.
- **Suggestion**: style, optional refactoring, speculative hardening or unrelated improvement.
  Report without implementing. Unknown product choices require a decision, not speculative edits.
- A pre-existing/out-of-scope defect is not automatically this PR's responsibility. If it prevents
  safe delivery or a required gate, stop; otherwise report separately. Filing a ticket never clears
  a blocker. Use `peaklab.gh-create-issue` only with separate tracking authorization.

Record `review_completed_no_blockers`, `review_blockers_fixed` (only after verification), or
`review_blocked_do_not_merge`. After a head/base change, review the delta and affected interactions,
then renew the verdict. Expand coverage only when earlier assumptions are invalidated.
Do not reopen a closed finding without new evidence.

## 3. One correction loop

Use this loop for local-check, review and current-head CI failures:

1. Identify the actual blocker and latest evidence. For CI read the failed job/run for this head
   SHA, not the branch's historical failure. Missing logs or unrelated failures require a blocker
   report, not speculative code changes.
2. Check persisted budget/history before another attempt. If `used >= limit`, return
   `blocked: repair_budget_exhausted`. An attempt is one hypothesis-driven repair batch followed
   by validation, including failed/uncommitted repairs, not one commit or tool call.
3. If the same failure persists without new evidence or a materially different supported hypothesis,
   return `blocked: no_progress`. A new SHA, reworded finding or identical rerun alone is not progress.
   Do not oscillate between opposite fixes.
4. Increment and persist `used` BEFORE editing; record hypothesis and expected verification.
   Repair only in-scope blockers, run affected checks and record the result even on failure.
5. If locally validated, commit/push only owned hunks using repository conventions. Refresh
   head/base identities and canonical state; review the repair delta and renew affected evidence.
   On verification failure return to step 1 with the same counter, never a nested fix loop.

Leave the loop immediately when blockers clear. Exhaustion prohibits more repairs, not successful
verification or delivery of the last allowed repair. Suggestions consume no attempts because they
are not implemented. At the recorded limit with a remaining blocker, stop with evidence and the
specific decision needed; never reset the counter implicitly.

## 4. Check CI within a bounded wait

After clean local validation/review, `--no-merge` returns `pr_created` with
`CI: not_checked_pr_only`. Drafts also stop at `pr_created` without automatic readiness or merge.
These outcomes are not CI success or delivery evidence.

Inspect current-head checks, Actions runs and repository-required status checks:

```bash
gh pr checks "$PR_NUMBER" --repo "$REPO" --json name,state,workflow,link
gh run list --repo "$REPO" --branch "$BRANCH" --commit "$HEAD_SHA" --limit 20 --json databaseId,status,conclusion,workflowName,headSha,url
git ls-tree -r --name-only "$HEAD_SHA" -- .github/workflows
git ls-tree -r --name-only "$BASE_SHA" -- .github/workflows
```

Follow additional pages when needed; truncation is not proof of missing CI. Workflow files or
required checks mean local success cannot replace remote CI. Missing/unavailable required results
return `blocked: missing_ci`; never push empty commits to provoke a run.
Establish `ci_not_configured_no_remote_checks` only when there are no workflow files in either the
reviewed base or PR head, no required checks and no runs for the head branch. A PR cannot establish
that CI is unconfigured by deleting or disabling the base workflow.
Unknown protection settings are not evidence of absence.

For pending runs poll in this turn with waits of at most 60 seconds and progress updates.
Accumulate elapsed pending wait in `ci_wait_seconds` across runs, pushes and resumptions.
At the allowance return `blocked: ci_wait_exhausted`, `CI: pending`, with run URLs.
Pending state is not a defect: do not edit or rerun jobs merely because it is unchanged.
Do not use an unbounded watch. Current-head failures enter section 3; successful applicable workflows
and required checks proceed to merge. Canceled, skipped, empty or unavailable results are not
successful workflow evidence.

## 5. Merge once and verify

Require a clean explicit review and successful configured CI, or the established no-CI classification
with passed local validation. Re-fetch PR head and remote base immediately before merge.
An unexpected external head change returns `blocked: target_mismatch`. For a changed base, renew
affected validation/delta review once, invalidate prior CI/no-CI evidence and repeat section 4 against
the new pair. If the base moves again before merge, return `blocked: moving_base` rather than repeatedly
chasing it. Any needed repair still uses section 3.
Never merge a draft or bypass branch protections, approvals or the repository's merge strategy.

Use the approved strategy (`--squash` below is an example), pinning the verified head:

```bash
gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --match-head-commit "$HEAD_SHA"
gh pr view "$PR_NUMBER" --repo "$REPO" --json state,url,mergeCommit
```

Verify state even if the merge command errors. Only `state=MERGED` yields `merged`; otherwise
report the actual blocker without blindly retrying merge. Head pinning does not atomically pin
the base: that protection depends on repository branch protection or its merge queue.
Leave branch/worktree deletion and checkout switching to the caller.

## 6. Optional Plane sync

Only `--plane`, verified merge into the permitted default branch, and no caller-owned sync enable
this step. Otherwise report a skip. A merge does not necessarily mean Done or deployed.

1. Load [the Plane API](../peaklab.plane-api/SKILL.md) for atomic `PLANE_TOKEN`/`PLANE_PROJECT`
   configuration and paginated metadata. Resolve resources from installed skill directories.
2. Extract exact source identifiers, verify project and acceptance coverage. Title/file similarity
   supplies candidates only; confirm inferred matches before updates.
3. Use [the merge-state helper](../peaklab.plane-do-issue/scripts/finish_issue.py), resolving
   `PLANE_DO_ISSUE_DIR` from the installed package:

   ```bash
   python3 "$PLANE_DO_ISSUE_DIR/scripts/finish_issue.py" --merged --issue "$ISSUE" --pr-url "$PR_URL"
   ```

   The helper owns dynamic states and atomic `PLANE_MERGED_STATE` overrides. Report its actual result.
4. Offer one ticket per coherent untracked behavior; after confirmation use
   `peaklab.plane-create-issue` with evidence and an explicitly resolved requested state.
5. Sync failure returns `merged` with `plane_sync=failed` and a recoverable error; never restart
   delivery or claim the source transition succeeded.

## Return and stop

Before the final response, write `status`, `reason` (null on success), and `ci` to canonical task
state, preserving counters/history and other fields. If that write fails, report the persistence
failure; never claim a saved result. A safe refusal can stop before remote verification, but must
not claim those identities were verified. Successful delivery always requires target verification.
Persist and report PR/repository, `pr_created|merged|blocked|closed_unmerged`, verified head and
merge commit if any, review/CI evidence, suggestions, repair count and Plane result. For a blocker,
include its reason, last attempt and next decision. Stop at the requested terminal state.
Do not schedule follow-up work. Explicitly requested deferred monitoring requires one bounded loop
for all targets, `pass k/N` with N ≤ 8, backoff 1h → 3h → 12h → stop, no self-rearming, and a
reported handle/cancellation method. Monitoring never resets repair or wait budgets.
