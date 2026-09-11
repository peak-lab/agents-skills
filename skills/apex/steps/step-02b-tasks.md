---
name: step-02b-tasks
description: Add dependency and ownership metadata to the canonical vertical plan slices
prev_step: steps/step-02-plan.md
next_step: steps/step-03-execute-teams.md
---

# Optional planning: tasks

Enrich the existing canonical plan; do not create task files, a second task list, a README, or a duplicate dependency graph.

For each vertical slice record:

- stable ID and user-visible behavior;
- acceptance criteria and focused verification;
- owned production and test paths;
- minimal `blocked_by` relationships;
- assigned worker, if delegated.

Avoid splitting by file when a behavior crosses layers. Combine tiny sequential edits. Parallelize only slices with disjoint ownership and satisfied dependencies.

If teams mode is active and useful, load `step-03-execute-teams.md`; otherwise load `step-03-execute.md`.
