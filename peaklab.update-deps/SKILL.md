---
name: peaklab:update-deps
description: Use when handling dependency updates, merging green Dependabot PRs, running package updates, opening update PRs, or monitoring update CI.
effort: standard
argument-hint: "[--create] [--auto]"
allowed-tools: Bash(git :*), Bash(gh :*), Bash(pnpm :*)
---

# Update Dependencies

Weekly dependency update workflow: merge existing Dependabot PRs, or create a new update PR if none exists.

## Context

- Current branch: !`git branch --show-current`
- Open update PRs: !`gh pr list --state open --search "chore(deps)" --json number,title,headRefName,mergeable,statusCheckRollup 2>/dev/null | head -100`

## Strategy

**Preference: 1 global PR per week — minor + patch only. Never major.**

- Minor = `1.x.0` → `1.y.0` ✅
- Patch = `1.0.x` → `1.0.y` ✅
- Major = `1.x.x` → `2.x.x` ❌ never auto-merged

## Phase 1: Check for Existing Update PRs

```bash
gh pr list --state open --search "chore(deps)" --json number,title,headRefName,mergeable
```

### Case A — Dependabot PR(s) found

For each PR:
1. Check CI status: `gh pr view <number> --json statusCheckRollup,mergeable,mergeStateStatus`
2. If `mergeStateStatus == "CLEAN"` and all checks `conclusion == "SUCCESS"`:
   - Merge: `gh pr merge <number> --squash --delete-branch`
   - Pull latest main: `git checkout main && git pull`
   - Report: "✅ PR #<number> merged — <package list>"
3. If CI is still running: wait and re-check (`gh run watch`)
4. If CI failed: report failure details, do NOT merge, ask user

### Case B — No open update PR (`--create` flag or user confirms)

Run pnpm update (minor + patch only):

```bash
# Check outdated packages first
pnpm outdated

# Update minor + patch only (no majors)
pnpm update --recursive
```

Then:
1. Check if `pnpm-lock.yaml` or `package.json` changed: `git diff --stat`
2. If no changes: "Already up to date, nothing to do."
3. If changes:
   - Check what changed: `git diff package.json pnpm-lock.yaml`
   - Create branch: `git checkout -b chore/update-deps-$(date +%Y-%m-%d)`
   - Stage: `git add package.json pnpm-lock.yaml`
   - Commit: `git commit -m "chore(deps): weekly minor and patch updates"`
   - Push: `git push -u origin HEAD`
   - Create PR: `gh pr create --title "chore(deps): weekly minor and patch updates" --body "$(cat <<'EOF'
## Weekly dependency update

Minor and patch bumps only — no major version changes.

Generated with \`pnpm update\`.

## Test plan
- [ ] CI green
- [ ] No runtime regressions
EOF
)"`
   - Report PR URL

## Phase 2: Verify after merge

After merging any PR:
1. Pull main: `git checkout main && git pull`
2. Confirm no package conflicts: `pnpm install --frozen-lockfile 2>&1 | tail -5`

## Parameters

| Flag | Description |
|------|-------------|
| `--create` | Skip confirmation, create PR if none exists |
| `--auto` | Skip all confirmations, merge + create automatically |

## Rules

- **NEVER auto-merge major version bumps** — flag them to the user
- **ONE PR per week** — if an update PR already exists and is open, do not create another
- **CI must be green** before merging — never merge a red PR
- **pnpm only** — never use npm or yarn commands
- **Keep branch up to date** — rebase on main if the PR is behind
- **squash merge** — always `--squash --delete-branch` for clean history
