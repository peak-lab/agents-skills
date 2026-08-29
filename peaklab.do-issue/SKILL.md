---
name: "peaklab.do-issue"
description: Use when the user asks to resolve a GitHub issue end to end, work the next open GitHub issue, or resolve a batch of GitHub issues with APEX implementation and PeakLab PR shipping.
effort: deep
argument-hint: "[issue-number...] [--swarm [N]] [--base BRANCH] [--draft] [--no-auto] [--no-tdd] [--async-merge | --wait-merge | --no-merge] [--no-subagent]"
allowed-tools: "Bash(gh :*), Bash(git :*), Bash(rg :*), Bash(python3 :*), Bash(rtk :*), Read, Write, Edit, AskUserQuestion, Skill, Agent, Task"
---

<overview>
Resolve GitHub issues from selection to PR lifecycle. This skill owns issue selection, worktree
preparation, resolver launch, the QA review gate, and the merge phase. Implementation is delegated
to `issue-resolver` subagents (which run `apex`), and queue chaining to `do-queue`.

Execution model (mirrors `peaklab.plane:do-issue`):
- Default: each issue runs in its own isolated git worktree under `.worktrees/`, handled by one
  `issue-resolver` subagent. When invoked from an existing linked worktree, that worktree is reused
  for one selected issue and no child worktree is created.
- The parent orchestrator never edits product files, commits, pushes, or switches branches for an
  issue — except in explicit `--no-subagent` fallback.
- Resolvers never merge. The orchestrator owns the merge phase, sequentially, after the QA gate.
- This skill resolves exactly the selected issue(s) and stops. Working the queue until empty is
  `do-queue`'s job.
</overview>

<task_spec>
- Intent: resolve one or more GitHub issues through a verified PR while spending deep
  reasoning only where the change risk warrants it.
- Constraints: preserve the worktree, APEX, QA, and CI gates; agent definitions own
  model selection and callers never override it at spawn.
- Acceptance criteria: every terminal issue has evidence, while every PR has an
  appropriately routed implementation, review, and merge owner.
- Relevant locations: `~/.agents/skills/peaklab.do-issue/`, `~/.agents/agents/codex/`, `~/.agents/agents/claude/`, and
  the parent repository's `.agents/tasks/issue-<number>-<slug>/` directory.
</task_spec>

<quick_reference>

| Work | Agent route | Escalation trigger |
|---|---|---|
| Scoped implementation | `issue-resolver` | High-risk signal discovered before editing |
| High-risk implementation | `issue-resolver-deep` | Auth, billing, tenant, migration, privacy, security, or cross-service scope |
| Standard PR QA | `issue-qa-reviewer` | High-risk diff boundary |
| High-risk PR QA | `code-reviewer` | Same high-risk boundaries |
| CI and sequential merge | `issue-ship-watcher` | Record blocker when unsafe |

</quick_reference>

<arguments>
| Argument | Description | Default |
|----------|-------------|---------|
| empty | Select the highest-priority open issue | auto-select |
| `N` or `#N` | Resolve that specific issue | — |
| `N1 N2 N3` | Resolve those issues in parallel | — |
| `--swarm [N]` | Auto-select the top `N` open issues by priority and resolve in parallel | `N=3` |
| `--base BRANCH` | Base branch for development and PR | detected default branch |
| `--draft` | Create the PR as draft | `false` |
| `--auto` | Explicitly retain the default non-interactive execution | `true` |
| `--no-auto` | Opt out of automatic execution and retain priority/plan pauses | `false` |
| `--tdd` | Explicitly retain the default APEX RED → GREEN → REFACTOR mode | `true` |
| `--no-tdd` | Opt out of TDD for a ticket that cannot use it meaningfully | `false` |
| `--async-merge` | After the QA gate, delegate CI-watch + merge to a background agent | default |
| `--wait-merge` | Wait for CI and merge inline before returning | `false` |
| `--no-merge` | Stop after PR + QA gate; do not merge | `false` |
| `--no-subagent` | Fallback: run one issue inline in the current worktree (interactive) | `false` |
</arguments>

<constraints>
- Never discard, reset, or overwrite local changes.
- Never implement on the base branch, and never `git switch` the parent worktree to it — use
  `git fetch origin <base>` and create worktrees from `origin/<base>`.
- One worktree + one branch per issue under `.worktrees/`; two resolvers never share either. An
  already-active linked worktree is reused only for one issue when it is clean and not on the base branch.
- Ensure `.worktrees/` is gitignored before creating any worktree.
- Remove a worktree only after its PR merged; keep it on blocker/failure for inspection.
- Resolvers never merge; the orchestrator merges sequentially after the QA gate.
- Never merge without a green GitHub Actions result on the PR head SHA — local checks are not enough.
- Never bypass hooks (`--no-verify`, `--no-gpg-sign`).
- Repo-specific validation commands and hook workarounds come from the repo's AGENTS.md /
  CLAUDE.md / `.agents/rules/` — this skill must stay project-agnostic.
</constraints>

<analysis_contract>
Single source of truth for the analysis phase. The parent pastes this section into each resolver
prompt, tailored to the issue (keep every applicable check, drop inapplicable ones, append
issue-specific scope notes). Never weaken an applicable check. `--no-subagent` applies it directly.

Before any code edit, the resolver writes `analyze.md` in `task_dir` containing:

- Acceptance criteria: extracted from the issue body/comments; if absent, inferred and each one
  marked `inferred`.
- Relevant files with file:line evidence; read every file before citing it.
- Freshness check: `git log --oneline -15 -- <target paths>` and
  `gh pr list --state merged --limit 10 --search "<area keywords>"`.
  If the work is already shipped, return `status: already_done` with commit/PR evidence.
- Relevance check: verify the issue premise still holds — the described problem still exists, the
  files/routes/features it references still exist, and no comment or newer merged PR supersedes it.
  An old issue over a heavily-reworked area is a red flag. If the premise no longer holds, return
  `status: obsolete` with evidence.
- If the body is empty or acceptance criteria stay ambiguous after reading comments, return
  `status: needs_clarification` with the exact questions. Do not guess, do not implement.

`plan.md`: ordered implementation steps and validation plan.
`implementation.md`: concrete changes and validation evidence mapped to the acceptance criteria.

`task_dir` is `<repo-root>/.agents/tasks/issue-<number>-<slug>/` in the PARENT repo — never inside
the worktree.
</analysis_contract>

<known-limitation name="ship-pr-in-subagents">
`peaklab.ship-pr` has `disable-model-invocation: true` — the `Skill` tool refuses it inside
resolver subagents. Fallback PR lifecycle via `gh` (referenced everywhere else in this skill,
defined only here):

1. `gh pr create --base <base> --title "..." --body "..."` (add `--draft` when requested)
2. Run the repo's validation commands (lint/type-check/tests per AGENTS.md); fix failures.
3. Self-review the diff: classify findings [BLOCKING]/[SUGGESTION]/[NO ISSUE]; fix blocking ones.
4. Report the PR. Never merge, never wait on GitHub Actions — the orchestrator owns both.
</known-limitation>

<known-limitation name="worktree-env">
Fresh worktrees lack gitignored env files; pre-push or pre-commit hooks may fail on missing
variables. After each successful `git worktree add`, copy the parent repository's `.env` into the
new worktree only if the source exists and the target does not; use mode `600`, never print its
contents, and never overwrite a target `.env`. Check the repo's AGENTS.md / rules for any
additional workaround and pass it to the resolver verbatim. Never solve it with `--no-verify`.
</known-limitation>

<workflow>

<step name="parse-arguments">
- Collect all tokens matching `^\#?\d+$` as issue numbers.
- Extract flags; set `auto_mode=true` unless `--no-auto` was passed, set `tdd_mode=true` unless `--no-tdd` was passed, and reject unknown or contradictory mode flags (`--auto` with `--no-auto`, `--tdd` with `--no-tdd`) before touching the repo.
- Dispatch:
  - 0 numbers, no `--swarm` → auto-select 1 issue.
  - `--swarm [N]` → auto-select top `N` (default 3).
  - 1+ explicit numbers → fixed list.
  - `--no-subagent` → inline fallback, exactly 1 issue.
- Detect the default branch:
  ```bash
  git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main
  ```
  Use `--base` when provided.
</step>

<step name="select-issues">
Show the queue first:

```bash
gh issue list --state open --limit 100 --json number,title,labels \
  --jq '.[] | "  #\(.number) \(.title) \([.labels[].name] | if length > 0 then "[\(join(", "))]" else "" end)"'
```

Empty queue → report `No open GitHub issues found.` and stop.

Explicit numbers: fetch each with
`gh issue view <n> --json number,title,body,labels,assignees,url --comments`.

Auto-select by priority score (`priority:critical|urgent`=400, `high`=300, `medium`=200,
`low`=100, none=0), in this candidate order:

1. Open issues assigned to the current user (`--assignee @me`).
2. If none, any open issue with a priority label (rerun the helper without `--assignee`).
3. If none, the lowest-numbered open issue.

```bash
gh issue list --state open --assignee @me --limit 100 --json number,title,labels \
  --jq '
    def pscore($labels):
      if any($labels[]?; test("^priority:(critical|urgent)$"; "i")) then 400
      elif any($labels[]?; test("^priority:high$"; "i")) then 300
      elif any($labels[]?; test("^priority:medium$"; "i")) then 200
      elif any($labels[]?; test("^priority:low$"; "i")) then 100
      else 0 end;
    map(. + {priorityScore: pscore([.labels[].name])})
    | sort_by(-.priorityScore, .number)
    | .[].number
  '
```

Skip issues that already have an open PR (`gh pr list --state open --json headRefName,title` —
match issue number in head ref or `Closes #N` in title/body) or an existing
`.worktrees/<n>-*` directory.

Priority pause: if a selected issue carries `priority:critical|urgent|high` and `--no-auto` was
provided, show the issue and ask for confirmation before implementing.

Announce the batch: `Working on: #A, #B, #C`.
</step>

<step name="prepare-worktrees">
Detect whether the current checkout is already a linked worktree before creating anything:

```bash
CURRENT_GIT_DIR=$(git rev-parse --git-dir)
if [ -f "$CURRENT_GIT_DIR" ]; then
  EXISTING_WORKTREE=true
  WORKTREE=$(git rev-parse --show-toplevel)
  CURRENT_BRANCH=$(git branch --show-current)
else
  EXISTING_WORKTREE=false
fi
```

If `EXISTING_WORKTREE=true`, require exactly one selected issue, a clean `git status --short`, and a non-empty `CURRENT_BRANCH`
different from `<base-branch>`. Reuse `WORKTREE` and `CURRENT_BRANCH` for the resolver. Do not
create `.worktrees/`, call `git worktree add`, or switch branches. Reject `--swarm` and multiple
issue numbers instead of sharing the active worktree.

Resolve `task_dir` from the primary checkout, not the active linked worktree:

```bash
PARENT_ROOT=$(git worktree list --porcelain | sed -n 's/^worktree //p' | head -n 1)
```

Only when `EXISTING_WORKTREE=false`:

```bash
mkdir -p .worktrees
grep -qxF '.worktrees/' .gitignore 2>/dev/null || printf '\n.worktrees/\n' >> .gitignore
git fetch origin <base-branch>
```

For each issue, derive a slug from the title:

```bash
git worktree add -b <n>-<slug> ".worktrees/<n>-<slug>" origin/<base-branch>
```

After creation, provision the gitignored environment safely when available:

```bash
if [ -f .env ] && [ ! -e ".worktrees/<n>-<slug>/.env" ]; then
  cp .env ".worktrees/<n>-<slug>/.env"
  chmod 600 ".worktrees/<n>-<slug>/.env"
fi
```

- Branch already exists → `git worktree add ".worktrees/<n>-<slug>" <n>-<slug>` after fetching it.
- Worktree already exists → reuse only if on the same branch and clean (or containing only that
  issue's work); otherwise stop and report the conflict.
- One worktree add fails → skip that issue, report it, continue with the rest.
- Never overwrite an existing worktree `.env` or print an environment value.

Create each issue's `task_dir` in `PARENT_ROOT/.agents/tasks/issue-<n>-<slug>/`.
</step>

<step name="spawn-resolvers">
Before spawning, classify each issue from its title, labels, body, comments, and repository rules.
Route it to `issue-resolver-deep` if it indicates auth or permissions, billing or payments, tenant
isolation, schema/data migration, customer data/privacy, a security boundary, infrastructure, or a
cross-service/API contract. Otherwise route it to `issue-resolver`.

Spawn one selected resolver per issue in a single message (parallel Agent calls,
`run_in_background: true`). Each prompt is self-contained and includes:

- `issue_number`, `issue_title`, `issue_url`, full `issue_body`, comments.
- `base_branch`, absolute `worktree_path`, `branch_name`, `task_dir`.
- `draft`.
- `auto_mode`: true by default; false only when the caller passed `--no-auto`.
- `tdd_mode`: true by default; false only when the caller passed `--no-tdd`.
- The tailored `<analysis_contract>` pasted verbatim (resolvers never read this file).
- The `ship-pr-in-subagents` fallback steps pasted verbatim.
- Any repo-documented hook/env workaround (see `worktree-env`), verbatim.
- The RESULT block format from the selected resolver agent definition.
- "Never merge. Never wait on GitHub Actions. Do not chain to other issues."
- "Invoke APEX with `-a -d` when both modes are enabled; omit `-a` when `auto_mode` is false and omit `-d` when `tdd_mode` is false."

The selected agent definition is the single source of truth for model and effort. Do not pass a
model override or substitute an untyped agent. Resolvers cannot spawn subagents: APEX runs inline
in their context (no explorers, no `-m` teams, no APEX reviewer agents). The parent QA gate is
therefore the official review of this flow.
</step>

<step name="collect-results">
Wait for every resolver to reach a terminal status. Parse each RESULT block.

Idle without RESULT: if a resolver goes idle without delivering a RESULT block, do NOT assume
failure and do NOT relaunch a new one:
- inspect the evidence on disk first: `task_dir` files, then run
  `git -C WORKTREE status --short`, `git -C WORKTREE log origin/BASE..HEAD`, and
  `gh pr list --head BRANCH`;
- if the evidence shows a terminal state (analysis files + commit + PR ⇒ `pr_created`), proceed
  with it as if the RESULT had arrived;
- otherwise resume the SAME resolver: "Send your RESULT block now; if unfinished, finish first,
  then send. Do not go idle again before sending."

Per terminal status:
- `pr_created`: verify `analyze.md` and `implementation.md` exist in `task_dir`; if missing,
  resume the same resolver to produce them. Then run the QA gate.
- `needs_escalation`: resume the same worktree with `issue-resolver-deep`, including the existing
  analysis/plan and the escalation evidence. It must reuse valid analysis rather than rediscover
  the issue. Continue from its RESULT block.
- `needs_clarification`: post the questions as an issue comment (`gh issue comment`), remove the
  worktree, report to the user.
- `already_done`: post the evidence as an issue comment, recommend closing; close only with user
  confirmation (or by default automatic mode with the evidence in the closing comment). Remove the worktree.
- `obsolete`: post the evidence as an issue comment, recommend closing or rewriting; never close
  without user confirmation. Remove the worktree.
- `blocked`: report the blocker; keep the worktree for inspection.
- `no_changes`: report why; keep or remove the worktree based on the resolver notes.
</step>

<step name="qa-gate">
For each `pr_created` PR, before the merge phase, inspect the changed files and `analyze.md`.
Use `code-reviewer` for auth/permissions, billing, tenant isolation, schema/data migrations,
customer data/privacy, security boundaries, infrastructure, or cross-service/API contracts.
Otherwise use `issue-qa-reviewer`.

- Spawn the selected reviewer subagent with: PR number/URL,
  `gh pr diff <n>`, the acceptance criteria from `task_dir/analyze.md`, and the repo review
  standards. Require findings labeled `blocking`/`non-blocking` plus a one-line verdict.
- Blocking findings: resume the SAME resolver with the findings and ordered next steps
  (fix → validate → commit → push → RESULT), then re-run the QA review on the new head.
  Max 2 QA cycles; still blocking → mark `blocked` with the remaining findings, keep the worktree.
- Non-blocking findings: post as a PR comment (`gh pr comment`) and continue.
- If the selected reviewer type is unavailable, say so; resolver self-review remains the fallback gate.
</step>

<step name="merge-phase">
Runs after the QA gate, per merge mode:

- `--no-merge`: report the PR URLs and stop.
- `--wait-merge`: run the merge loop below inline.
- default `--async-merge`: delegate the merge loop to ONE background agent
  (`run_in_background: true`) covering the whole batch, then report and return. The agent's prompt
  contains the loop below, the ordered PR list, worktree paths, and "never merge on red or pending
  checks; never force anything". Use the `issue-ship-watcher` agent definition; do not override
  its model or effort at spawn.

Merge loop — strictly sequential over the batch (parallel merges race on the moving base):

```text
for each PR in order:
  1. gh pr checks <n> --watch --interval 30      # green on the head SHA required
  2. if behind base: gh pr update-branch <n>, then re-wait for checks on the new head
  3. gh pr merge <n> --squash --delete-branch
  4. on success: git worktree remove ".worktrees/<slug>" --force && git worktree prune
  5. on failure or conflict needing judgment: mark blocked, keep the worktree, continue with
     the next PR
```

Report the final table:

```text
#74  merged    https://github.com/.../pull/120   ci:success
#75  blocked   https://github.com/.../pull/121   ci:failing  (typecheck errors)
#76  clarif.   —                                  questions posted on issue
```
</step>

<step name="no-subagent-fallback">
Only when `--no-subagent` was passed or subagent/worktree launch is unavailable. One issue only.

- Inspect first: `git status --short`, `git branch --show-current`. Dirty worktree → ask before
  stashing only with `--no-auto`; default mode uses named stash `do-issue pre-branch #<n>`, pops after branch creation, and stops on
  pop conflict).
- If already in a linked worktree, retain its current non-base branch; never switch branches or create another worktree. Otherwise branch via `gh issue develop <n> --checkout --base <base>`; fallback
  `git fetch origin <base> && git switch -c <n>-<slug> origin/<base>`.
- Apply the `<analysis_contract>` directly (task_dir `.agents/tasks/issue-<n>-<slug>/`).
  `already_done`/`obsolete`/`needs_clarification` → report and stop.
- Implement via `Skill("apex", args="-b -d \"Resolve GitHub issue #<n>: <title>\"")` by default;
  omit `-d` only for `--no-tdd`; include `-a` by default and omit it only for `--no-auto` (never `-pr`).
- Commit with a conventional subject and `Closes #<n>` in the body; push (apply any documented
  hook workaround, never `--no-verify`).
- PR via `Skill("peaklab.ship-pr", args="--base <base> --auto-fix --no-merge <--draft?>")`; if
  refused, use the `ship-pr-in-subagents` fallback.
- Then run the qa-gate and merge-phase steps as above.
</step>

</workflow>

<on_error>
- GitHub auth fails → ask the user to run `gh auth status` / `gh auth login`.
- Issue cannot be fetched → report the exact `gh` error and stop.
- `git worktree add` fails for one issue → skip it, continue with the rest; never abort the batch.
- A resolver returns `blocked` → keep its worktree, surface the blocker; do not retry automatically.
- Push fails on a hook error → apply the repo-documented workaround; if none exists, report the
  exact hook output and stop. Never bypass hooks.
- Merge conflict needing product judgment → mark blocked with the affected files; never resolve
  semantic conflicts autonomously.
- Never `git worktree remove --force` a worktree with uncommitted work unless its PR merged.
</on_error>

<on_blocked>
When a resolver, QA cycle, CI run, or merge requires product judgment, preserve the
worktree and task artifacts, record the exact evidence and next decision, then return
the issue as `blocked`. Do not retry with a different agent tier unless the routing
criteria explicitly require `issue-resolver-deep`.
</on_blocked>

<gotchas>
- Do not silently stash user changes outside default auto mode; `--no-auto` requires confirmation.
- Do not assume the base branch is `main`; detect it unless `--base` was provided.
- Spawn all resolvers for a batch in a single message so they run in parallel.
- Never pass `-b` or `-pr` to apex from inside a resolver — the branch is pre-made and the
  orchestrator owns the PR lifecycle end state.
- Resolvers run apex with `-a -d` by default; omit `-d` only when `--no-tdd` was requested. They cannot answer plan-approval prompts.
- Queue chaining lives in `do-queue`; this skill never re-invokes itself.
</gotchas>

<acceptance_criteria>
- [ ] Issues selected explicitly or by priority, with the urgent/high pause honored.
- [ ] `.worktrees/` gitignored and one isolated worktree + branch per issue, unless one selected issue reuses the active linked worktree on a non-base branch.
- [ ] Resolver prompts carry the tailored analysis contract, ship-pr fallback, and RESULT format.
- [ ] analyze/plan/implementation.md written to the parent-repo `task_dir`, never the worktree.
- [ ] Rich statuses handled: pr_created, needs_clarification, already_done, obsolete, blocked, no_changes.
- [ ] Idle-without-RESULT handled by disk inspection + same-worker resume, never blind respawn.
- [ ] QA gate ran per PR (max 2 cycles) before any merge.
- [ ] Merges sequential, green-checks-on-head-SHA only, update-branch between merges.
- [ ] Merged worktrees cleaned; blocked ones kept and reported.
- [ ] No project-specific commands or env values hardcoded in prompts.
</acceptance_criteria>
