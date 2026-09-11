---
name: peaklab.ship-pr
description: Use when the user says "ship", "ship PR", "review and merge", or wants to finalize a branch into a clean merged PR.
effort: deep
disable-model-invocation: true
allowed-tools: "Bash(git :*), Bash(gh :*), Bash(pnpm :*), Bash(curl :*), Bash(jq :*), Bash(python3 :*), Read, Edit, MultiEdit, Skill, Agent, Task"
argument-hint: "[--pr NUMBER|URL --repo OWNER/REPO --worktree PATH --task-state PATH] [--base BRANCH] [--draft] [--no-merge] [--auto-fix] [--plane]"
---

<objective>
Orchestrate the full PR lifecycle: create, review, fix, merge. Uses GitHub commands plus explicit review and issue-tracking steps; optionally syncs with Plane after merge.
</objective>
<arguments>
| Argument          | Description                                                                       | Default |
|-------------------|-----------------------------------------------------------------------------------|---------|
| `--pr NUMBER\|URL` | Existing PR to deliver; required for composed issue workflows                     | current branch only for a standalone invocation |
| `--repo OWNER/REPO` | GitHub repository containing the PR                                               | resolve from checkout for standalone use |
| `--worktree PATH` | Absolute checkout for all local commands                                           | current checkout for standalone use |
| `--task-state PATH` | Absolute canonical caller artifact containing the handoff below                  | required for composed calls |
| `--base <branch>` | Explicit base override, subject to repository policy                             | existing PR base, otherwise repository policy or remote default |
| `--draft`         | Create PR as draft                                                                | `false` |
| `--no-merge`      | Stop after fix, don't merge                                                       | `false` |
| `--auto-fix`      | Compatibility flag: in-scope review fixes are part of authorized delivery          | automatic in scope |
| `--plane`         | Sync confirmed Plane tickets to their configured merge state; offer missing tickets | `false` |
</arguments>
<env>
Required when using --plane (same vars as `peaklab.plane-do-issue`):
- PLANE_TOKEN   : Plane API key
- PLANE_PROJECT : Full project URL (https://{host}/{workspace}/projects/{id}/issues/)
</env>
<constraints>
- Phase 3 CODE REVIEW is mandatory for every non-draft PR before CI checks and merge.
- Never merge a PR when the review phase was skipped, failed, or only happened as an implicit "diff looked fine" check.
- The review result must be explicit before merge: `review_completed_no_blockers`, `review_blockers_fixed`, or `review_blocked_do_not_merge`.
- If delegated review agents are unavailable or disallowed by the host environment, perform the same review locally in code-review stance instead of skipping it.
- `gh pr checks` returning no checks is not a review result; it only means remote CI is absent.
- When the repository has GitHub Actions workflows or required status checks, never merge unless GitHub Actions has completed successfully for the current PR head commit. Local checks are useful preflight, but they never replace a configured remote CI run.
- When the repository has no `.github/workflows/*` files, no required branch status checks, and `gh run list` returns no runs for the PR head branch, classify CI as `ci_not_configured_no_remote_checks`. In that case, merge is allowed after the mandatory review outcome is clean and the best available local validation has passed.
- Empty PR check rollups, missing checks, pending workflow runs with no jobs, or unavailable GitHub Actions status are blockers only when remote CI is configured or branch protection requires checks. Wait for GitHub Actions or stop and report the blocker.
</constraints>
<workflow>
## Bind the delivery target

For a caller-owned issue workflow, require `--pr`, `--repo`, `--worktree` and `--task-state` together.
Read that canonical artifact in place; do not create a second task state. Its minimal shipping
handoff contains `repository`, `pr_url`, `worktree_path`, `branch`, `expected_head_sha`,
`base_branch`, `expected_base_sha`, scope/acceptance criteria, and validation commands/results
with their covered revision/environment. Review is either explicitly absent or records its
verdict, reviewed head/base and covered scope. Existing field names may be mapped explicitly;
missing required identities or ambiguous mappings block delivery, not trigger guessed defaults.
Reject an incomplete target instead of falling back to the parent's current branch.
Standalone `ship` may resolve the target from the current checkout once, before any mutation.

1. Set `WORKTREE` to its absolute path and resolve `REPO`, checkout `BRANCH` and any existing `PR_NUMBER`. Run every git,
   package and local validation command in that checkout; scope every `gh` command to
   `--repo "$REPO"` (or the matching explicit `repos/$REPO/...` API path).
2. Verify the checkout's remote belongs to that repository. For an existing PR, fetch metadata
   with `gh pr view "$PR_NUMBER" --repo "$REPO"`: head branch/SHA, base, state and draft flag.
   The checkout branch and HEAD must match the task state and PR head before local fixes.
   A mismatch returns `blocked` with reason `target_mismatch`; do not switch/reset/stash another checkout.
   Cross-repository PRs require an explicitly mapped head remote; otherwise stop safely.
3. Preserve initial dirty hunks. Already merged PRs need no new merge: report the verified
   state, then run only an explicitly requested status sync. Closed unmerged PRs stop.

`disable-model-invocation` controls automatic discovery, not delivery authority. If the host
refuses a nested Skill invocation, the authorized delivery owner reads this installed file
and executes the same phases through available tools. Do not enable the skill globally,
invent a second merge loop, or bypass any review/CI gate.

## Incoming evidence and execution scope

Accept a caller's validation record and explicit review verdict when they identify the current
head SHA, base SHA, reviewed scope and relevant environment. Verify those identities before
reuse. A missing verdict is not supplied by a successful CI run. A changed head/base requires
reviewing the delta and renewing the verdict; rerun validation affected by code, dependency,
configuration or environment changes. Do not repeat checks just because this skill was invoked.

The caller may own selection, implementation and source-specific status updates. This skill owns
only the requested PR delivery phase; do not launch a second shipping owner. Respect repository
branch policies and the caller's explicit base. Draft PRs are never merged by this workflow.

## Phase 1: ENSURE PR EXISTS

1. For an explicit `--pr`, use only that verified PR. Otherwise check the bound checkout branch:
   ```bash
   gh pr list --repo "$REPO" --head "$BRANCH" --json number,url,state
   ```
   Multiple matches require disambiguation. Never substitute another PR for an explicit target.
2. **If PR exists**: capture its number, URL, head and base. Preserve a policy-valid existing
   base unless `--base` explicitly requests another. A policy mismatch without retargeting
   authority is a blocker. After an authorized retarget, invalidate prior review/CI evidence.
3. **If no PR**: create one with `gh pr create` following the repository's PR conventions.
   - Pass `--draft` if provided
   - Always pass the base resolved from repository policy, the explicit argument or remote default
4. Capture `PR_NUMBER`, `REPO`, `WORKTREE`, `BRANCH`, `HEAD_SHA` and the base SHA for subsequent phases. Refresh the SHA variables after every authorized edit/push before collecting evidence.

---

## Phase 2: QUALITY GATES

Discover the repository's actual checks from its instructions and scripts. Reuse valid incoming
results; otherwise run the applicable typecheck, lint, tests and build checks for the changed
scope. Documentation-only changes need relevant structural/discovery checks, not an invented
Node command. Fix failures caused by this work and rerun affected checks. Preserve exit codes
and enough output to diagnose failure. Report unrelated failures separately.

---

## Phase 3: CODE REVIEW

This phase is mandatory. Do not proceed to CI checks or merge until it has an explicit outcome.

1. Fetch the PR diff and changed file list:
   ```bash
   gh pr diff "$PR_NUMBER" --repo "$REPO" --name-only
   gh pr diff "$PR_NUMBER" --repo "$REPO" --patch
   ```
2. Reuse a valid incoming review or execute it:
   - When delegation helps, use one reviewer appropriate to the changed scope. Add an independent
     specialist only for a distinct risk, such as security or cross-service contracts.
   - Fallback, when agents are unavailable or not permitted: perform the same review locally in code-review stance. This fallback is valid only if findings are written explicitly.
3. Inspect at least:
   - changed routes/actions/API endpoints
   - authorization and tenant boundaries
   - runtime failure modes and timeout behavior
   - tests and validation coverage
   - unrelated files included in the PR
4. Collect findings and classify:
   - **[BLOCKING]**: must fix before merge
   - **[SUGGESTION]**: desirable improvement, non-blocking
   - **[NO ISSUE]**: explicitly state no blocking findings found
5. Present the review summary before Phase 4. Include file/line references for every finding.
6. Set exactly one review outcome:
   - `review_completed_no_blockers`
   - `review_blockers_fixed`
   - `review_blocked_do_not_merge`

If no review outcome is set, stop. Do not merge.

---

## Phase 4: FIX ISSUES

**If [BLOCKING] issues are found:**

1. Classify each blocking issue:
   - **In-scope** (directly related to this PR's changes) → fix inline
   - **Out-of-scope** (pre-existing problem, separate concern, or too large) → report; create an issue only if authorized

2. For separately authorized tracking, use the `peaklab.gh-create-issue` skill:
   - Title: `fix(scope): <description of the problem>`
   - Body: include the file path, line numbers, and why it was flagged
   - Label: `bug` or `enhancement` depending on nature

3. For in-scope fixes:
   - Correct in-scope findings as part of the authorized delivery; `--auto-fix` retains this behavior.
   - Ask only when the correction needs a product decision, new authority or scope expansion.
   - Read the target file, apply the fix and run affected repository checks.

4. Commit and push in-scope fixes:
   Stage only owned hunks; the full-file command below is valid only for wholly owned files.
   ```bash
   git add <specific-files>
   git commit -m "fix: address review findings"
   git push origin HEAD
   ```
5. Renew affected validation and review evidence for the new head (Phases 2 and 3).
6. If new issues appear: loop (max 3 iterations).

**If only SUGGESTION issues:**

- Report them but proceed to merge
- Offer important suggestions for tracking; do not create unrelated issues without authorization

---

## Phase 5: CI CHECKS

**For `--no-merge`, return `pr_created` with the current review verdict and `CI: not_checked_pr_only` after Phase 4; skip CI/merge phases. This status is not CI success or delivery evidence.**

1. Get current CI status:
   ```bash
   gh pr checks "$PR_NUMBER" --repo "$REPO" --json name,state,workflow,link
   ```
2. If no checks are reported, inspect whether remote CI is configured:
   ```bash
   BRANCH=$(git branch --show-current)
   gh run list --repo "$REPO" --branch "$BRANCH" --commit "$HEAD_SHA" --limit 5 --json databaseId,status,conclusion,workflowName,headSha,url
   git ls-tree -r --name-only HEAD .github/workflows 2>/dev/null
   ```
   - If a run for the PR head SHA is pending or in progress, wait for it.
   - If workflow files exist but no GitHub Actions run exists for the PR head SHA, stop and report `blocked: no GitHub Actions status for current head`.
   - If no workflow files exist and no runs are reported, set review/CI status to `ci_not_configured_no_remote_checks`, report the local validation used instead, and proceed to Phase 7.
3. If all GitHub Actions checks pass for the current PR head SHA → jump to Phase 7 MERGE.
4. If checks are pending → wait:
   ```bash
   gh pr checks "$PR_NUMBER" --repo "$REPO" --watch --interval 15
   ```
5. If any check fails → go to Phase 6 FIX CI

## Phase 6: FIX CI _(draws from shared 3-iteration budget)_

For each iteration:

**Step 1 — Fetch failed logs**

```bash
BRANCH=$(git branch --show-current)
RUN_ID=$(gh run list --repo "$REPO" --branch "$BRANCH" --commit "$HEAD_SHA" --status failure --limit 1 --json databaseId -q '.[0].databaseId')
gh run view "$RUN_ID" --repo "$REPO" --log-failed
```

**Step 2 — Classify the failure**

For each failing job, decide:

- **Fix inline** (quick, directly caused by this PR's changes)
- **Report blocker** (pre-existing bug, unrelated regression, large refactor needed)

Use the actual failing command and repository-native fix for type, lint, test, build or
migration failures. Do not assume a package manager or introduce unrelated cleanup.

**For separately authorized tracking of out-of-scope CI failures** — use `peaklab.gh-create-issue`:

- Title: `fix(ci): <describe the root cause>`
- Include: error message, file/line, run ID (`gh run view "$RUN_ID" --repo "$REPO"`)
- Label: `bug`

**Step 3 — Verify locally before pushing**

Run the affected repository checks discovered in Phase 2. Record evidence for the repaired
tree; use the actual failing CI command when it can run locally.

**Step 4 — Commit and push**

Stage only owned hunks; do not include pre-existing edits in the same file.

```bash
git add <specific-files>
git commit -m "fix(ci): <describe what was fixed>"
git push origin HEAD
```

**Step 5 — Wait for new run**

Refresh `HEAD_SHA` after the push and renew the Phase 3 verdict for this exact commit before
continuing. A successful local check does not replace that review.

```bash
gh pr checks "$PR_NUMBER" --repo "$REPO" --watch --interval 15
```

**Step 6 — Check result**

- All green → Phase 7 MERGE
- Still failing → loop (max 3 iterations total)
- After 3 iterations: stop, report status, ask user for guidance

## Phase 7: MERGE

**Skip if `--no-merge` is provided.**

If the PR is a draft, report its status and stop; do not mark it ready or merge automatically.

Before merging, assert Phase 3 review outcome is `review_completed_no_blockers` or `review_blockers_fixed`. Then re-check remote CI for the current PR head commit.

Re-fetch the PR head and remote base immediately before merge. Require the reviewed head/base
pair; if either changed, renew the affected validation and review before continuing. The merge
command pins the head only; atomic protection against a concurrent base update depends on the
repository's branch protection or merge queue. Use the repository-approved merge strategy
(`--squash` below is an example), without bypassing its protections.

Merge is allowed when either:
- GitHub Actions/checks are configured and the workflow conclusion is successful for the current head commit.
- CI status is explicitly `ci_not_configured_no_remote_checks` because the repository has no `.github/workflows/*`, no branch-required checks, and no workflow runs for the PR head branch; in this case, report the local validation commands that replaced remote CI.

Do not merge on local-only checks when remote CI is configured, empty check rollups with configured workflows, pending runs, skipped status without a successful workflow conclusion, or unavailable GitHub Actions status.

```bash
gh pr checks "$PR_NUMBER" --repo "$REPO" --json name,state,workflow,link
BRANCH=$(git branch --show-current)
gh run list --repo "$REPO" --branch "$BRANCH" --commit "$HEAD_SHA" --limit 5 --json databaseId,status,conclusion,workflowName,headSha,url
git ls-tree -r --name-only HEAD .github/workflows 2>/dev/null
```

```bash
gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --match-head-commit "$HEAD_SHA"
```

Verify `gh pr view "$PR_NUMBER" --repo "$REPO" --json state,url,mergeCommit` after the merge command, even if it returned an error. Only `state=MERGED` yields `status=merged`. Return repository, PR URL, verified head, merge commit, CI/review evidence and any blocker. Leave branch/worktree cleanup to the caller; never switch or delete the parent checkout.

---

## Phase 8: PLANE SYNC (--plane only)

Only an explicit `--plane` request enables this phase, after GitHub confirms the bound PR is
merged into the permitted default branch. A source adapter that already owns Plane sync must
not enable a second owner here.

1. Load [the shared Plane API](../peaklab.plane-api/SKILL.md) for atomic configuration and
   paginated metadata lookup. Use its installed directory, not an assumed home path.
2. Extract exact Plane identifiers from the PR's source links/body/branch and verify the
   configured project and acceptance-criteria coverage. A title/file similarity is only a
   candidate: obtain confirmation before updating such a ticket.
3. For each confirmed covered issue, use the existing
   [merge-state helper](../peaklab.plane-do-issue/scripts/finish_issue.py):

   ```bash
   python3 "$PLANE_DO_ISSUE_DIR/scripts/finish_issue.py" --merged --issue "$ISSUE" --pr-url "$PR_URL"
   ```

   Resolve `PLANE_DO_ISSUE_DIR` from that installed skill package. The helper owns dynamic
   state resolution, including `PLANE_MERGED_STATE` from the same atomic configuration source.
   Report its actual resulting state; a merge is not necessarily Done or deployed.
4. For completed work lacking a ticket, offer one ticket per coherent behavior, not per file.
   Only after confirmation, use `peaklab.plane-create-issue` with the reviewed description,
   evidence and dynamically resolved requested state. Do not create tickets directly.
5. If sync fails after merge, return `merged` with `plane_sync=failed` and the recoverable
   error. Never report a successful source transition merely because GitHub merged.

</workflow>
<rules>
- Don't force-push or rewrite history
- Don't merge with failing CI checks
- Don't skip the review phase
- Don't merge without waiting for CI to complete
- Max 3 fix iterations combined across Phase 4 (code review) + Phase 6 (CI) — track a shared counter, not per-phase
- If stuck after 3 total iterations: stop, report status, ask user for guidance
- Never arm a deferred re-check (cloud routine, `send_later`, cron, `/loop`) to keep watching the PR after this run. Waiting for CI happens inside Phase 5, in a blocking command, within this turn. If the PR still needs a human, the skill ends and says so — it does not schedule itself back
- If the user explicitly asks for post-run monitoring: one loop for all PRs, a pass cap written into its own prompt (`pass k/N`, N ≤ 8), backoff 1h → 3h → 12h → stop, and report what was armed
- Commit messages follow conventional commits format (`fix(ci): ...`)
- No "Generated with" or co-author tags
- --plane (Phase 8) only executes if merge succeeded AND base is the permitted default branch; report a skip otherwise
- Plane state IDs and configured merge-state overrides are resolved by the shared client/helper
- New tickets need confirmation and an explicit dynamically resolved state
- Inferred thematic ticket matches need confirmation before any Plane update
</rules>
<on_success>
On completion, display:
```
PR: <url>
Status: <pr_created|merged|blocked|closed_unmerged>
Review: <N blocking fixed inline, N suggestions>
CI: <passed|fixed in N iterations|not_checked_pr_only|not_configured|blocked|pending>
Issues created: <N> (list URLs if any)
Iterations: <N fix cycles>
Plane: <ticket moved|tickets created|skipped>
```
</on_success>
User: $ARGUMENTS
