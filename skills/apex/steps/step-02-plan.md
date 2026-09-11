---
name: step-02-plan
description: Build or validate one executable implementation plan organized by vertical behavior
prev_step: steps/step-01-analyze.md
next_step: steps/step-03-execute.md
---

# Step 2: Plan

<goal>
Produce the minimum plan needed to implement and verify the requested behavior.
</goal>

<reuse>
If the caller supplied a plan, validate it against current files, scope, acceptance criteria, and test commands. Amend gaps in place; do not create an APEX copy.
</reuse>

The canonical plan is required for every non-trivial APEX run whether save mode is enabled or not. Use the caller's harness task artifact or the fallback selected during initialization.

<procedure>
1. Select the simplest approach consistent with repository conventions.
2. Organize work into vertical, independently verifiable behavior slices rather than one task per file. Each slice names:
   - the behavior and acceptance criteria it satisfies;
   - production and test files likely to change;
   - dependencies or ownership boundaries;
   - focused verification.
3. For a tiny change, one slice is enough. Add dependency metadata only when `tasks_mode` or real parallelism makes it useful.
4. Decide test behavior in this order:
   - tests disabled (`-T`): do not plan, create, modify, or run tests solely for APEX, and do not enter a TDD or legacy test phase. Record the explicit skip. This does not suppress checks required by repository policy or a higher-priority delivery gate, even when such a command includes tests;
   - forced TDD (`-d`): every meaningful behavior uses observed RED, GREEN, then optional REFACTOR;
   - strict TDD disabled (`-D`): add or update appropriate tests without requiring a RED checkpoint;
   - adaptive (default): use strict TDD for meaningful behavior when a focused test can express it cheaply; otherwise add the smallest regression test alongside the change.
5. For every planned test, use the highest practical public observable seam. Derive expected values independently of production logic, and mock only genuine external boundaries such as remote services, time, randomness, or unavoidable filesystem access.
6. Record material risks, required migrations or compatibility constraints, and the final evidence needed.
</procedure>

<approval>
Ask targeted questions only when a wrong assumption would materially change behavior or scope. If required intent remains unavailable, set `needs_clarification` and load Finish.

After the plan is final, compute `{plan_revision}` from its executable intent, excluding approval, progress, ownership-status, and validation metadata. In non-auto mode, implementation requires explicit approval of that exact revision:

- If this actor can ask the user, present the canonical plan once. After approval, record `{approved_plan_revision}={plan_revision}` before routing to execution.
- If an implementation worker cannot ask, return `needs_confirmation` with the plan path and revision. The parent may resume the same worker only after obtaining approval and passing that approval with the same revision; the worker then records it.
- Any plan amendment invalidates approval until the new revision is approved. A caller-supplied plan, prior approval without a matching revision, or `-A` alone is not approval.

Do not add later “ready to continue?” gates after implementation or tests.
</approval>

<delegation_route>
If teams mode is enabled and at least two slices are independent, load `step-02b-tasks.md`, then `step-03-execute-teams.md`. Otherwise load `step-03-execute.md`. Do not create a second task list.
</delegation_route>
