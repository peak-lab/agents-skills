---
name: debug-code
description: "Reproduce an application bug, identify its root cause, implement a fix and verify it."
effort: standard
argument-hint: "[error description or context] [-a for auto mode]"
---

<objective>
Debug an error through a gated workflow: analyze and reproduce, find solutions, let the user choose, implement, then prove the fix by executing the real code path.
</objective>

<parameters>
| Input | Effect |
|-------|--------|
| `-a`, `--auto` | `{auto_mode}` = true: skip questions, use the recommended option at each gate |
| Everything else | `{error_context}`; if empty, ask for symptoms during analysis |

Parse flags before any other action. Do not analyze while parsing.
</parameters>

<state_variables>
Persist across steps:

| Variable | Set in | Content |
|----------|--------|---------|
| `{error_context}` | init | User's description of the error |
| `{auto_mode}` | init | Skip confirmations, use recommended options |
| `{error_analysis}` | 1 / 1b | Root cause, reproduction steps, affected files, verification method |
| `{debug_logs}` | 1b / 4 | Temporary logs to remove (file, line, prefix) |
| `{solutions}` | 2 | Candidate fixes with trade-offs, one recommended |
| `{selected_solution}` | 3 | Chosen solution and files to modify |
| `{files_modified}` | 4 | Files changed by the fix |
| `{verification_result}` | 5 | Result of each verification layer |
</state_variables>

<entry_point>
Parse the parameters above, then load [steps/step-01-analyze.md](./steps/step-01-analyze.md).
</entry_point>

<step_files>
| Step | File | Purpose |
|------|------|---------|
| 1 | [step-01-analyze.md](./steps/step-01-analyze.md) | Reproduce, test hypotheses, identify root cause |
| 1b | [step-01b-log-instrumentation.md](./steps/step-01b-log-instrumentation.md) | *Optional*: add debug logs, user runs and shares output |
| 2 | [step-02-find-solutions.md](./steps/step-02-find-solutions.md) | Find 2+ solutions with trade-offs |
| 3 | [step-03-propose.md](./steps/step-03-propose.md) | User selects a solution |
| 4 | [step-04-fix.md](./steps/step-04-fix.md) | Implement the selected solution, remove debug logs |
| 5 | [step-05-verify.md](./steps/step-05-verify.md) | Multi-layer verification (Static → Automated → Runtime → Regression) |
</step_files>

<rules>
- No code changes before step 4, except temporary debug logs in step 1b.
- Do not implement before the user selects a solution, unless `{auto_mode}`.
- Tests passing ≠ fix working. Never claim success without executing the original failing code path.
</rules>

<success_criteria>
- Error reproduced, or instrumented when reproduction is impossible
- Root cause backed by tested hypotheses
- Solution selected by the user (or auto mode) before implementation
- All debug logs removed
- Static, automated and runtime verification passed; no regressions
</success_criteria>
