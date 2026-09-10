---
name: step-00-init
description: Parse APEX input, establish scope and baseline, and route to the first missing phase
next_step: steps/step-01-analyze.md
---

# Step 0: Initialize

<goal>
Create a compact workflow state without touching source code.
</goal>

<procedure>
1. Parse every flag before repository actions. Defaults are: auto `true`, examine `false`, save `false`, tests `true`, TDD `adaptive`, economy `false`, branch `false`, PR `false`, tasks `false`, teams `false`.
2. Apply implications: PR enables branch; teams enables tasks; forced TDD enables tests; disabled tests disable adaptive TDD. Reject contradictory pairs and `-d` with `-T`.
3. Derive a short kebab-case `{feature_name}`, retain the original request verbatim, and set `{task_id}` before any sub-step: use the `-r` value for resume, otherwise a caller task ID or collision-safe task slug.
4. If `-r` is set, restore the matching canonical harness task artifact before capturing anything. Preserve its original `{base_sha}` and `{initial_dirty_paths}`; record current resume-time worktree differences separately. If no modern state exists, read the legacy `.claude/output/apex/{task_id}/00-context.md` and numbered phase files only to fill missing state.
5. For a new run, capture the task baseline before edits:
   - `{base_sha}`: current `HEAD` when available.
   - `{initial_dirty_paths}`: paths already modified or untracked.
   - `{owned_paths}`: initially empty; add paths only when this workflow changes them.
6. Load optional setup steps only when selected, in this order: interactive, branch, economy, save. Record completion so each sub-step runs at most once when it returns here.
</procedure>

<artifact_reuse>
Record each supplied artifact as `reusable`, `stale`, or `missing`:

- Analysis is reusable when it identifies the relevant code and still matches the worktree.
- A plan is reusable when it covers the current request, acceptance criteria, and current file structure.
- Validation evidence is reusable when its command, scope, result, and code/config/environment fingerprint still match.
- Caller task state is canonical. For every non-trivial run, use its existing plan or create one in the harness task directory (`~/.agents/tasks/{task_id}/plan.md` fallback), independent of save mode.
</artifact_reuse>

<routing>
- If analysis is missing or stale, load `step-01-analyze.md`.
- Otherwise, if the plan is missing or stale, load `step-02-plan.md`.
- Otherwise, continue at the first incomplete plan slice in `step-03-execute.md` or `step-03-execute-teams.md`.
- If implementation is complete, load `step-04-validate.md`.
</routing>

Show one short state summary and continue. Ask only when conflicting flags or missing intent prevents a safe choice.
