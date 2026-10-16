---
name: "peaklab.update-deps"
description: "Update project dependencies or handle Dependabot PRs and their CI checks."
effort: standard
argument-hint: "[--create] [--auto]"
allowed-tools: Bash(git :*), Bash(gh :*), Bash(pnpm :*)
---

# Update Dependencies

Weekly workflow: merge existing Dependabot PRs, or create one update PR if none exists.

## Context

- Current branch: !`git branch --show-current`
- Open update PRs: !`gh pr list --state open --search "chore(deps)" --json number,title,headRefName,mergeable,statusCheckRollup 2>/dev/null | head -100`

## Parameters

| Flag | Description |
|------|-------------|
| `--create` | Skip confirmation, create PR if none exists |
| `--auto` | Skip all confirmations, merge + create automatically |

Without a flag, ask before creating a PR or merging.

## Case A: Dependabot PR(s) open

For each PR, check `gh pr view <number> --json statusCheckRollup,mergeable,mergeStateStatus`:

- `mergeStateStatus == "CLEAN"` and every check `conclusion == "SUCCESS"`: `gh pr merge <number> --squash --delete-branch`, then report "PR #<number> merged: <package list>".
- Behind main: rebase it on main, then re-check.
- CI running: `gh run watch`, then re-check.
- CI failed: report the failure, do NOT merge, ask the user.

## Case B: no open update PR

```bash
pnpm outdated
pnpm update --recursive   # minor + patch only
```

If `git diff --stat` shows no change to `package.json` or `pnpm-lock.yaml`, report "Already up to date, nothing to do." Otherwise review `git diff package.json pnpm-lock.yaml`, then:

```bash
git checkout -b chore/update-deps-$(date +%Y-%m-%d)
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): weekly minor and patch updates"
git push -u origin HEAD
gh pr create --title "chore(deps): weekly minor and patch updates" --body "$(cat <<'EOF'
## Weekly dependency update

Minor and patch bumps only — no major version changes.

## Test plan
- [ ] CI green
- [ ] No runtime regressions
EOF
)"
```

Report the PR URL.

## After any merge

`git checkout main && git pull`, then confirm the lockfile installs cleanly: `pnpm install --frozen-lockfile 2>&1 | tail -5`.

## Rules

- **Minor and patch only. NEVER auto-merge a major bump** (`1.x.x` → `2.x.x`); flag it to the user.
- **ONE update PR per week**: never open another while one is open.
- **CI must be green** before merging; never merge a red PR.
- **pnpm only**: never npm or yarn.
- **Squash merge** with `--squash --delete-branch`.
