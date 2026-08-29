---
name: "peaklab.plane-do-issue"
description: "Use when the user says \"plane do issue\", \"do next Plane issue\", \"work the next ticket\", or references a Plane issue to implement through PR creation with async CI/rebase/conflict/merge follow-up."
effort: deep
argument-hint: "[PREFIX-N | UUID | URL | next] [--no-auto] [--no-tdd] [--async-merge | --wait-merge | --no-merge] [--no-subagent]"
allowed-tools: "Bash(git :*), Bash(gh :*), Bash(rg :*), Bash(pnpm :*), Bash(npm :*), Bash(python3 :*), Read, Write, Edit, MultiEdit, Skill, Agent, Task"
---

<overview>
Resolve one Plane issue through a reviewed pull request while keeping the parent
worktree untouched. Delegate by repository ownership and risk, with model selection
owned by the selected agent definition rather than hardcoded in this shared skill.
</overview>

<task_spec>
- Intent: deliver one valid Plane issue efficiently from selection through PR handoff.
- Constraints: use an isolated worktree, preserve Plan/Analyze/Execute/Review gates,
  and never silently downgrade a high-risk route.
- Acceptance criteria: an evidence-backed terminal status, or a reviewed PR with the
  correct asynchronous shipping owner.
- Relevant locations: `~/.agents/skills/peaklab.plane-do-issue/`, `.agents/agents/`, and the
  generated `.agents/tasks/<issue>/` directory.
</task_spec>

<tooling_rationale>
This skill keeps broad repo mutation tools because it selects one Plane issue, prepares an isolated worktree, and delegates implementation/PR creation to a subagent. Plane API access must still go through `plane-api`, and slow CI/merge follow-up should be delegated to `plane:ship-watch`.
</tooling_rationale>

<arguments>

- Empty or `next`: select the highest-priority non-EPIC Todo issue assigned to the current user; if none, select the highest-priority unclaimed non-EPIC Todo issue.
- `PREFIX-14`, `14`, UUID, or Plane URL: fetch that specific issue.
- `--auto`: explicitly retain the default non-interactive execution.
- `--no-auto`: opt out of default automatic execution and retain the urgent/high priority pause.
- `--tdd`: explicitly retain the default APEX `-d` mode.
- `--no-tdd`: opt out of default RED → GREEN → REFACTOR only for a ticket that cannot use it meaningfully.
- `--async-merge`: default. Create/update the PR, then delegate CI/rebase/conflict/merge follow-up to `plane:ship-watch` and continue.
- `--wait-merge`: keep the old blocking behavior: wait for CI and merge before returning.
- `--no-merge`: create/update the PR and stop without launching the watcher.
- `--no-subagent`: fallback mode. Run the issue locally in the current worktree only when subagents/worktrees are unavailable or the user explicitly asks for direct execution.
</arguments>

<required_skills>

- Load `plane-api` before any Plane API interaction.
- Use `apex -d` by default for Analyze -> Plan -> Execute -> eXamine; omit `-d` only for `--no-tdd`.
- Use `peaklab.ship-pr --auto-fix --no-merge` for PR creation/review/preflight.
- Use `plane:ship-watch` for the slow CI/rebase/conflict/merge/Plane-sync phase unless `--wait-merge` or `--no-merge` changes the flow.
</required_skills>

<quick_reference>

| Work | Agent route | Escalation |
|---|---|---|
| Scoped frontend, backend, or AI work | ownership-specific implementation agent | Cross-package or billing route if scope expands |
| Docs, tests, tooling, or configuration | `plane-issue-worker` | Ownership-specific route if identified |
| Billing or entitlement change | `billing-stripe-dev` | None |
| Cross-package or contract change | `cross-package-orchestrator` | None |
| Standard PR review | `qa-code-reviewer` | `qa-code-reviewer-deep` for high-risk changes |
| CI, rebase, and merge follow-up | `plane-ship-watcher` | Record an explicit blocker when unsafe |

</quick_reference>

<execution_model>

Default execution is **subagent + isolated worktree**.

- Parent orchestrator owns only issue selection, worktree preparation, worker launch, the post-PR QA review gate, and final summary.
- The implementation worker subagent owns branch checkout, analysis files, code edits, validation, commit, push, and PR creation/review/preflight.
- The parent orchestrator owns launching or recording `plane:ship-watch` after the worker returns a reviewed PR.
- `next` must skip EPIC tickets such as titles beginning with `[EPIC ...]`. EPICs are planning containers, not implementation units. A specific EPIC ID may still be opened explicitly for planning/story split.
- The worker must run every git/package command from its assigned worktree path.
- The parent must not edit product files, commit, push, or switch branches for the issue unless running explicit `--no-subagent` fallback.
- Only one Plane issue implementation may run per `peaklab.plane-do-issue` invocation. `plane:do-queue` may call this skill repeatedly, but it should not make the parent worktree dirty.
- The worker receives its ownership and model constraints from the selected agent
  definition. The parent passes only issue-specific context and the applicable analysis
  contract; it does not override the agent model.
</execution_model>

<analysis_contract>

Single source of truth for the analysis phase. The parent copies this section into the worker prompt (step 4), tailored to the ticket: keep every check that can apply, drop the ones that cannot (e.g. graphify when no graphs exist under `graphify-out/`, EPIC planners for non-EPIC work), and append ticket-specific scope notes (e.g. a backlog update that already narrowed the scope, known shipped parts with commit refs). Never weaken a check that applies. Fallback mode applies it directly (step 8).

`analyze.md` must exist in `task_dir` and contain all of this BEFORE any code edit:

- Acceptance criteria: extract them from description/comments/parent; if absent, infer
  them and mark each one `inferred`.
- Relevant files with file:line evidence; read every file before citing it.
- Freshness check: run `git log --oneline -15 -- <target paths>` and
  `gh pr list --state merged --limit 10 --search "<area keywords>"`.
  If the work is already shipped, return status=already_done with commit/PR evidence
  instead of implementing.
- Relevance check (BEFORE writing plan.md): verify the ticket premise still holds in
  the current codebase — the described problem/behavior still exists, the files,
  routes, or features it references still exist, and no comment, parent update, or
  newer merged PR supersedes or contradicts it. Compare `updated_at` against recent
  changes on the target paths: an old ticket over a heavily-reworked area is a red
  flag. If the premise no longer holds, return status=obsolete with evidence
  (what changed, which commits/PRs) instead of implementing.
- Cross-service impact checklist when the issue may span packages: workflow step
  contracts, shared enums/types duplicated across services, cross-service auth
  headers, DB/schema ownership (per repo AGENTS.md / rules).
- Multi-package issues: run graphify query/affected on the relevant package graph
  before editing, when graphs exist under graphify-out/.
- If the description is empty or acceptance criteria stay ambiguous after reading
  comments and parent context, return status=needs_clarification with the exact
  questions. Do not guess and do not implement.

`plan.md`: ordered implementation steps and validation plan.
`implementation.md`: concrete changes made and validation evidence mapped to the
acceptance criteria.
</analysis_contract>

<workflow>

<step name="select-issue">

1. Run issue selection:
   ```bash
   python3 ~/.agents/skills/peaklab.plane-do-issue/scripts/select_issue.py $ARGUMENTS
   ```
   The script moves the issue to `In Progress`, preserves assignees, sets `start_date` if missing, and writes state to the system temporary directory as `plane-do-issue-state.json`.
   If it returns `{"found": false, ...}`, stop immediately and report the message. Do not read or reuse any existing state file; the selector clears stale state on misses.
   Specific IDs like `PUSHR-64` are matched by exact sequence ID. The selector verifies Plane API filter results and falls back to client-side filtering when the API ignores `sequence_ids`.

</step>

<step name="inspect-issue">

2. If `found` is true, read the JSON output. It contains:
   - `prefix`, `sequence_id`, `id`, `title`, `priority`, `description`, `description_html`
   - `labels`, `parent` (EPIC/parent title + description), `comments` (last 10), `updated_at`
   - `context_warnings`: enrichment endpoints that failed; pass them to the worker verbatim
   - `branch`
   - `task_dir`: absolute path in the parent repo (`.agents/tasks/<issue-slug>`); workers
     write analyze/plan/implementation there, never inside the worktree
   - `auto_mode` and `skip_confirm`: true by default, false only with `--no-auto`.
   - `tdd_mode`: true by default, false only with `--no-tdd`; pass it unchanged to the implementation worker.

   If the selected issue is an explicit EPIC, treat the run as planning-first:
   - load `plane-epic-planner`, `cross-package-orchestrator`, and `plane-story-planner` from `.agents/agents` when available;
   - create or update `analyze.md`, `plan.md`, and `implementation.md`;
   - split the EPIC into independently shippable Plane-ready stories;
   - return `status=needs_confirmation` before creating or implementing stories unless the user explicitly asked to create stories.

</step>

<step name="prepare-worktree">

3. Detect a linked worktree before preparing anything:
   ```bash
   CURRENT_GIT_DIR=$(git rev-parse --git-dir)
   if [ -f "$CURRENT_GIT_DIR" ]; then
     WORKTREE=$(git rev-parse --show-toplevel)
     CURRENT_BRANCH=$(git branch --show-current)
   fi
   ```
   If `CURRENT_GIT_DIR` is a file, require `CURRENT_BRANCH` to be non-empty, different from the detected base branch, and `git status --short` to be empty; then reuse `WORKTREE` for the implementation worker. Resolve `task_dir` from the first `worktree` path in `git worktree list --porcelain`, which is the primary checkout. Do not create `.worktrees/`, call `git worktree add`, or `git switch`.

   Otherwise, prepare the isolated worktree unless `--no-subagent` was passed:
   ```bash
   mkdir -p .worktrees
   grep -qxF '.worktrees/' .gitignore 2>/dev/null || printf '\n.worktrees/\n' >> .gitignore
   git fetch origin main
   WORKTREE=".worktrees/${prefix}-${sequence_id}-${branch_slug}"
   git worktree add -b "$BRANCH_NAME" "$WORKTREE" origin/main
   ```
   - If the branch already exists, use `git worktree add "$WORKTREE" "$BRANCH_NAME"` after fetching it.
   - If the worktree already exists, reuse it only if it is on the same branch and `git -C "$WORKTREE" status --short` is clean or contains only that issue's current work.
   - Do not `git switch` the parent worktree.
   - If worktree creation fails because of an existing branch/worktree conflict, stop and report the exact path/branch conflict unless it is clearly safe to reuse.

</step>

<step name="delegate-implementation">

4. Launch one implementation subagent when available. Route it by ownership and risk:
   - `front-next-dev`, `back-python-dev`, or `ai-service-dev` for a scoped package change.
   - `billing-stripe-dev` for billing, trial, entitlement, Checkout, or webhook work.
   - `cross-package-orchestrator` for a contract change spanning packages.
   - `plane-issue-worker` for bounded docs, tests, tooling, configuration, or an otherwise
     unowned issue.

   The named agent definition is the single source of truth for the model and effort tier.
   Do not pass a model override or substitute an untyped generic worker. The prompt must include
   issue-specific data, `task_dir`, `worktree_path`, branch, merge mode, and these instructions:
   ```text
   You are resolving one Plane issue in the assigned worktree. It may be an existing linked worktree reused by the parent.

   Issue: <PREFIX-N>
   Title: <title>
   Priority: <priority>
   Labels: <labels>
   Parent: <parent title + description, or none>
   Description: <description_html if non-empty, else description>
   Comments: <comments verbatim, or none>
   Context warnings: <context_warnings, or none>
   Branch: <branch>
   Worktree path: <absolute path>
   Task dir: <task_dir>
   Merge mode: <async-merge|wait-merge|no-merge>
   Auto mode: <true|false>
   TDD mode: <true|false>

   Hard rules:
   - cd to Worktree path before every repository command.
   - The assigned worktree is your only authorized checkout. Never edit another checkout or switch branches.
   - Load and follow repository/package AGENTS.md from the worktree.
   - You cannot spawn subagents. Your assigned agent definition is already your system prompt.
     If the scope expands outside that route, stop before editing the new area and report the
     required ownership route. The parent owns rerouting; do not self-select a cheaper tier.
   - The final QA review is owned by the parent after your RESULT; still self-review your diff
     before creating the PR.
   - Invoke APEX with `-a` when Auto mode is true and omit it when false. Add `-d` when TDD mode is true and record the focused RED and GREEN commands/results in implementation.md.
   - Create/update analyze.md, plan.md, and implementation.md in Task dir — never inside
     the worktree, never in `.codex/tasks/todo.md`.

   Analysis contract:
   <insert the "## Analysis Contract" section, tailored per its intro: all applicable
   checks kept verbatim, inapplicable items dropped, ticket-specific scope notes appended>

   - If priority is urgent/high and skip_confirm is false, write the plan and return status=needs_confirmation instead of implementing.
   - Implement only the issue scope.
   - Validate with focused tests first, broader checks when warranted. Map validation
     evidence to the acceptance criteria in implementation.md.
   - Deploy-build parity: also run the exact build command the deployment image runs
     (e.g. `pnpm --filter ai build:prod` for packages/ai) — CI quality gates may not
     cover the prod tsc/build path and the failure then only surfaces in the image build.
   - Visual evidence (only when the diff touches frontend UI, e.g. `packages/front/src/**`):
     - Build and start the worktree app on a DEDICATED port (e.g. 8620+) — never the
       default dev port, the user's own dev server may hold it.
     - Write an ad-hoc Playwright script (do NOT run the repo's full e2e suite): navigate
       the routes affected by the diff, screenshot the key states — default, plus
       loading/empty/error when reachable via existing e2e fixtures.
     - Save screenshots to `<task_dir>/screenshots/` and map each image to an acceptance
       criterion in implementation.md.
     - List the screenshot paths in the PR description. Do not commit images to the branch.
     - If the app cannot start (missing env/DB), note it in implementation.md as a
       degraded validation — do not fake evidence.
   - PR creation: default is `gh pr create` + local checks + explicit self-review
     (subagent workers usually have no Skill tool). Use peaklab.ship-pr --auto-fix
     --no-merge instead when the Skill tool is available. Never merge.
   - Do not launch plane:ship-watch; the parent orchestrator owns watcher launch after you return.
   - Do not wait on GitHub Actions.
   - Do not merge.
   - For --no-merge, leave Plane in progress and report the PR.

   Final response must contain:
   RESULT
   status: pr_created | needs_confirmation | needs_clarification | already_done | obsolete | blocked | no_changes
   issue: <PREFIX-N>
   branch: <branch>
   worktree_path: <path>
   pr_number: <number or empty>
   pr_url: <url or empty>
   head_sha: <sha or empty>
   acceptance_criteria: met | partial | n/a
   validation: <commands/results mapped to acceptance criteria>
   blocker: <empty unless blocked>
   questions: <empty unless needs_clarification>
   evidence: <empty unless already_done/obsolete; commits/PRs/code proving it>
   notes: <short>

   If you run as a mailbox teammate (idle notifications instead of a returned final
   message), SEND the RESULT block to "main" via SendMessage BEFORE going idle — an
   idle without a delivered RESULT stalls the orchestrator.
   ```
   Notes should include the assigned route and any escalation recommendation.
   Prefer a background subagent when the host supports it. If subagent launch is unavailable, use the fallback in step 8.

</step>

<step name="handle-worker-result">

5. Parent waits only for the implementation worker to reach a terminal pre-merge status.

   Idle without RESULT (observed pattern with mailbox teammates): if the worker goes
   idle without delivering a RESULT block, do NOT assume failure and do NOT relaunch a
   new worker:
   - inspect the evidence on disk first: `task_dir` files, then run
     `git -C WORKTREE status --short`, `git -C WORKTREE log origin/main..HEAD`, and
     `gh pr list --head BRANCH`;
   - if the evidence shows a terminal state (e.g. APEX files + commit + PR ⇒
     pr_created), proceed with it as if the RESULT had arrived;
   - otherwise resume the SAME worker: "Send your RESULT block now via SendMessage to
     main; if unfinished, finish first, then send. Do not go idle again before sending."

   Terminal statuses:
   - `needs_confirmation`: show the plan and ask for user confirmation. Then resume the
     SAME worker with an explicit action message containing: the confirmed decision and
     any scope arbitration, the ordered next steps (implement → validate → commit →
     push → PR → RESULT), and the sentence "Do not stop again before the RESULT block
     unless genuinely blocked." A bare "confirmed" message lets the worker idle.
   - `needs_clarification`: post the worker's questions as a Plane comment via `plane-api`,
     move the issue back to `Todo` (resolve state IDs dynamically), remove the worktree,
     and report the questions to the user.
   - `already_done`: post the evidence as a Plane comment via `plane-api`, report the
     commits/PRs to the user, and recommend closing the issue. Do not move it to Done
     without user confirmation. Remove the worktree.
   - `obsolete`: post the evidence as a Plane comment via `plane-api`, move the issue
     back to `Todo` (resolve state IDs dynamically), report why the ticket is no longer
     relevant, and recommend cancelling or rewriting it. Do not close or cancel it
     without user confirmation. Remove the worktree.
   - `pr_created`: first verify `analyze.md` and `implementation.md` exist in `task_dir`;
     if missing, resume the same worker to produce them before anything else. Then run
     the QA review gate in step 6.
   - `blocked`: report the blocker and keep the worktree for inspection.
   - `no_changes`: report why no PR was needed and keep or remove the worktree based on the worker notes.

</step>

<step name="review-pr">

6. Parent QA review gate after `status=pr_created`, before launching the watcher:
   - Select `qa-code-reviewer-deep` when the diff includes billing or entitlements,
     authorization or tenant boundaries, schema migrations, external customer data, or
     cross-service contracts. Otherwise select `qa-code-reviewer`.
   - Spawn the selected reviewer (agent type from `.agents/agents`) with:
     PR number/URL, `gh pr diff <PR_NUMBER>`, the acceptance criteria from
     `task_dir/analyze.md`, and the repo review standards (regressions, auth gaps,
     tenant scoping, data leaks, contract drift, tests vs risk).
   - Require findings labeled `blocking` or `non-blocking` plus a one-line verdict, and
     instruct the reviewer to SEND its result via SendMessage before going idle. If it
     idles silently anyway, request the verdict explicitly instead of respawning.
   - Blocking findings: resume the SAME implementation worker with the findings and the
     explicit resume format from step 5 (ordered next steps + "Do not stop again before
     the RESULT block"). After the worker pushes the fix, re-run the QA review on the
     new head. Max 2 QA cycles; still blocking after that → report `blocked` with the
     remaining findings and keep the worktree.
   - Non-blocking findings: post them as a PR comment (`gh pr comment`) and continue.
   - If the selected reviewer agent type or subagent launch is unavailable, say so and
     continue; worker self-review + the ship-watch review remain the fallback gate.
   Then handle the merge mode in step 7.

</step>

<step name="handoff-shipping">

7. Parent handles post-PR merge mode after the QA gate:
   - `--no-merge`: stop after reporting the PR URL. Leave Plane in progress.
   - `--wait-merge`: run `plane:ship-watch <PR_NUMBER> --issue <PREFIX-N>` in the current turn and wait for completion.
   - default / `--async-merge`: delegate `plane:ship-watch <PR_NUMBER> --issue <PREFIX-N>`
     to the `plane-ship-watcher` background agent. Its agent definition owns the model
     and effort tier; do not override them at spawn. Then immediately continue or report
     the next actionable step.
   If background delegation is unavailable, do not wait on CI. Write a resume record:
   ```text
   .agents/tasks/plane-ship/PR-<number>/status.md
   ```
   Then report the command/skill to resume: `plane:ship-watch <PR_NUMBER> --issue <PREFIX-N>`.

</step>

<step name="fallback-execution">

8. Fallback local execution, only when `--no-subagent` was passed or subagent/worktree launch is unavailable:
   When already in a linked worktree, retain its current non-main branch. Otherwise create or switch to the dedicated branch:
   ```bash
   git fetch origin
   git switch "$BRANCH_NAME" || git switch -c "$BRANCH_NAME" origin/main
   ```
   Then run the worker flow from step 4 locally, with the same rules:
   - Apply the Analysis Contract before any code edit. Already shipped or obsolete →
     report evidence and stop. Empty/ambiguous ticket → ask the user, do not implement.
   - If priority is `urgent` or `high` and `skip_confirm` is false, show the plan and
     wait for user confirmation before executing.
   - Keep changes scoped to the issue; follow package `AGENTS.md` and `.agents/rules/`.
   - Narrowest meaningful tests first, broader checks when risk warrants it.
   - Invoke APEX with `-a` unless `--no-auto` was requested, and with `-d` unless `--no-tdd` was requested; retain the focused RED and GREEN evidence in implementation.md.
   - Same visual-evidence rule for frontend UI diffs: ad-hoc Playwright screenshots on a
     dedicated port into `<task_dir>/screenshots/`, mapped to acceptance criteria.
   Report that the fallback was used and why.

</step>

<step name="fallback-pr">

9. Fallback PR creation and merge mode:
   ```bash
   peaklab.ship-pr --auto-fix --no-merge
   ```
   Capture `PR_NUMBER` and `PR_URL`. Run the step 6 QA review when subagent launch is
   available; otherwise do an explicit self-review pass. Then apply the same merge-mode
   handling as step 7, including the resume record when background delegation is
   unavailable.


</step>

<step name="sync-plane">

10. Plane sync is owned by `plane:ship-watch` after merge or permanent blocker. `peaklab.plane-do-issue` should only call `finish_issue.py` directly when running with `--wait-merge` and the watcher completes synchronously.

    Terminal states default to the project's `Done` on merge and `In Review` on blocked. Override either
    by exact state name in the Plane config source:

    ```
    PLANE_MERGED_STATE=In Review
    PLANE_BLOCKED_STATE=Todo
    ```

    An unknown name fails loudly with the project's valid states — it never falls back silently.

    ⚠️ The config loader picks **one** source: the first of `<cwd>/.env`, `~/.agents/.env`,
    `<cwd>/.claude/settings.local.json`, `~/.claude/settings.local.json` that holds `PLANE_TOKEN` **and**
    `PLANE_PROJECT`. Optional keys are read from that same source only, never merged across sources. A
    project `.env` holding the credentials therefore shadows `~/.agents/.env` entirely — set the override
    in every source that carries credentials for the project, or the state silently stays `Done`.

</step>

</workflow>

<constraints>

- Never implement on `main`.
- Default mode must not implement in the parent worktree. Use an isolated `.worktrees/...` worktree and an implementation subagent, except when invoked from an existing linked worktree: reuse that worktree and its non-main branch without creating a child worktree.
- Never commit or push manually unless the shipping workflow requires it.
- Never hardcode Plane state IDs; scripts resolve them dynamically.
- Do not overwrite existing assignees when starting an issue.
- Do not use `.codex/tasks/todo.md` for Plane issue tracking; keep planning and progress in the generated issue-specific task directory.
- If there are no Todo issues, stop cleanly and report that.
- Do not block the main orchestrator on GitHub Actions unless `--wait-merge` is explicit.
- All implementation, validation, commit, push, and PR creation should happen in the worker `.worktrees/...` worktree when subagents are available.
- All CI/rebase/conflict/merge work after PR creation belongs to `plane:ship-watch` in an isolated worktree.
</constraints>

<hermes_runtime>

On `agent-runner.example.com`, this skill is invoked by a bounded `claude -p` run rather
than an interactive parent orchestrator. In that runtime:

- Invoke `scripts/run_on_hermes.py <issue> --no-merge` from the issue worktree. It
  performs the deterministic escalation gate before Claude is started.

- Never invoke `Agent`, `ScheduleWakeup`, `CronCreate`, `RemoteTrigger`, `Monitor`,
  or any other deferred/background mechanism. Perform the analysis in the current
  process and return one terminal `RESULT` block.
- If the Plane ticket itself says `escalate`, has no proven owner package, or lacks a
  source frame outside a runtime/internal library, write `analyze.md` with that
  evidence and return `status: blocked`; do not delegate an investigation or guess a
  code change.
- `--no-merge` is mandatory. Never merge, deploy, resolve GlitchTip, or change a
  Hermes schedule from this skill.

</hermes_runtime>

<on_blocked>
For an unsafe worktree conflict, unresolved scope ambiguity, repeated blocking QA
finding, or permanent CI failure, keep the affected worktree, write the available
evidence to the task artifact, and return `blocked` with the exact decision needed.
</on_blocked>

<naming>

Use the canonical skill name `peaklab.plane-do-issue` in queue/orchestration skills.
</naming>

<gotchas>

| Trap | Fix |
|---|---|
| Untyped fallback spends premium reasoning on simple work | Always route ordinary unowned work to `plane-issue-worker` |
| Standard review misses a high-risk boundary | Use `qa-code-reviewer-deep` for the defined billing, auth, data, migration, and contract cases |
| Spawn model drifts from the intended tier | Select the named agent and never override its model at spawn |
| Cross-package worker only returns a plan | `cross-package-orchestrator` may implement when explicitly invoked by this skill |

</gotchas>
