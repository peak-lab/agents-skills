---
name: step-05-verify
description: Multi-layer verification to prove the fix works
prev_step: steps/step-04-fix.md
next_step: null
---

# Step 5: Verify the Fix (Multi-Layer)

## Rules

- Assume the fix is broken until runtime execution proves otherwise. Green tests alone are not proof.
- Run every layer in order and record each result in `{verification_result}`. If a layer fails, fix and restart from Layer 1.
- Verify the original error scenario using `{error_analysis.verification_method}`.

## Layers

1. **Static:** modified files parse, imports resolve.
2. **Automated:** the project's build, typecheck, lint and tests related to the change, using its own scripts. Record Passed / Failed / Skipped (with reason).
3. **Runtime (mandatory, never skip):** execute the actual failing path: browser interaction for UI, real request for an API, the original command for a CLI, a full run for a build error. Record method, whether the original error still occurs, new errors, actual vs expected behavior. If it fails, the fix does not work: return to step 3 or 4.
4. **Regression:** run the full test suite or CI-equivalent check. Then, unless `{auto_mode}`, ask the user to confirm the original issue is resolved.

## Report

On success:

| Field | Value |
|-------|-------|
| Error | Original error |
| Solution | `{selected_solution.name}` |
| Files Modified | Count |

| Layer | Check | Result |
|-------|-------|--------|
| 1 | Static | Passed |
| 2 | Build / Types / Lint / Tests | Passed or Skipped (reason) |
| 3 | Runtime Execution | Passed |
| 4 | Regression | No regressions |

On failure: attempt to fix and re-verify; if still failing, report which layer failed with evidence and offer retry, revert or accept partial fix. Never claim success without executing the code path that was failing.
