# Using the catalogue as a team

## Setup once, keep project rules local

Start with the same four skills as the README: `apex`, `review-code`, `tdd`, and `handoff`.
Follow the [installation guide](installation.md) for commands, verification, and prerequisites.
Add only the workflow needed for your next task. The broader `core` synchronization profile
also includes planning tools; it is not the starter set.

For a repeatable team rollout, agree on a reviewed repository commit and use the
[local checkout installation](distribution.md#editable-installation-all-supported-hosts).
Record the revision and selected skills. Reinstallation can replace installed copies: keep
team changes in version control, not only in a personal install.

RTK is an optional output optimization; without it, use the underlying command with the same permissions.

Keep branch policy, build/test commands, package ownership and deployment rules in the project's
`AGENTS.md`/harness instructions. No colleague needs another person's home directory, private agent names,
or a personal runner. A repository-owned specialist is used when declared; otherwise
the workflow runs with available capabilities and the same verification requirements.

Each person uses their own least-privileged service credentials. Configure only needed services
in gitignored project settings or their personal harness configuration. Never share populated
`.env` files, task artifacts with customer data, or access tokens in the catalogue.

## First task

Begin with the README's `apex`, `review-code`, `tdd`, and `handoff` starter set in a disposable
branch of a familiar project. Read the existing project instructions and test commands first;
do not scaffold new tracker configuration or duplicate project rules just to try the skills.

Try: “Use apex to fix [one reproducible behavior]. Acceptance: [observable result]. Run the
relevant project tests. Do not commit, push or open a PR.” Supply the actual reproduction.

Then ask: “Use review-code to review these local changes, including new source files. Do not
edit.” Use `handoff` only when another session needs to continue; `tdd` is available when a
focused test-first task needs it, not a second mandatory implementation workflow.

Once this works, add the [GitHub, Plane, or GlitchTip workflow](installation.md#add-a-workflow)
your project uses. Native agents are optional. Add `-g` only when
intentionally installing for all your projects; do not combine plugin and native copies of the
same skills by default.

## Choose one entry point

| Starting point | Entry skill | Owns | Delegates/reuses |
|---|---|---|---|
| Bounded code change | `apex` | Analysis, plan, implementation, validation | Existing context, project checks; PR only with `-pr` |
| GitHub issue | `peaklab.gh-do-issue` | Selection, checkout, official review, result | APEX, explicit shipping target |
| Plane issue | `peaklab.plane-do-issue` | Selection, owner routing, official review | APEX, `peaklab.plane-ship-watch` for requested delivery |
| GlitchTip cluster, isolated | `peaklab.glitchtip-do-issue` | Error evidence and status | Shared issue execution, GlitchTip evidence contract |
| GlitchTip inbox, explicit inline pass | `peaklab.glitchtip-do-issue --inline --all` | Bounded sequential fixes in current checkout | Shared executor with inline checkout rules, one QA/delivery owner |
| One error requiring a GitHub trace | `peaklab.track-error` | Error-to-ticket linkage and status | GitHub issue workflow, shared evidence contract |
| Existing PR to finalize | `peaklab.ship-pr` | Bound target, review, CI, authorized merge | Current caller evidence; optional explicit Plane sync |

Do not run several entry points over the same issue or checkout simultaneously. Parallel issues
need separate branches/worktrees and explicit ownership; a source adapter remains the only owner
of tracker/error state changes.

GlitchTip repair has one canonical skill. Use `--project SLUG` for project selection and
`--inline` only when the current checkout is intentional. `--all` is capped by `--limit`
(default 20 candidates), not an unbounded inbox drain. Automatic plan execution is the default;
add `--no-auto` for plan approval. Merge and error resolution still require their explicit gates.
Updating the catalogue does not remove retired copies from personal skill installations;
review those separately and keep only the canonical repair entrypoint.

Use focused planning skills only when they add missing context: `grilling` for unresolved
decisions, `wayfinder` for a broad uncertain initiative, `domain-modeling` for changed language
or invariants, `to-spec` for an implementation-ready specification and `to-tickets` for approved
work that needs splitting. An existing precise ticket does not need to pass through all of them.
`tdd`, `review-code` and `handoff` are focused tools, not extra mandatory phases after APEX.

## The handoff is small and explicit

Pass source IDs/URLs, repository, absolute checkout, branch/head/base, scope and acceptance
criteria, plus the canonical task-state path. Include modes, `plan_revision` and any approval
for that revision. Attach validation commands/results and a revision-bound review verdict when
available. Do not copy the same analysis into several new plans.

- A current plan is reusable; it is not automatically approved under `--no-auto`.
- `--no-tdd` disables test-first discipline, not tests. APEX `--no-test` is a separate opt-out
  and does not waive checks required by higher-priority repository instructions.
- Review/validation evidence is reused only for the code, configuration and environment it covers.
- A shipping handoff names the PR, repository, worktree and `--task-state` artifact explicitly. Missing Skill tools may
  use direct instruction reading, never weaker safety gates.
- Composed issue workflows stop at a reviewed PR by default. Request delivery explicitly or use
  `--wait-merge`. Draft and `--no-merge` requests never become merges by inference.
- `pr_created`, `merged`, deployed and resolved are different outcomes. Missing deployment
  evidence leaves GlitchTip open. No workflow silently schedules itself for later.

## Workflow options and authorization

- Issue workflows stop at a reviewed PR by default. Request delivery explicitly or use
  `--wait-merge`. `--no-merge` stops at the PR; drafts never merge.
- Use `--no-auto` for plan approval. `--no-tdd` disables test-first work, not validation.
- A merged fix is not proof of deployment. GlitchTip resolution needs verified deployment
  and regression evidence in the affected environment.
- No deferred monitoring is created implicitly. `--async-merge` uses a live session worker
  only when the host supports it.
- Keep credentials in environment variables or gitignored configuration, never in this catalogue.
  Deploys, merges, deletes, restarts, and issue updates require user intent; destructive actions
  require confirmation at the point of risk.

## Maintaining the shared version

Follow the [contributor guide](contributing.md) to change skills, inspect callers, and run the
required checks. Service contracts remain in their owning packages.
