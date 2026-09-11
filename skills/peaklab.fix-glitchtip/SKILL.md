---
name: peaklab.fix-glitchtip
description: Use when the user explicitly wants an inline, sequential GlitchTip inbox pass in the current checkout.
effort: deep
argument-hint: "[project-slug] [--level fatal|error|warning|info] [--all] [--limit N] [--auto] [--wait-merge | --no-merge] [--no-resolve]"
---

<overview>
Process demonstrated root-cause clusters sequentially in the current checkout. This is the
inline adapter, not the isolated-worktree workflow: choose `peaklab.glitchtip-do-issue` for
isolation or parallel work, and `peaklab.track-error` when a GitHub issue is required.
</overview>

<constraints>
- Read [the shared GlitchTip contract](../peaklab.glitchtip-do-issue/references/glitchtip-contract.md)
  before API access; reuse its configuration, evidence and resolution rules.
- Keep projects/environments separate and preserve existing user edits.
- Default to one reviewed PR, without merge. Delivery intent or `--wait-merge` authorizes
  shipping; `--no-merge` overrides it. `--no-resolve` forbids all GlitchTip writes.
- A low severity or suspected bot request never authorizes automatic suppression.
- One plan and one official review per cluster. Never require a private agent definition.
</constraints>

<arguments>

| Input | Meaning |
|---|---|
| Positional project slug | Select this project; otherwise match repository metadata and ask if ambiguous |
| `--level` | Minimum severity, default error; order fatal > error > warning > info > debug |
| `--limit N` | Positive candidate cap, default 20; disclose pagination/truncation |
| `--all` | Process all clusters from this bounded candidate set, sequentially; no automatic refresh loop |
| `--auto` | Skip routine plan approval, not missing product decisions; default off |
| `--wait-merge` / `--no-merge` | Explicit delivery / reviewed PR only |
| `--no-resolve` | Read-only GlitchTip access throughout |

</arguments>

<workflow>
1. Fetch unresolved candidates for the explicit project/environment, filter severity and rank
   by severity then occurrence count. Select one cluster unless `--all` was requested.
   An empty filtered/limited result does not prove a globally empty inbox.
2. Read relevant events once. Group only a proven common cause and acceptance test, recording
   covered/rejected IDs and sanitized evidence in the harness task directory. Matching titles,
   occurrence counts and age are triage hints, not proof of a fix or harmlessness.
3. Bind the current checkout, repository and task branch. Never implement on the base branch.
   Create a task branch only when safe; reuse an existing branch only if its commits belong
   to this cluster. Preserve unrelated dirty hunks and stop on inseparable ownership.
   For the next cluster, use a separate clean branch from the resolved base; do not stack
   its patch on an unmerged previous cluster. Stop safely if the inline checkout cannot switch.
4. Implement via APEX with `-e` and the existing task state: `-a` for `--auto`, otherwise
   `-A`. No `-pr` or `-x`: this adapter owns PR creation, and shipping owns the official
   review. Small changes may use a single plan slice; appropriate regression checks remain.
   Fatal, auth, billing, migration or cross-service scope requires the corresponding expertise
   and a risk-appropriate reviewer. Load repository specialists when available.
5. If APEX needs confirmation, clarification or planning, return that state without committing
   or resolving. Otherwise require current criteria/validation, stage only owned hunks,
   commit, push and open a PR with `gh`. List each covered GlitchTip ID; do not use GitHub
   `Closes #N` for those IDs. Do not publish event dumps.
6. Run `peaklab.ship-pr --pr <PR_URL> --repo <OWNER/REPO> --worktree <ABSOLUTE_PATH> --task-state <ABSOLUTE_TASK_PATH>`
   with the task-state path, expected head/base and validation. Add `--no-merge` unless delivery
   is authorized. This single call owns review and optional CI/merge; no second reviewer loop.
   If a nested Skill call is unavailable, read the installed shipping instructions and execute
   the same gates directly. An unavailable tool does not remove a gate or grant authority.
7. Apply the shared GlitchTip resolution gate to each verified member. A merged PR without
   deployed-release/regression evidence remains unresolved. Noise needs explicit agreement.
8. With `--all`, record blocked/uncertain clusters and continue only to an independent cluster
   when the checkout can be prepared safely. Otherwise stop. No unrequested deployment,
   timer, scheduled follow-up or new queue pass.
</workflow>

<result>
Report each cluster's IDs, PR, code status, deployment evidence, resolution status and blocker.
State the candidate limit and report an inbox total only when measured or supplied by the API.
</result>
