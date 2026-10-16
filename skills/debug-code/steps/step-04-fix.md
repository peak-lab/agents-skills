---
name: step-04-fix
description: Implement the chosen solution
prev_step: steps/step-03-propose.md
next_step: steps/step-05-verify.md
---

# Step 4: Fix the Problem

## Rules

- Implement `{selected_solution}` exactly. Ask before deviating from it or touching files outside `{selected_solution.files_to_modify}`; if unavoidable extra changes appear, keep them minimal and record them.
- No unrequested refactors, features or formatting changes.
- Read each file before editing it.
- Temporary logs added here follow the same `[DEBUG:<kind>]` prefix and metadata-only rule as step 1b and are added to `{debug_logs}`.

## Sequence

1. Apply the changes and record each in `{files_modified}` (file, change).
2. Remove every debug log: all `{debug_logs}` entries from step 1b and any added here.
3. Confirm none remain: search the modified files for `[DEBUG` (e.g. `grep -rn "\[DEBUG" <paths>`). Leftover debug output blocks step 5.

## Next

Load [step-05-verify.md](./step-05-verify.md) without asking.
