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
2. Apply implications: PR enables branch; teams enables tasks; forced TDD enables tests; disabled tests disable every APEX TDD and test-writing phase. Reject contradictory pairs and `-d` with `-T`. Repository-mandated validation commands remain authoritative even when they include tests.
3. Derive a short kebab-case `{feature_name}`, retain the original request verbatim, and set `{task_id}` before any sub-step: use the `-r` value for resume, otherwise a caller task ID or collision-safe task slug.
4. If `-r` is set, resolve and restore state before capturing anything or creating a task:
   - Prefer an exact modern task for the current repository, then an exact local legacy directory. If neither exists, recursively collect current-repository task directories whose names match the supplied prefix from the harness task root and `.claude/output/apex/`.
   - Resume only one unique prefix match. If several match, list their absolute paths and request an exact ID. If none match, report the missing task. In both cases set `{resume_lookup_failed}=true`, route to Finish for cleanup, and do not create, overwrite, or select an arbitrary task artifact.
   - Preserve the restored `{base_sha}` and `{initial_dirty_paths}`; record current resume-time worktree differences separately so they are never reclassified as APEX-owned.
   - For legacy state, normalize `tdd_mode=true` to forced and `tdd_mode=false` to disabled. A restored `test_mode=false` still disables all APEX test-writing/TDD phases. Read numbered phase files only to fill missing state.
5. For a new run, capture the task baseline before edits:
   - `{base_sha}`: current `HEAD` when available.
   - `{initial_dirty_paths}`: paths already modified or untracked.
   - `{owned_paths}`: initially empty; add paths only when this workflow changes them.
6. Load optional setup steps only when selected, in this order: interactive, branch, economy, save. Record completion so each sub-step runs at most once when it returns here.
</procedure>

<artifact_reuse>
Record each supplied artifact as `reusable`, `stale`, or `missing`:

- Analysis is reusable when it identifies the relevant code and still matches the worktree.
- A plan is structurally reusable when it covers the current request, acceptance criteria, and current file structure. Compute `{plan_revision}` from its executable intent—scope, acceptance criteria, behavior slices, file boundaries, and test strategy—excluding approval, progress, ownership-status, and validation metadata so recording approval cannot change its own revision.
- In auto mode, a structurally reusable plan is executable. In non-auto mode, it is executable only when `{approved_plan_revision}` exactly matches `{plan_revision}`. Approval of an older revision is stale and must never be inferred from the plan's presence.
- Validation evidence is reusable when its command, scope, result, and code/config/environment fingerprint still match.
- Caller task state is canonical. For every non-trivial run, use its existing plan or create one in the harness task directory (`~/.agents/tasks/{task_id}/plan.md` fallback), independent of save mode.
</artifact_reuse>

<routing>
- If analysis is missing or stale, load `step-01-analyze.md`.
- Otherwise, if the plan is missing, structurally stale, or requires approval for its current revision, load `step-02-plan.md`.
- Otherwise, continue at the first incomplete plan slice in `step-03-execute.md` or `step-03-execute-teams.md`.
- If implementation is complete, load `step-04-validate.md`.
</routing>

Show one short state summary and continue. Ask only when conflicting flags or missing intent prevents a safe choice.
