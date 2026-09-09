---
name: "glitchtip-do-issue"
description: Use when the user asks to resolve GlitchTip errors end to end with the do-issue machinery — isolated worktrees, issue-resolver subagents, QA gate, sequential merge — instead of a GitHub issue queue.
effort: deep
argument-hint: "[glitchtip-id|url...] [--project SLUG] [--level fatal|error|warning] [--swarm [N]] [--limit N] [--base BRANCH] [--draft] [--no-auto] [--no-tdd] [--async-merge | --wait-merge | --no-merge] [--no-resolve] [--no-subagent]"
allowed-tools: "Bash(gh :*), Bash(git :*), Bash(rg :*), Bash(curl :*), Bash(python3 :*), Bash(jq :*), Bash(rtk :*), Read, Write, Edit, AskUserQuestion, Skill, Agent, Task"
---

<overview>
`peaklab.do-issue` with GlitchTip as the work-item source. Everything downstream of selection is
identical — one isolated worktree per unit of work, one `issue-resolver` subagent running `apex`,
a QA gate, a sequential merge phase, a `final-recap` — but the unit of work is a **root-cause
cluster of GlitchTip issues**, not a GitHub issue, and the run ends by resolving the covered
GlitchTip IDs.

Three deliberate differences from `peaklab.do-issue`:
1. **Source and selection**: GlitchTip REST API, ranked by level then event count, not `gh issue list`.
2. **Unit of work**: a cluster (1..N GlitchTip IDs sharing one demonstrated root cause) → one
   worktree, one branch, one PR. A stack trace is not a specification: the resolver must prove the
   cause before editing.
3. **Terminal action**: after merge, `status:resolved` + a PR-link comment on every covered ID.
   Never before merge, never on an ID the diff does not cover.

</overview>

<routing>
Three skills enter through GlitchTip. Pick on scope, not on wording:
- **`glitchtip-do-issue` (this one)** — several root-cause clusters at once, each in its own
  worktree with an `issue-resolver` subagent, QA gate and sequential merge. No GitHub issue.
- **`peaklab.fix-glitchtip`** — inbox drain, inline, one cluster after another in the current
  checkout. No worktree, no parallelism.
- **`peaklab.track-error`** — one error whose GitHub issue is the point: durable trace, human
  comments, roadmap link.
</routing>

<task_spec>
- Intent: turn production error signal into merged fixes with the same isolation, review, and merge
  guarantees as the GitHub issue flow.
- Constraints: preserve the worktree, APEX, QA, and CI gates; agent definitions own model
  selection; GlitchTip mutation happens only after merge.
- Acceptance criteria: every cluster is evidence-backed, every PR has an implementation and review
  owner, every resolved GlitchTip ID is covered by a merged diff.
- Relevant locations: `~/.agents/skills/glitchtip-do-issue/`, `~/.agents/agents/`, and the parent
  repository's `.agents/tasks/glitchtip-<cluster-key>/` directory.
</task_spec>

<quick_reference>

| Work | Agent route | Escalation trigger |
|---|---|---|
| Scoped cluster fix | `issue-resolver` | High-risk signal discovered before editing |
| High-risk cluster fix | `issue-resolver-deep` | `fatal`, auth, billing, tenant, migration, privacy, security, cross-service |
| Standard PR QA | `issue-qa-reviewer` | High-risk diff boundary |
| High-risk PR QA | `code-reviewer` | Same high-risk boundaries |
| CI and sequential merge | `issue-ship-watcher` | Record blocker when unsafe |

</quick_reference>

<arguments>
| Argument | Description | Default |
|----------|-------------|---------|
| empty | Select the highest-ranked unresolved cluster | auto-select |
| `<id>` or GlitchTip URL | Seed the cluster from that issue | — |
| `<id> <id> <id>` | Treat each seed as its own cluster candidate, resolved in parallel | — |
| `--project SLUG` | Target GlitchTip project | auto-detected, ask when ambiguous |
| `--level LVL` | Ignore anything below this level | `error` |
| `--limit N` | Cap the inbox page fetched for ranking | 20 |
| `--swarm [N]` | Auto-select the top `N` clusters and resolve in parallel | `N=3` |
| `--base BRANCH` | Base branch for development and PR | detected default branch |
| `--draft` | Create the PR as draft | `false` |
| `--no-auto` | Keep the selection and plan pauses | `false` |
| `--no-tdd` | Opt out of APEX RED → GREEN → REFACTOR | `false` |
| `--async-merge` | Delegate CI-watch + merge to a background agent | default |
| `--wait-merge` | Wait for CI and merge inline | `false` |
| `--no-merge` | Stop after PR + QA gate | `false` |
| `--no-resolve` | Never mutate GlitchTip; report the IDs to resolve by hand | `false` |
| `--no-subagent` | Fallback: run one cluster inline in the current worktree | `false` |
</arguments>

<config>
```bash
GLITCHTIP_URL="https://glitchtip.example.com"
GLITCHTIP_API="${GLITCHTIP_URL}/api/0"
ORG_SLUG="${GLITCHTIP_ORG:-example-org}"
```

Use an already-exported `GLITCHTIP_TOKEN`; otherwise parse `KEY=VALUE` from the project `.env`,
then `~/.agents/.env`. Never source the file, never print a value. Validate with a harmless
`GET /projects/` before fetching issues. Use `curl` (or `rtk proxy zsh -lc 'curl …'`): this
deployment's edge rejects Python `urllib` with Cloudflare `403 / 1010` even on a valid token.

Read endpoints are project-scoped; **mutation is global**: `PUT ${GLITCHTIP_API}/issues/<id>/`.
The project-scoped mutation endpoint returns 404. `405` on `PUT` → retry `PATCH`.
</config>

<constraints>
- Never resolve a GlitchTip issue before its PR merged, and never resolve an ID the merged diff
  does not demonstrably cover.
- Never group issues on matching titles: same exception type, normalized message, in-app frame and
  culprit, or one demonstrated common dependency, with the proof written down.
- Never mix projects or environments in one cluster; production and staging resolve separately.
- Never print, commit, or retain tokens, `/tmp/gt-*.json` dumps, or customer event data.
- Never discard, reset, or overwrite local changes; never implement on the base branch.
- One worktree + branch per cluster under `.worktrees/`; ensure `.worktrees/` is gitignored first.
- Resolvers never merge; the orchestrator merges sequentially after the QA gate.
- Never merge without green GitHub Actions on the PR head SHA.
- Never bypass hooks (`--no-verify`, `--no-gpg-sign`).
- Repo-specific validation commands come from the repo's AGENTS.md / `.agents/rules/` — this skill
  stays project-agnostic.
</constraints>

<analysis_contract>
Single source of truth for the analysis phase. The parent pastes this section into each resolver
prompt, tailored to the cluster. Never weaken an applicable check. `--no-subagent` applies it
directly.

Before any code edit, the resolver writes `analyze.md` in `task_dir` containing:

- **Reproduced cause**: the failing in-app frame read in the source, and why the code as written
  produces this exception. A stack trace pasted back is not an analysis.
- **Cluster membership**: every GlitchTip ID this diff will close, with the shared evidence, and
  every rejected candidate with the reason. IDs the fix does not cover are named as non-members.
- **Acceptance criteria**: always includes "no new event of this fingerprint after deploy", plus
  the behavioural criterion the fix restores. Inferred criteria are marked `inferred`.
- **Freshness check**: `git log --oneline -15 -- <target paths>` and
  `gh pr list --state merged --limit 10 --search "<area keywords>"`. Already shipped → return
  `status: already_done` with the commit/PR evidence and the release the events came from.
- **Regression check**: compare the event `release` tag against `origin/<base>`. Events older than
  a merged fix are stale signal, not a live bug → `status: stale_signal`, resolve without code.
- **Noise check**: bot traffic, dev-only paths, a client-side environment problem, a third-party
  outage → `status: noise` with the evidence and the proposed GlitchTip comment. Never patch code
  to silence a symptom.
- Cause still not demonstrable after reading the source and the event → `status: needs_clarification`
  with the exact questions and the missing evidence. Do not guess, do not implement.

`plan.md`: ordered implementation steps and validation plan.
`implementation.md`: concrete changes and validation evidence mapped to the acceptance criteria,
including the regression test that fails before the fix.

`task_dir` is `<repo-root>/.agents/tasks/glitchtip-<cluster-key>/` in the PARENT repo — never
inside the worktree.
</analysis_contract>

<known-limitation name="ship-pr-in-subagents">
`peaklab.ship-pr` has `disable-model-invocation: true` — the `Skill` tool refuses it inside
resolver subagents. Fallback PR lifecycle via `gh`:

1. `gh pr create --base <base> --title "..." --body "..."` (add `--draft` when requested). The body
   carries every covered GlitchTip ID and permalink, the root cause, and the validation evidence.
   There is no `Closes #N` — GlitchTip is not GitHub; the orchestrator closes the errors.
2. Run the repo's validation commands (lint/type-check/tests per AGENTS.md); fix failures.
3. Self-review the diff: classify findings [BLOCKING]/[SUGGESTION]/[NO ISSUE]; fix blocking ones.
4. Report the PR. Never merge, never wait on GitHub Actions — the orchestrator owns both.
</known-limitation>

<known-limitation name="worktree-env">
Fresh worktrees lack gitignored env files; hooks and `prisma generate` fail on missing variables.
After each successful `git worktree add`, copy the parent repository's `.env` (and any documented
package-level `.env`) into the new worktree only if the source exists and the target does not; use
mode `600`, never print its contents, never overwrite a target `.env`. Pass any repo-documented
workaround to the resolver verbatim. Never solve it with `--no-verify`.
</known-limitation>

<workflow>

<step name="parse-arguments">
- Collect GlitchTip seeds: bare integers, or the trailing id of a `.../issues/<id>` URL.
- Extract flags; `auto_mode=true` unless `--no-auto`, `tdd_mode=true` unless `--no-tdd`. Reject
  unknown or contradictory flags before touching the repo or the API.
- Dispatch: 0 seeds → auto-select 1 cluster · `--swarm [N]` → top `N` · 1+ seeds → fixed list ·
  `--no-subagent` → inline, exactly 1 cluster.
- Detect the default branch:
  ```bash
  git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo main
  ```
</step>

<step name="detect-project">
`--project` wins. Otherwise match `package.json` `name` / `composer.json` `name` / repo folder
against `${GLITCHTIP_API}/projects/`. A seed id resolves its own project from
`GET /issues/<id>/` (`project.slug`) — trust that over inference. Monorepo with several matching
projects and no seed → ask, never guess.
</step>

<step name="select-clusters">
Show the ranked inbox first:

```bash
curl -s -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  "${GLITCHTIP_API}/projects/${ORG_SLUG}/${PROJECT_SLUG}/issues/?query=is:unresolved&limit=${LIMIT}" \
  -o /tmp/gt-issues.json
python3 - <<'PY'
import json
data = json.load(open('/tmp/gt-issues.json'))
order = {'fatal':0,'error':1,'warning':2,'info':3,'debug':4}
data.sort(key=lambda i:(order.get(i.get('level','info'),9), -int(i.get('count',0) or 0)))
for i in data:
    print(f"{i.get('level','?'):>7} | id={i['id']:<6} | x{i.get('count','?'):<5} | {i['title'][:90]}")
PY
```

Empty → report `GlitchTip inbox clean for <project>.` and stop.

Rank by level, then event count. Drop anything below `--level`. For each candidate at the top of
the ranking, fetch `GET /issues/<id>/events/latest/` and retain only: exception type, normalized
message (IDs, UUIDs, URLs and timestamps removed), culprit, top in-app frame, release, environment,
and the non-personal `context` keys. Never copy request bodies, user identities, headers, or
breadcrumbs into task files.

Then cluster (this is the step `peaklab.do-issue` does not have):

| Evidence | Decision |
|---|---|
| Same exception type, normalized message, in-app frame, and culprit | Same cluster |
| Different fingerprints, one demonstrated failing guard/dependency, one code change removes both | Same cluster; write the proof |
| A wrapper error and the low-level error it swallows, same `requestId`/`projectId`, same second | Same cluster; the low-level one is the cause |
| Same title, different in-app frame, culprit, owning package, or remediation | Separate |
| Same fingerprint in staging and production | Separate resolution, compare causes only |
| No in-app frame, or cause not demonstrable | Separate; investigate the highest-ranked one first |

Cluster key: `<project>-<top-frame-or-culprit>-<exception-type>`. Skip a cluster that already has
an open PR (`gh pr list --state open --search "<cluster key or id>"`) or a `.worktrees/glitchtip-<key>`
directory.

Selection pause: with `--no-auto`, or whenever a `fatal` cluster is selected, show the cluster and
its members and ask for confirmation before implementing.

Announce the batch: `Working on: <key-A> (#id,#id), <key-B> (#id)`.
</step>

<step name="prepare-worktrees">
Detect an already-linked worktree before creating anything:

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

`EXISTING_WORKTREE=true` requires exactly one selected cluster, a clean `git status --short`, and a
non-empty `CURRENT_BRANCH` different from the base. Reuse them; create nothing; reject `--swarm`
and multiple seeds rather than share the active worktree.

Resolve `task_dir` from the primary checkout:

```bash
PARENT_ROOT=$(git worktree list --porcelain | sed -n 's/^worktree //p' | head -n 1)
```

Only when `EXISTING_WORKTREE=false`:

```bash
mkdir -p .worktrees
grep -qxF '.worktrees/' .gitignore 2>/dev/null || printf '\n.worktrees/\n' >> .gitignore
git fetch origin <base-branch>
git worktree add -b glitchtip-<key> ".worktrees/glitchtip-<key>" origin/<base-branch>
```

Then provision the env per `worktree-env`. Branch or worktree already exists → reuse only when
clean and on the same branch, otherwise stop and report the conflict. One failure skips its cluster
and never aborts the batch. Create `PARENT_ROOT/.agents/tasks/glitchtip-<key>/`.
</step>

<step name="spawn-resolvers">
Route to `issue-resolver-deep` when the cluster is `fatal`, or touches auth/permissions, billing,
tenant isolation, schema/data migration, customer data or privacy, a security boundary,
infrastructure, or a cross-service contract. Otherwise `issue-resolver`.

Spawn one resolver per cluster in a single message (parallel Agent calls, `run_in_background: true`).
Each self-contained prompt carries:

- cluster key, every member ID with its permalink, level, event count, first/last seen;
- for each member: exception type and value, culprit, in-app frames with `file:line`, release,
  environment, non-personal `context`;
- `base_branch`, absolute `worktree_path`, `branch_name`, `task_dir`, `draft`;
- `auto_mode`, `tdd_mode`;
- the tailored `<analysis_contract>` pasted verbatim (resolvers never read this file);
- the `ship-pr-in-subagents` fallback pasted verbatim;
- any repo-documented hook/env workaround, verbatim;
- the RESULT block format from the selected agent definition;
- "Never merge. Never wait on GitHub Actions. Never call the GlitchTip API. Do not chain clusters.";
- "Invoke APEX with `-a -d`; omit `-a` when `auto_mode` is false, `-d` when `tdd_mode` is false."

The agent definition owns model and effort — no override at spawn. Resolvers cannot spawn
subagents; APEX runs inline. The parent QA gate is the official review.
</step>

<step name="collect-results">
Wait for every resolver to reach a terminal status; parse each RESULT block.

Idle without RESULT: never blind-respawn. Inspect `task_dir`, then
`git -C WORKTREE status --short`, `git -C WORKTREE log origin/BASE..HEAD`, `gh pr list --head BRANCH`.
Analysis files + commit + PR ⇒ treat as `pr_created`. Otherwise resume the SAME resolver: "Send your
RESULT block now; if unfinished, finish first, then send."

Per terminal status:
- `pr_created`: verify `analyze.md` and `implementation.md` exist; missing → resume the same
  resolver. Then run the QA gate.
- `needs_escalation`: resume the same worktree with `issue-resolver-deep`, handing over the existing
  analysis and the escalation evidence. Unavailable in this harness → mark `blocked`, never silently
  fall back to the standard resolver on a high-risk change.
- `stale_signal` / `noise`: no code. Go straight to the resolve phase with the resolver's evidence
  as the GlitchTip comment. Remove the worktree.
- `already_done`: resolve with the merged-PR evidence in the comment. Remove the worktree.
- `needs_clarification`: post the questions as a GlitchTip comment, remove the worktree, report.
- `blocked` / `no_changes`: report; keep the worktree for inspection; leave the IDs unresolved.
</step>

<step name="qa-gate">
For each `pr_created` PR, inspect the changed files and `analyze.md`. `code-reviewer` for
auth/permissions, billing, tenant isolation, schema/data migrations, customer data/privacy,
security boundaries, infrastructure, or cross-service contracts; otherwise `issue-qa-reviewer`.

Give the reviewer: PR number/URL, `gh pr diff <n>`, the acceptance criteria from `analyze.md`, the
cluster membership claim, and the repo review standards. Require findings labeled
`blocking`/`non-blocking` plus a one-line verdict, and an explicit answer to: **does this diff
actually cover every claimed member ID?** A member the diff does not cover is a blocking finding —
demote it out of the cluster rather than resolve it later.

Blocking findings: resume the SAME resolver (fix → validate → commit → push → RESULT), then re-review
the new head. Max 2 cycles; still blocking → `blocked`, keep the worktree.
Non-blocking: `gh pr comment` and continue.
</step>

<step name="merge-phase">
Per merge mode: `--no-merge` reports and stops (nothing is resolved on GlitchTip);
`--wait-merge` runs the loop inline; default `--async-merge` delegates the whole batch to ONE
background `issue-ship-watcher` (`run_in_background: true`) whose prompt carries the loop, the
ordered PR list, worktree paths, the cluster→IDs map, the resolve phase below, and "never merge on
red or pending checks; never force anything".

Merge loop — strictly sequential (parallel merges race on the moving base):

```text
for each PR in order:
  1. gh pr checks <n> --watch --interval 30      # green on the head SHA required
  2. if behind base: gh pr update-branch <n>, then re-wait for checks on the new head
  3. gh pr merge <n> --squash --delete-branch
  4. on success: run the resolve phase for that cluster, then
     git worktree remove ".worktrees/glitchtip-<key>" --force && git worktree prune
  5. on failure or conflict needing judgment: mark blocked, keep the worktree, leave the IDs
     unresolved, continue with the next PR
```
</step>

<step name="resolve-glitchtip">
Runs only after that cluster's PR merged — or, for `stale_signal` / `noise` / `already_done`,
after the evidence was accepted. Skipped entirely under `--no-resolve` and `--no-merge`.

For each covered ID:

```bash
curl -s -X PUT \
  -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  -H "Content-Type: application/json" \
  "${GLITCHTIP_API}/issues/${ISSUE_ID}/" \
  -d '{"status":"resolved"}'

curl -s -X POST \
  -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  -H "Content-Type: application/json" \
  "${GLITCHTIP_API}/issues/${ISSUE_ID}/comments/" \
  -d "{\"data\":{\"text\":\"Fixed in ${PR_URL} — <one-line root cause>\"}}"
```

`405` on `PUT` → retry `PATCH`. The comment endpoint 404s on older GlitchTip — ignore and move on.
A non-2xx status leaves the ID `unresolved` in the recap; never claim a resolution the API refused.
</step>

<step name="final-recap">
Last message of every run, whatever the merge mode. Nothing after it.

One line per cluster, then at most one `next:` line. No prose, no header.

```text
front-upsertMany-TxExpired   #4011,#4000  merged      https://github.com/.../pull/2178  resolved
front-bulkUpsert-SyncFailed  #3774        pr_created  https://github.com/.../pull/2179  merge: background
front-health-MethodNotAllow  #166         noise       —                                 resolved, no code
front-publish-Timeout        #118         blocked     https://github.com/.../pull/2180  typecheck errors, worktree kept
next: gh pr checks 2179 --watch
inbox remaining: 8
```

- Status vocabulary: `merged`, `pr_created`, `blocked`, `clarif.`, `already_done`, `stale_signal`,
  `noise`, `no_changes`, `skipped`.
- Fifth column states the GlitchTip outcome: `resolved`, `unresolved`, or `resolve failed <code>`.
- `next:` only when something is still owed. End with the remaining unresolved inbox count.
</step>

<step name="no-subagent-fallback">
Only with `--no-subagent`, or when subagents/worktrees are unavailable. One cluster.

- Inspect first: `git status --short`, `git branch --show-current`. Dirty → stash under
  `glitchtip-do-issue pre-branch <key>` in auto mode (ask with `--no-auto`), pop after branching,
  stop on conflict.
- Already in a linked worktree on a non-base branch → keep it. Otherwise
  `git fetch origin <base> && git switch -c glitchtip-<key> origin/<base>`.
- Apply the `<analysis_contract>` directly. `already_done` / `stale_signal` / `noise` /
  `needs_clarification` → report, resolve or comment as applicable, stop.
- Implement with `Skill("apex", args="-b -d \"Fix GlitchTip <ids>: <cause>\"")`; add `-x` for a
  `fatal` cluster; drop `-d` for `--no-tdd`, `-a` for `--no-auto`; never `-pr`.
- Commit with a conventional subject and the GlitchTip IDs in the body; push (documented hook
  workaround only, never `--no-verify`).
- PR via `Skill("peaklab.ship-pr", args="--base <base> --auto-fix --no-merge <--draft?>")`; refused →
  `ship-pr-in-subagents` fallback.
- Then qa-gate, merge-phase, resolve-glitchtip, final-recap as above.
</step>

</workflow>

<on_error>
- `GLITCHTIP_TOKEN` missing or `GET /projects/` non-2xx → report the status and stop; never proceed
  on an unauthenticated read.
- Cloudflare `403 / 1010` → the transport is wrong, not the token: use `curl` / `rtk proxy curl`.
- GitHub auth fails → ask the user to run `gh auth status` / `gh auth login`.
- `git worktree add` fails for one cluster → skip it, continue with the rest.
- Resolver `blocked` → keep the worktree, surface the blocker, leave the IDs unresolved, no retry.
- Push fails on a hook error → apply the repo-documented workaround, or report the exact output and
  stop. Never bypass hooks.
- Merge conflict needing product judgment → blocked with the affected files; never resolve semantic
  conflicts autonomously.
- Resolve call non-2xx → report the ID and the status; the recap says `resolve failed`.
</on_error>

<on_blocked>
When a resolver, QA cycle, CI run, or merge needs product judgment, preserve the worktree and task
artifacts, record the exact evidence and the next decision, leave every member ID unresolved, and
return the cluster as `blocked`.
</on_blocked>

<gotchas>
- The wrapper error is rarely the cause: an error re-thrown by a route handler usually hides a
  swallowed low-level exception logged one entry away. Cluster them, fix the cause.
- A high count is not high severity, and a `warning` wrapper over an `error` cause takes the cause's
  tier. Rank on the cause.
- A fix is not proven by a green suite: the regression test must fail before the fix.
- Resolving on GlitchTip is what makes the next run's ranking meaningful — but a premature resolve
  hides a live bug. Merge first, always.
- Spawn all resolvers of a batch in one message so they run in parallel.
- Never pass `-b` or `-pr` to apex inside a resolver.
</gotchas>

<acceptance_criteria>
- [ ] Project and environment explicit; token validated before any issue read.
- [ ] Clusters evidence-backed, members and non-members written to `analyze.md`.
- [ ] `.worktrees/` gitignored; one isolated worktree + branch per cluster.
- [ ] Resolver prompts carry the event evidence, tailored analysis contract, ship-pr fallback, and
      RESULT format.
- [ ] analyze/plan/implementation.md in the parent-repo `task_dir`, never in the worktree.
- [ ] Rich statuses handled: pr_created, needs_clarification, already_done, stale_signal, noise,
      blocked, no_changes.
- [ ] QA gate ran per PR (max 2 cycles) and confirmed cluster coverage before any merge.
- [ ] Merges sequential, green checks on the head SHA, update-branch between merges.
- [ ] GlitchTip mutated only after merge, only for covered IDs, with a PR-link comment.
- [ ] Run ends with the `final-recap` and nothing after it.
</acceptance_criteria>

User: $ARGUMENTS
