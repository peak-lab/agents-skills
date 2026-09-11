---
name: step-03-execute
description: Implement canonical plan slices and keep their verification evidence current
prev_step: steps/step-02-plan.md
next_step: steps/step-04-validate.md
---

# Step 3: Execute

<goal>
Implement the approved plan with minimal, repository-consistent changes.
</goal>

<procedure>
Before editing, require an executable current plan: when auto mode is disabled, `{approved_plan_revision}` must equal `{plan_revision}`. Otherwise return `needs_confirmation` through Finish without changing source or tests.

For each incomplete vertical slice:

1. Re-read the current target and comparable test files before editing; another actor may have changed them.
2. Mark the slice in progress in the existing task state, if any. Do not recreate it as a todo.
3. Follow the plan's test mode:
   - If tests are disabled, do not create or modify tests and do not perform RED/GREEN. Implement the behavior, record the explicit test skip, and leave repository-mandated checks to validation.
   - Otherwise, every test must exercise the highest practical public observable seam, use expected values derived independently of production logic, and mock only genuine external boundaries.
     - In strict TDD, write the focused failing test first, run it, and confirm the intended missing-behavior failure before production code. Setup, syntax, or unrelated failures are blockers, not RED. Implement the smallest production change, run the focused check to GREEN, and refactor only while it remains green.
     - Outside strict TDD, implement the behavior and its proportionate regression coverage together.
4. Add each touched path to `{owned_paths}`. If it was initially dirty, preserve unrelated hunks and inspect the combined diff before continuing.
5. Record only durable evidence: command, scope, outcome, and current code/config/environment fingerprint. A relevant edit or environment change invalidates prior evidence for that slice.
6. Mark the canonical slice complete only when its focused evidence passes.
</procedure>

<change_control>
Follow the approved behavior and scope, but adapt implementation details when current code disproves the plan. If the correction changes product behavior, public contracts, acceptance criteria, material scope, slice boundaries, or test strategy, update the canonical plan and recompute `{plan_revision}`. In non-auto mode, when `{approved_plan_revision}` no longer matches it, route through `step-02-plan.md` and return `needs_confirmation` before further edits. Progress, ownership-status, validation metadata, and implementation details that leave the executable intent unchanged do not invalidate approval.
</change_control>

After all slices are complete, load `step-04-validate.md`. Do not run a duplicate full validation suite here.
