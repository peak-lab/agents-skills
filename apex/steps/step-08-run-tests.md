---
name: step-08-run-tests
description: Compatibility step for running newly added legacy-route tests before final validation
prev_step: steps/step-07-tests.md
next_step: steps/step-04-validate.md
---

# Compatibility step: run tests

Run only when test mode is enabled. If tests are disabled, return directly to validation without running a test command.

Run the focused project-native command for tests added in step 07. Diagnose failures before changing code or tests; fix root causes within scope and update `{owned_paths}`.

Do not start arbitrary development services or install dependencies merely because a generic test pattern expects them. Use documented project orchestration. If the same root failure persists across three materially different attempts, ask for missing authority/input; if the workflow cannot continue, set blocked status and load `step-09-finish.md`.

Record the result and fingerprint, then return to `step-04-validate.md` for the final proportionate validation set. Do not run a second full suite here.
