---
name: step-01-analyze
description: Reproduce the error and establish its cause
next_step: steps/step-02-find-solutions.md
---

# Analyze

Read the symptoms, relevant error and failing code, callers, tests and recent changes. Ask for
missing symptoms only when inspection cannot establish them. Do not change production logic yet.

Reproduce the original action and record expected versus actual behavior. Test the most useful
hypothesis against evidence; investigate alternatives when evidence contradicts it or leaves the
cause uncertain. Reuse a current reproduction rather than repeating it for ceremony.

If the failure cannot be reproduced, record the limitation. When interactive instrumentation is
useful and auto mode is off, use [temporary logs](step-01b-log-instrumentation.md). Otherwise use
available evidence without claiming a reproduced failure or a confirmed cause.

Retain `{error_analysis}`: symptoms, reproduction or limitation, supported cause, affected paths and
how the fix will be verified. For analysis-only requests, report findings and stop. Ask for more
context only when it changes the next decision; otherwise continue to
[solutions](step-02-find-solutions.md).
