---
name: "peaklab.plane-ship-watch"
description: "Use when peaklab.plane-do-issue has created a PR or when a Plane-linked GitHub PR needs non-blocking CI, rebase, conflict handling, review fixes, merge, and Plane sync in an isolated worktree."
effort: standard
argument-hint: "[PR_NUMBER | PR_URL] [--issue PREFIX-N] [--base main] [--max-fix 3]"
allowed-tools: "Bash(git:*), Bash(gh:*), Bash(rg:*), Bash(pnpm:*), Bash(npm:*), Bash(curl:*), Bash(jq:*), Bash(plane:*), Read, Write, Edit, MultiEdit, Skill, Agent, Task"
---

<objective>
Finish a Plane issue PR without blocking the main orchestrator. The watcher owns the slow part of shipping: branch freshness, merge conflicts, GitHub Actions, review comments, CI fixes, final merge, and Plane sync.
</objective>

<tooling_rationale>
This watcher keeps broad git/edit tools because it works in an isolated worktree to rebase, resolve safe conflicts, fix CI, commit, push, and merge. It must not mutate the parent repository worktree.
</tooling_rationale>

<quick_start>
Use this skill after `peaklab.plane-do-issue` has created or updated a PR:

```bash
gh pr view <PR_NUMBER_OR_URL> --json number,url,headRefName,baseRefName,headRefOid,mergeStateStatus
```

Create a status directory:

```bash
mkdir -p .agents/tasks/plane-ship/PR-<number>
```

Write every state transition to:

```text
.agents/tasks/plane-ship/PR-<number>/status.md
```
</quick_start>

<workflow>
1. Resolve PR metadata:
   ```bash
   gh pr view "$PR" --json number,url,headRefName,baseRefName,headRefOid,mergeStateStatus,state
   ```
   Stop if the PR is closed or merged already. If merged and an issue is known, sync Plane with `finish_issue.py --merged --issue <PREFIX-N>`.

2. Create an isolated worktree for all watcher mutations, hard-aligned to the TRUE PR head:
   ```bash
   TASK_DIR=".agents/tasks/plane-ship/PR-$PR_NUMBER"
   WORKTREE="$TASK_DIR/worktree"
   git fetch origin
   git worktree add "$WORKTREE" "$HEAD_BRANCH" || true
   cd "$WORKTREE"
   git fetch origin
   git switch "$HEAD_BRANCH"
   git reset --hard "origin/$HEAD_BRANCH"
   ```
   If `worktree add` fails because `$HEAD_BRANCH` is already checked out elsewhere
   (typically the do-issue implementation worktree), do NOT touch that worktree: add
   yours DETACHED at the PR head instead — `git worktree add --detach "$WORKTREE"
   "origin/$HEAD_BRANCH"` — and push later with `git push origin HEAD:"$HEAD_BRANCH"`.
   Then verify the aligned head matches the PR head GitHub reports:
   ```bash
   [ "$(git rev-parse HEAD)" = "$HEAD_REF_OID" ]
   ```
   On mismatch, re-fetch PR metadata (step 1) and retry once; still mismatched → write
   `blocked_stale_head` to `status.md` and stop. This alignment is mandatory: rebasing a
   stale local branch and force-pushing silently erases newer remote commits —
   `--force-with-lease` does NOT protect against that once a fetch refreshed the
   remote-tracking ref.

3. Bring the branch up to date before waiting for CI:
   ```bash
   git fetch origin
   git rebase "origin/$BASE_BRANCH"
   ```
   Prefer rebase for short issue branches. Use `git push --force-with-lease origin HEAD` after a successful rebase.
   Force-push ONLY a branch that step 2 just hard-aligned to `origin/$HEAD_BRANCH`, and
   never while a rebase is in progress (`.git/rebase-merge` or `.git/rebase-apply` exists).

4. Conflict handling:
   - Inspect conflicted files with `git status --short` and `git diff --name-only --diff-filter=U`.
   - Resolve only localized, directly understandable conflicts where the issue intent and current base behavior are clear.
   - After resolving, run targeted tests for touched packages, then:
     ```bash
     git add <resolved-files>
     git rebase --continue
     git push --force-with-lease origin HEAD
     ```
   - If conflicts are broad, architectural, generated-file heavy, or ambiguous, stop. Write `blocked_conflict` to `status.md` with conflicted files, attempted commands, and the manual decision needed. Do not merge.
   - When blocking on a conflict, leave the worktree mid-rebase for human inspection and
     say so in `status.md`. Never push in that state; the remote branch must keep the
     last verified head untouched.

5. Review and CI loop:
   - Re-run or perform the required review from `peaklab.ship-pr` if it has not been completed.
   - Check CI for the current head SHA:
     ```bash
     gh pr checks "$PR_NUMBER" --json name,state,workflow,link
     gh run list --branch "$HEAD_BRANCH" --limit 5 --json databaseId,status,conclusion,workflowName,headSha,url
     ```
   - If CI is pending, wait INSIDE a blocking command — never end your turn while
     checks are pending (an idle watcher silently abandons the PR):
     ```bash
     gh pr checks "$PR_NUMBER" --watch --fail-fast
     ```
     Use a long Bash timeout (10 min), and re-run the watch command if it times out
     before checks settle.
   - If CI fails, fetch failed logs, classify root cause, fix only in-scope failures, commit, push, and loop.
   - Formatter/linter failures ("Would reformat", import order, etc.): NEVER fix by
     hand-editing. Run the repo-pinned tool itself so output is byte-identical to CI
     (e.g. `cd packages/back && uv run ruff format <files>`; front: `pnpm --filter
     front lint --fix`). Verify with the tool's `--check` mode before pushing. A
     tool run replaces manual attempts and does not burn a fix iteration.
   - Stop after `--max-fix` iterations, default 3, with `blocked_ci` in `status.md`.

6. Race protection before merge:
   - Re-fetch PR metadata.
   - Verify the head SHA you tested is still the PR head.
   - Verify the branch is mergeable and not stale.
   - Verify GitHub Actions is green for that exact SHA.
   - If anything changed, restart from step 2.

7. Merge, pinned to the exact SHA verified in step 6:
   ```bash
   gh pr merge "$PR_NUMBER" --squash --delete-branch --match-head-commit "$HEAD_SHA"
   ```
   `--match-head-commit` makes GitHub reject the merge server-side if the head moved
   after step 6 — this closes the verify→merge race window. If it fails for that
   reason, restart from step 2.
   A non-zero exit does NOT always mean the merge failed: `--delete-branch` also tries
   to delete the LOCAL branch and errors when another worktree (the do-issue one) still
   holds it. On non-zero exit, check `gh pr view --json state` first — if MERGED,
   continue; local branch deletion happens in cleanup (step 9).
   Never merge with pending checks, empty check status, missing Actions run, unreviewed blocking comments, unresolved conflicts, or a stale head SHA.

8. Plane sync:
   Always pass `--issue <PREFIX-N>` when the watcher received one; the shared state file
   is a fallback only and may point at another session's ticket when runs are concurrent.
   ```bash
   python3 skill://peaklab.plane-do-issue/scripts/finish_issue.py --merged --issue "$ISSUE" --pr-url "$PR_URL"
   ```
   If the watcher blocks permanently after a PR exists, use:
   ```bash
   python3 skill://peaklab.plane-do-issue/scripts/finish_issue.py --blocked --issue "$ISSUE" --pr-url "$PR_URL"
   ```
   Omit `--issue` only when no issue identifier is known AND no other Plane run may be
   active; otherwise skip the sync and record the manual command in `status.md`.

   The target state is not always `Done`: `PLANE_MERGED_STATE` / `PLANE_BLOCKED_STATE` in the Plane
   config source override it by exact name. Report the state the script printed, not an assumed one.

9. Cleanup after a successful merge + Plane sync (skip entirely when blocked):
   ```bash
   cd "$REPO_ROOT"
   git worktree remove "$WORKTREE" --force
   git worktree remove ".worktrees/<issue-worktree>" --force 2>/dev/null || true
   git worktree prune
   git branch -D "$HEAD_BRANCH" 2>/dev/null || true
   ```
   - cd OUT of the watcher worktree first; removing your own cwd fails.
   - Remove the do-issue implementation worktree under `.worktrees/` only if its branch
     is the merged head branch and `git -C <path> status --short` is clean.
   - Never touch other issues' worktrees. Record the cleanup in `status.md`.
</workflow>

<async_contract>
When launched as a background/delegated agent:

- Run as the `plane-ship-watcher` agent. Its frontmatter is the single source of truth
  for model and effort; callers must not override it. Do not substitute a fast tier:
  it previously idled while CI was pending and hand-edited formatter fixes instead of
  running the repository tool, which cost more than the apparent saving.

- The parent orchestrator should not wait for GitHub Actions.
- The watcher must own its isolated worktree.
- The watcher must update `status.md` at start, after every push, on every blocker, and after merge.
- The watcher must never change the parent worktree.
- The watcher must never merge unless CI is green for the exact current PR head SHA.
- The watcher is bounded by its own turn. It waits inside blocking commands (step 5); it must never
  schedule a deferred re-check — cloud routine, `send_later`, cron, `/loop` — to resume later. A
  blocker goes to `status.md` and the watcher ends. `blocked_*` is a finished watcher, not a paused one.
- Re-arming from inside a watch has no reachable stop condition when the blocker is "waiting for a
  human": it polls a frozen state forever, each pass rebuilding a full session. If the user explicitly
  wants post-run monitoring, use ONE loop covering every open PR, with a pass cap (`pass k/N`, N ≤ 8)
  written into its own prompt and a 1h → 3h → 12h → stop backoff.
</async_contract>

<status_template>
Use this structure in `status.md`:

```markdown
# PR <number> Ship Watch

Status: running | rebasing | fixing_ci | blocked_stale_head | blocked_conflict | blocked_ci | merged
Issue: <PREFIX-N or empty>
PR: <url>
Branch: <head>
Base: <base>
Last checked head SHA: <sha>

## Timeline
- <timestamp>: <event>

## Blocker
<only when blocked>
```
</status_template>

<success_criteria>
- A merged PR is reported with its URL and Plane is synced to Done.
- Or a blocker is recorded in `status.md` with enough detail for a human or later agent to resume safely.
- The parent/orchestrator worktree remains untouched.
</success_criteria>
