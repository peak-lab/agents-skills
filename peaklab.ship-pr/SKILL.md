---
name: peaklab.ship-pr
description: Use when the user says "ship", "ship PR", "review and merge", or wants to finalize a branch into a clean merged PR.
effort: deep
disable-model-invocation: true
allowed-tools: "Bash(git :*), Bash(gh :*), Bash(pnpm :*), Bash(curl :*), Bash(jq :*), Bash(python3 :*), Read, Edit, MultiEdit, Skill, Agent, Task"
argument-hint: "[--base <branch>] [--draft] [--no-merge] [--auto-fix] [--plane]"
---

<objective>
Orchestrate the full PR lifecycle: create, review, fix, merge. Composes existing skills (git:create-pr, workflow:review-code, git:fix-pr-comments, git:merge) into a single automated pipeline. Optionally syncs with Plane after merge.
</objective>
<context>
- Current branch: !`git branch --show-current`
- Working tree: !`git status --short`
- Recent commits: !`git log --oneline -5`
- Existing PR: !`gh pr list --head $(git branch --show-current) --json number,title,state --jq '.[0] // empty' 2>/dev/null`
</context>
<arguments>
| Argument          | Description                                                                       | Default |
|-------------------|-----------------------------------------------------------------------------------|---------|
| `--base <branch>` | Base branch for PR                                                                | auto-detect (main/master/develop) |
| `--draft`         | Create PR as draft                                                                | `false` |
| `--no-merge`      | Stop after fix, don't merge                                                       | `false` |
| `--auto-fix`      | Auto-fix review issues without asking                                             | `false` |
| `--plane`         | Sync Plane after merge: move matched tickets → Done, create tickets for untracked changes | `false` |
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
## Phase 1: ENSURE PR EXISTS

1. Check if a PR already exists for the current branch:
   ```bash
   gh pr list --head $(git branch --show-current) --json number,url,state
   ```
2. **If PR exists**: capture the number and URL, jump directly to Phase 2.
3. **If no PR**: invoke the `git:create-pr` skill to create one.
   - Pass `--draft` if provided
   - Pass `--base` if provided
4. Capture the PR number for subsequent phases.

---

## Phase 2: QUALITY GATES

Run quality checks before review:

```bash
pnpm type-check 2>&1 | tail -20
pnpm lint 2>&1 | tail -10
```

- If type-check fails: fix TypeScript errors, commit, push.
- If lint has auto-fixable errors on modified files: run `pnpm lint:fix`, commit, push.
- Loop until clean or report blockers.

---

## Phase 3: CODE REVIEW

This phase is mandatory. Do not proceed to CI checks or merge until it has an explicit outcome.

1. Fetch the PR diff and changed file list:
   ```bash
   gh pr diff <number> --name-only
   gh pr diff <number> --patch
   ```
2. Execute the review:
   - Preferred, when delegation is available and permitted: launch two independent review agents.
     - **Agent 1** (focus="security,logic"): security, authorization, data leakage, logic errors, edge cases.
     - **Agent 2** (focus="clean-code,react"): maintainability, React/Next.js patterns, accessibility, UI regressions.
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
   - **Out-of-scope** (pre-existing problem, separate concern, or too large) → create a GitHub issue

2. For out-of-scope issues, use the `create-issue` skill:
   - Title: `fix(scope): <description of the problem>`
   - Body: include the file path, line numbers, and why it was flagged
   - Label: `bug` or `enhancement` depending on nature

3. For in-scope fixes:
   - If `--auto-fix` provided: fix automatically
   - Otherwise: present issues and ask user for confirmation
   - Read the target file, apply the fix, verify with `pnpm type-check`

4. Commit and push in-scope fixes:
   ```bash
   git add <specific-files>
   git commit -m "fix: address review findings"
   git push origin HEAD
   ```
5. Re-run quality gates (Phase 2).
6. If new issues appear: loop (max 3 iterations).

**If only SUGGESTION issues:**

- Report them but proceed to merge
- If a suggestion is important enough to track: create a GitHub issue with label `enhancement`

---

## Phase 5: CI CHECKS

**Skip merge phases if `--no-merge` provided.**

1. Get current CI status:
   ```bash
   gh pr checks <PR_NUMBER> --json name,state,workflow,link
   ```
2. If no checks are reported, inspect whether remote CI is configured:
   ```bash
   BRANCH=$(git branch --show-current)
   gh run list --branch "$BRANCH" --limit 5 --json databaseId,status,conclusion,workflowName,headSha,url
   git ls-tree -r --name-only HEAD .github/workflows 2>/dev/null
   ```
   - If a run for the PR head SHA is pending or in progress, wait for it.
   - If workflow files exist but no GitHub Actions run exists for the PR head SHA, stop and report `blocked: no GitHub Actions status for current head`.
   - If no workflow files exist and no runs are reported, set review/CI status to `ci_not_configured_no_remote_checks`, report the local validation used instead, and proceed to Phase 7.
3. If all GitHub Actions checks pass for the current PR head SHA → jump to Phase 7 MERGE.
4. If checks are pending → wait:
   ```bash
   gh pr checks <PR_NUMBER> --watch --interval 15
   ```
5. If any check fails → go to Phase 6 FIX CI

## Phase 6: FIX CI _(draws from shared 3-iteration budget)_

For each iteration:

**Step 1 — Fetch failed logs**

```bash
BRANCH=$(git branch --show-current)
RUN_ID=$(gh run list --branch "$BRANCH" --status failure --limit 1 --json databaseId -q '.[0].databaseId')
gh run view $RUN_ID --log-failed
```

**Step 2 — Classify the failure**

For each failing job, decide:

- **Fix inline** (quick, directly caused by this PR's changes)
- **Create issue** (pre-existing bug, unrelated regression, large refactor needed)

| Error signal                | Local verify      | Fix                                                   |
| --------------------------- | ----------------- | ----------------------------------------------------- |
| `Type error` / `TS` / `tsc` | `pnpm type-check` | Fix TypeScript errors or create issue if pre-existing |
| `biome` / `lint`            | `pnpm lint`       | Run `pnpm lint:fix`, fix remaining                    |
| `test` / `vitest`           | `pnpm test`       | Fix failing tests; create issue if unrelated          |
| `Module not found` / build  | `pnpm build`      | Fix imports/deps                                      |
| Schema / migration          | —                 | Fix DB schema or create issue                         |

**For out-of-scope CI failures** — use `create-issue` skill:

- Title: `fix(ci): <describe the root cause>`
- Include: error message, file/line, run ID (`gh run view $RUN_ID`)
- Label: `bug`

**Step 3 — Verify locally before pushing**

```bash
pnpm type-check 2>&1 | tail -10
pnpm lint 2>&1 | tail -10
```

**Step 4 — Commit and push**

```bash
git add <specific-files>
git commit -m "fix(ci): <describe what was fixed>"
git push origin HEAD
```

**Step 5 — Wait for new run**

```bash
gh pr checks <PR_NUMBER> --watch --interval 15
```

**Step 6 — Check result**

- All green → Phase 7 MERGE
- Still failing → loop (max 3 iterations total)
- After 3 iterations: stop, report status, ask user for guidance

## Phase 7: MERGE

**Skip if `--no-merge` is provided.**

Before merging, assert Phase 3 review outcome is `review_completed_no_blockers` or `review_blockers_fixed`. Then re-check remote CI for the current PR head commit.

Merge is allowed when either:
- GitHub Actions/checks are configured and the workflow conclusion is successful for the current head commit.
- CI status is explicitly `ci_not_configured_no_remote_checks` because the repository has no `.github/workflows/*`, no branch-required checks, and no workflow runs for the PR head branch; in this case, report the local validation commands that replaced remote CI.

Do not merge on local-only checks when remote CI is configured, empty check rollups with configured workflows, pending runs, skipped status without a successful workflow conclusion, or unavailable GitHub Actions status.

```bash
gh pr checks <PR_NUMBER> --json name,state,workflow,link
BRANCH=$(git branch --show-current)
gh run list --branch "$BRANCH" --limit 5 --json databaseId,status,conclusion,workflowName,headSha,url
git ls-tree -r --name-only HEAD .github/workflows 2>/dev/null
```

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

Return final PR URL and merge status.

---

## Phase 8: PLANE SYNC (--plane only)

Execute only if `--plane` was provided **and** merge succeeded.

### 8.0 — Setup + Guard

```python
import os, json, re, urllib.request

# Load Plane credentials: .env → ~/.agents/.env → legacy settings.local.json
def _load(path):
    try:
        for line in open(path):
            if line.startswith('PLANE_') and '=' in line:
                k, _, v = line.strip().partition('=')
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))
    except Exception: pass

_load('.env')
if not (os.environ.get('PLANE_TOKEN') and os.environ.get('PLANE_PROJECT')):
    _load(os.path.expanduser('~/.agents/.env'))
if not (os.environ.get('PLANE_TOKEN') and os.environ.get('PLANE_PROJECT')):
    for _sl in ('.claude/settings.local.json', '.codex/settings.local.json'):
        try:
            for k, v in json.load(open(_sl)).get('env', {}).items():
                if k.startswith('PLANE_'): os.environ.setdefault(k, v)
        except Exception: pass

url        = os.environ['PLANE_PROJECT']
TOKEN      = os.environ['PLANE_TOKEN']
HOST       = re.search(r'https://([^/]+)/', url).group(1)
WORKSPACE  = re.search(r'https://[^/]+/([^/]+)/', url).group(1)
PROJECT_ID = re.search(r'/projects/([^/]+)/', url).group(1)
BASE       = f'https://{HOST}/api/v1'
WP         = f'{BASE}/workspaces/{WORKSPACE}/projects/{PROJECT_ID}'

def plane_api(method, path, data=None):
    req = urllib.request.Request(f'{BASE}{path}', method=method,
        headers={'x-api-key': TOKEN, 'Content-Type': 'application/json'})
    if data: req.data = json.dumps(data).encode()
    return json.loads(urllib.request.urlopen(req).read().decode())
```

Guard: check that the merged PR targeted the default branch:
```bash
BASE_BRANCH=$(gh pr view <number> --json baseRefName --jq '.baseRefName')
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')
```

If `BASE_BRANCH != DEFAULT_BRANCH`: print `⚠️ PR merged to $BASE_BRANCH (not default) — Plane sync skipped.` and exit phase.

---

### 8.1 — Resolve Plane states (one call, reused throughout phase)

```python
states = plane_api('GET', f'/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/states/')
states = states if isinstance(states, list) else states.get('results', [])
DONE_STATE_ID = next((s['id'] for s in states if s['group'] == 'completed'), None)
```

---

### 8.2 — Collect PR changes

```bash
# Modified files
CHANGED_FILES=$(gh pr diff <number> --name-only)

# Commit titles only
COMMIT_MESSAGES=$(gh pr view <number> --json commits --jq '[.commits[].messageHeadline]')

# PR title + body
PR_META=$(gh pr view <number> --json title,body)
```

Build a text summary of the changes: file list + commit titles. Used for Plane matching.

---

### 8.3 — Fetch active Plane tickets

```python
issues = plane_api('GET', f'/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/issues/?state_group=started,unstarted&per_page=100')
issues = issues if isinstance(issues, list) else issues.get('results', [])
```

---

### 8.4 — Match changes to tickets

For each active Plane ticket (`started` or `unstarted`), compare its `name` and `description` against:

- Commit titles
- PR title/body
- Modified file names

Classify each ticket as:

- **[MATCH]**: clear match → propose moving to Done
- **[POSSIBLE]**: partial match → present to user for confirmation
- **[NO MATCH]**: no match → skip

Present results to user **before making any changes**:

```
Tickets detected in this PR:
  ✅ [MATCH]    PROJ-42 · Refactor billing page
  ✅ [MATCH]    PROJ-38 · Fix null check in useCart
  ❓ [POSSIBLE] PROJ-31 · Update CI pipeline — confirm? [y/N]
```

Wait for confirmation on `[POSSIBLE]`. Proceed automatically for `[MATCH]`.

---

### 8.5 — Move confirmed tickets to Done

For each validated ticket (MATCH or confirmed POSSIBLE):

```python
plane_api('PATCH', f'/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/issues/<ISSUE_ID>/',
    {'state': DONE_STATE_ID})
```

---

### 8.6 — Create missing tickets

For each change (commit, file, or functional block) **without a matching Plane ticket**:

- Infer a label: `fix:`, `feat:`, `refactor:`, `chore:` based on the nature of the change
- Ask: `"No ticket found for: <description> — Create? [y/N]"`
- If yes, invoke `peaklab.plane-create-issue` once for that change. Pass the inferred title, `priority=medium`, and the dynamically resolved `DONE_STATE_ID` as the requested state:

```text
Skill("peaklab.plane-create-issue", args="TITLE; priority=medium; state=DONE_STATE_ID; work already completed")
```

Tickets created here are placed directly in **Done** (not Backlog) — the work is already done.

---

### 8.7 — Plane sync output

```
PLANE SYNC ──────────────────────────────
✅ PROJ-42 → Done  (Refactor billing page)
✅ PROJ-38 → Done  (Fix null check in useCart)
➕ Created → Done  (feat: add dark mode toggle)
⏭️ PROJ-31 skipped  (not confirmed)
```

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
- --plane (Phase 8) only executes if merge succeeded AND base is the default branch; skip silently otherwise
- State IDs resolved dynamically via group field, never hardcoded
- Plane states fetched once in 8.1 and reused — no duplicate API calls
- Tickets created for untracked work are placed directly in Done, not Backlog
- Get user confirmation for [POSSIBLE] matches before moving a ticket to Done
</rules>
<on_success>
On completion, display:
```
PR: <url>
Status: <created|reviewed|fixed|merged>
Review: <N blocking fixed inline, N suggestions>
CI: <passed|fixed in N iterations>
Issues created: <N> (list URLs if any)
Iterations: <N fix cycles>
Plane: <ticket moved|tickets created|skipped>
```
</on_success>
User: $ARGUMENTS
