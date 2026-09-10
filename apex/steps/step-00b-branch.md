---
name: step-00b-branch
description: Prepare a task branch when branch or PR mode was explicitly selected
returns_to: step-00-init.md
---

# Optional setup: branch

Run only when `{branch_mode}` is true.

1. Read the current branch and worktree status. Do not discard or hide existing changes.
2. Resolve the repository's actual default branch from repository policy or the remote HEAD; do not assume `main` or `master` (it may be `trunk`, `develop`, or another name).
3. If already on a non-default branch, keep it and store `{branch_name}`. If currently on the resolved default branch, create the repository-conventional task branch from it using `{feature_name}`. In non-auto mode, confirm the proposed name once.
4. If branch creation is unsafe or unsupported, report the exact blocker. PR mode cannot continue from the default branch.

Return to `step-00-init.md`. Branch mode alone never authorizes a commit or push.
