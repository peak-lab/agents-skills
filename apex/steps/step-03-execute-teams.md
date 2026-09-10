---
name: step-03-execute-teams
description: Delegate independent canonical plan slices using the current harness capabilities
prev_step: steps/step-02b-tasks.md
next_step: steps/step-04-validate.md
---

# Step 3: Execute with delegation

<preconditions>
Use this step only when teams mode is enabled, economy mode is off, delegation is available, and at least two slices are genuinely independent. Otherwise use `step-03-execute.md`.
</preconditions>

<procedure>
1. Use the current harness's available worker/task primitives. Do not require Claude-specific team APIs, modes, key bindings, or a fixed worker count.
2. Assign one bounded vertical slice per worker with explicit owned paths, acceptance criteria, dependencies, TDD mode, focused checks, and relevant repository evidence.
3. Tell every worker that others share the worktree: do not revert others' edits, do not touch unowned paths without coordination, and adapt to concurrent changes.
4. Start only independent assignments in parallel and never exceed the harness concurrency limit. The coordinator may implement an unowned slice when that is the fastest safe use of capacity.
5. Integrate completion reports into the existing canonical plan. Verify reported evidence and inspect shared-file conflicts before marking a slice complete.
6. Record live worker identifiers in canonical state so the terminal step can clean them up.
</procedure>

When all slices are integrated, load `step-04-validate.md`. Do not keep idle workers alive merely for possible follow-up; end them unless a concrete review/fix assignment remains.
