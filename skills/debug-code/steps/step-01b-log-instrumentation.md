---
name: step-01b-log-instrumentation
description: Add strategic logs and collect user feedback for visibility
prev_step: steps/step-01-analyze.md
next_step: steps/step-02-find-solutions.md
---

# Step 1b: Log Instrumentation (optional)

Used only when step 1 cannot reproduce the error. Not available in `{auto_mode}`: skip to step 2 with the best available analysis.

## Rules

- Add temporary logs only. Do not fix the bug or change logic.
- Prefix every log with `[DEBUG:<kind>]` (`entry`, `exit`, `decision`, `branch`, `transform`, `async`, `state`, `error`) so it can be found and removed.
- **Metadata only (binding).** Logs may contain structural metadata only: types, counts, booleans, branch taken, durations, timestamps. Never log raw arguments, return values, request or response bodies, user objects, identifiers, session IDs, passwords, tokens, API keys, secrets, PII, payment data, or error messages that may carry application data. Treat every log as externally persisted. Example: log `credentialsSubmitted: Boolean(user && password)`, never `{ user, password }`.
- Record every added log in `{debug_logs}` (file, line, prefix) at the moment you add it.
- **Cleanup (binding).** Every `{debug_logs}` entry must be removed in step 4 before verification; confirm with a search for `[DEBUG` in the modified files. No debug log may survive the workflow.

## Sequence

1. From `{error_analysis}`, choose checkpoints at entry/exit, decision points, data transformations and async boundaries of the suspected area. State the placement plan before editing.
2. Add the logs, then re-read each one against the metadata-only rule.
3. Execute the instrumented path with available tools. Ask the user to reproduce and share output only when that environment is inaccessible. If reproduction remains unavailable, remove this run's logs and continue with the limitation recorded.
4. Analyze the output: execution order, missing checkpoints, unexpected branches or counts. Update `{error_analysis}` with findings and remaining unknowns.
5. Continue to solutions once the evidence supports a correction. Add instrumentation only for a specific unresolved hypothesis; stop and remove this run's logs if no useful next observation is available.

## Next

Load [step-02-find-solutions.md](./step-02-find-solutions.md).
