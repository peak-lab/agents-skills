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
4. Decide TDD behavior:
   - forced (`-d`): every meaningful behavior uses observed RED, GREEN, then optional REFACTOR;
   - disabled (`-D`): add or update appropriate tests without requiring a RED checkpoint;
   - adaptive (default): use strict TDD for meaningful behavior when a focused test can express it cheaply; otherwise add the smallest regression test alongside the change.
5. Record material risks, required migrations or compatibility constraints, and the final evidence needed.
</procedure>

<approval>
Ask targeted questions only when a wrong assumption would materially change behavior or scope. If required intent remains unavailable, set `needs_clarification` and load Finish. If auto mode is disabled, present the canonical plan once for approval. Do not add later “ready to continue?” gates after implementation or tests.
</approval>

<delegation_route>
If teams mode is enabled and at least two slices are independent, load `step-02b-tasks.md`, then `step-03-execute-teams.md`. Otherwise load `step-03-execute.md`. Do not create a second task list.
</delegation_route>
