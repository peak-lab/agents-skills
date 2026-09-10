---
name: step-04-validate
description: Validate the owned patch with fresh, project-native evidence and route to review or finish
prev_step: steps/step-03-execute.md
next_step: steps/step-09-finish.md
---

# Step 4: Validate

<goal>
Prove the requested behavior works without rerunning valid evidence or claiming unrelated failures as task regressions.
</goal>

<scope>
Build the review set from `{owned_paths}`, the captured `{base_sha}`, and the initial dirty-path snapshot. Never use `HEAD~1` as the task boundary. Inspect overlapping pre-existing hunks separately and do not claim them as APEX changes.
</scope>

<evidence_reuse>
Reuse an earlier result only when all are true:

- the exact command and tested scope are recorded;
- it passed;
- relevant source, tests, dependencies, configuration, toolchain, and required service environment have not changed since its fingerprint;
- the result is sufficiently broad for the final acceptance criteria.

Any review fix or later edit invalidates affected evidence.
</evidence_reuse>

<procedure>
1. Discover commands from repository documentation and configuration; do not assume Node, `pnpm`, or script names.
2. Run missing focused checks for every acceptance criterion. If test mode is disabled, do not create or run automated tests solely for APEX; record the explicit skip and use the remaining project checks and inspection evidence.
3. Run the smallest final project-native set justified by the patch, typically relevant tests plus typecheck/lint/build where configured. Run a full suite when repository policy, cross-cutting risk, or delivery requirements call for it.
4. Distinguish regressions caused by the owned patch from pre-existing or unrelated failures. Fix owned regressions. Report unrelated blockers with evidence; do not rewrite unrelated code.
5. Inspect the owned diff for accidental files, debug output, secrets, generated attribution, and scope creep.
6. Record each command, result, and skipped check with its reason.
</procedure>

<routing>
- If validation fails because of the patch, return to `step-03-execute.md` and invalidate affected evidence.
- If test mode is enabled and requested tests are still missing on a legacy non-TDD route, load `step-07-tests.md` once. Never enter steps 07 or 08 when tests are disabled.
- If examine mode is enabled and no review exists for the current fingerprint, load `step-05-examine.md`.
- Otherwise load `step-09-finish.md`, which is the single terminal cleanup path even when PR mode is off.
</routing>
