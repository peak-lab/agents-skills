---
name: step-05-verify
description: Verify the original failure path and relevant regressions
prev_step: steps/step-04-fix.md
next_step: null
---

# Verify

Run the affected tests and required repository checks with its declared commands. Exercise the
original failing path: a browser action, request, command or a test that executes the same path.
A passing unrelated test suite is not proof that the failure is fixed.

Record `{verification_result}`: command or action, expected and observed behavior, outcome and
limitations. Reuse fresh results for unchanged code; rerun affected checks after further edits.
Broaden regression coverage when the change or remaining risk warrants it, rather than always
repeating the full suite.

Investigate a failed check using its evidence; stop on missing access, unresolved intent or no
supported next repair. If runtime reproduction is unavailable, report the change as unverified
for that path and state what remains. Do not turn the limitation into a success claim or request
human confirmation when the original path has already been verified.

Return the cause, correction, files changed, checks and remaining limitations. Confirm temporary
logs added by this run were removed. Do not imply a deployment or remote verification.
