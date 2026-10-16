---
name: step-01-analyze
description: Analyze the error in depth to understand root cause
next_step: steps/step-02-find-solutions.md
---

# Step 1: Analyze the Error

## Rules

- No code changes and no solution proposals in this step.
- Read the complete error message and stack trace before concluding.
- If `{error_context}` is empty or vague, ask for exact symptoms; check recent changes (`git status`, `git log --oneline -10`).

## Sequence

1. **Reproduce.** Run the exact action that triggers the error and record minimal reproduction steps and conditions. A fix you cannot reproduce cannot be verified.
   - If reproduction fails (environment-specific, intermittent, production-only), load [step-01b-log-instrumentation.md](./step-01b-log-instrumentation.md) unless `{auto_mode}`; in auto mode, document why it cannot be reproduced and continue.
2. **Hypothesize.** List 3-5 causes ranked by likelihood, each with evidence and how to test it. Test them; do not stop at the first idea.
3. **Investigate.** Read the failing code and its callers, related tests, and recent history of the affected lines.
4. **Record `{error_analysis}`:**

| Field | Value |
|-------|-------|
| Error Type / Message | Exact text |
| Reproducible? | Yes / No (why) |
| Reproduction Steps | Minimal steps |
| Root Cause | Immediate and underlying cause |
| Affected Files | List |
| Scope / Complexity | Localized or widespread / Simple, moderate, complex |
| Verification Method | How step 5 will prove the fix |
| Hypotheses Tested | Each one: confirmed / rejected |

5. **Context gate.**
   - `{auto_mode}`: continue.
   - Otherwise: present the summary and ask whether the user has more context (default: continue). Merge any new information into `{error_analysis}`. If reproduction was impossible and step 1b was not run, offer it now.

## Next

Load [step-02-find-solutions.md](./step-02-find-solutions.md).
