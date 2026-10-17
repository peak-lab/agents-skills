---
name: step-03-execute-teams
description: Delegate independent canonical plan slices using the current harness capabilities
prev_step: steps/step-02b-tasks.md
next_step: steps/step-04-validate.md
---

# Step 3: Execute with delegation

<preconditions>
Use this step only when teams mode is enabled, economy mode is off, delegation is available, and at least two slices are genuinely independent; otherwise use `step-03-execute.md`. When auto mode is disabled, also require `{approved_plan_revision}={plan_revision}` before spawning any worker; otherwise return `needs_confirmation` through Finish.
</preconditions>

<procedure>
1. Use the current harness's worker/task primitives. Do not require Claude-specific team APIs, modes, key bindings, or a fixed worker count.
2. Assign one bounded vertical slice per worker with explicit owned paths, acceptance criteria, dependencies, test/TDD modes, focused checks, and relevant repository evidence. When tests are disabled, explicitly forbid test edits and TDD phases while retaining repository-mandated validation. Otherwise require public observable seams, independent expected values, and mocks only at genuine external boundaries.
3. Tell every worker that others share the worktree: do not revert others' edits, do not touch unowned paths without coordination, and adapt to concurrent changes.
4. Start only independent assignments in parallel, within the harness concurrency limit. The coordinator may implement an unowned slice when that is the fastest safe use of capacity.
5. Integrate completion reports into the canonical plan. Verify reported evidence and inspect shared-file conflicts before marking a slice complete.
6. Record live worker identifiers in canonical state so the terminal step can clean them up.
</procedure>

When all slices are integrated, load `step-04-validate.md`. End idle workers unless a concrete review/fix assignment remains.
