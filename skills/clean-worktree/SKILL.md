---
name: clean-worktree
description: "Close out finished branches and worktrees: ship the linked PR if asked, remove worktree, branches, Docker resources and processes, return to main."
disable-model-invocation: true
argument-hint: "[PATH|BRANCH ...] [--ship] [--all-merged] [--dry-run] [--keep-remote] [--keep-volumes]"
---

# Clean worktrees

Remove finished branches, their linked worktrees and the resources they created, without touching
the default branch, shared resources or unfinished work. Invoking this skill authorizes deleting what
the plan below proves belongs only to the selected targets; anything uncertain is reported, not deleted.

| Argument | Meaning |
|---|---|
| `PATH\|BRANCH ...` | Targets; default is the current linked worktree, or the current branch of the main checkout |
| `--ship` | Ship a selected branch's open PR before cleaning it |
| `--all-merged` | Select every linked worktree whose branch is merged or whose PR is merged |
| `--dry-run` | Build and report the plan only |
| `--keep-remote` | Keep remote branches |
| `--keep-volumes` | Keep the Docker volumes of the selected worktrees |

A target is either a linked worktree with its branch, or a branch checked out in the main checkout
(no worktree to remove: steps 2 and 3 do not apply). Git refuses to delete a checked-out branch, so
run step 5 before step 4 for such a target.

## 1. Inventory

Run from the repository's main checkout (`git rev-parse --path-format=absolute --git-common-dir`,
then its parent) as `MAIN_CHECKOUT`. Resolve `DEFAULT` from
`git symbolic-ref --short refs/remotes/origin/HEAD` (strip `origin/`). Never select the default
branch, a protected branch, or the main checkout directory itself.

```bash
git worktree list --porcelain
git fetch --prune
```

For each selected worktree record path, branch, head, and:

- **Changes**: `git -C "$WT" status --porcelain` (tracked or untracked; ignored files are disposable).
- **Unpushed work**: commits not on the upstream or, without upstream, not on any remote branch.
- **Merge state**: `git branch --merged "$DEFAULT"`, or for squash/rebase merges
  `gh pr list --repo "$REPO" --head "$BRANCH" --state merged --json number,headRefOid`
  with a PR head equal to the local tip. A local tip ahead of the merged PR head is unpushed work.
- **Owner**: a worktree manager (Orca, Superset, IDE) that registered it. Use that tool's own removal
  command when available so its state stays consistent.

Changes, unpushed work or an unmerged branch block that target. Report them and ask; never
stash, reset, or pass `--force` to make removal succeed.

With `--ship`, an open PR whose branch has no uncommitted changes is not a blocker: read and follow
[peaklab.ship-pr](../peaklab.ship-pr/SKILL.md) for it (not model-invocable, so follow the file), which
also pushes its local commits. Continue only when it ends `merged`; otherwise report its blocker.
A closed unmerged PR always blocks. Pre-push hooks may need the project's services (database
containers): start them rather than bypassing the hook.

## 2. Runtime resources

Stop what runs from the worktree before deleting its files:

- **Docker Compose**: find projects whose working directory is inside the worktree.

  ```bash
  docker ps -a --filter "label=com.docker.compose.project.working_dir" \
    --format '{{.Label "com.docker.compose.project"}} {{.Label "com.docker.compose.project.working_dir"}}'
  docker compose -p "$PROJECT" down --remove-orphans --rmi local --volumes
  ```

  Drop `--volumes` with `--keep-volumes`, or when a volume is external or used by a container of
  another project (`docker ps -a --filter volume=NAME`). Containers started outside Compose count only
  when a bind mount points inside the worktree. Never run global prunes (`docker system prune`,
  `docker builder prune`): they delete other projects' resources.
- **Processes**: dev servers, watchers or test runners whose working directory is inside the worktree
  (`lsof -a -d cwd +D "$WT"`). Stop them with SIGTERM and report them; leave processes whose working
  directory is elsewhere even if they have a file open in the worktree.

## 3. Files and caches

In-tree caches (`node_modules`, `.venv`, `.next`, `dist`, build output, a copied `.env`) disappear
with the worktree directory. Outside the worktree delete only caches keyed by its exact path, such as
a tool directory named after the worktree. Shared package-manager stores (npm, pnpm, bun, pip, uv,
Composer) and global build caches serve other checkouts: leave them.

```bash
git worktree remove "$WT"
git worktree prune
```

If `git worktree remove` refuses, return to step 1 instead of forcing. Remove manager placeholders
and the parent worktrees directory only when empty (`rmdir`, never `rm -rf`).

## 4. Branches

- Local: `git branch -d "$BRANCH"`; for a verified squash/rebase merge whose PR head equals the
  local tip, `git branch -D "$BRANCH"`.
- Remote, unless `--keep-remote`: delete only a merged branch whose PR head equals the remote tip and
  that is not the default or a protected branch:
  `gh api -X DELETE "repos/$REPO/git/refs/heads/$BRANCH"`. Prefer it to `git push --delete`, which
  runs the local pre-push hook (often the full test suite) for a mere deletion.
  A remote branch already deleted by the merge needs no action.
- Never delete an unmerged branch, another person's branch, or a branch used by another worktree.

## 5. Return to the default branch

Always finish in the main checkout on the default branch (usually `main`), up to date:

```bash
cd "$MAIN_CHECKOUT"
git switch "$DEFAULT"
git pull --ff-only
```

Do this even when the main checkout was on another branch. If it has uncommitted changes, or the
switch or fast-forward is refused, leave it as is and report why; never stash, reset or merge.
When the session ran inside a removed worktree, continue from the main checkout.

## 6. Report

List per target: PR shipped (number, merge commit), removed path, branches deleted (local/remote), Docker projects, volumes and images
removed, processes stopped, the final branch of the main checkout, and everything skipped with its
reason and the decision needed.
`--dry-run` reports the same plan with nothing executed.
