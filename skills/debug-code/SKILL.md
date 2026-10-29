---
name: debug-code
description: "Reproduce an application bug, identify its root cause, implement a fix and verify it."
effort: standard
argument-hint: "[error description or context] [-a for auto mode]"
---

# Debug code

Reproduce the reported failure, establish its cause, apply a scoped fix and verify the original
path. Preserve unrelated changes. Analysis-only requests never authorize a fix.

Parse `-a` / `--auto` as auto mode; the rest describes the symptoms. Reuse current caller evidence
instead of restarting investigation. Keep the cause, selected correction, modified files,
temporary logs and verification results in the existing task state when one is needed.

1. Read [analysis](steps/step-01-analyze.md).
2. Choose a correction through [solutions](steps/step-02-find-solutions.md) and
   [selection](steps/step-03-propose.md).
3. Apply the [fix](steps/step-04-fix.md), then [verify](steps/step-05-verify.md).

Load one step at a time. A confirmed cause does not require a quota of hypotheses or alternatives.
Without auto mode, obtain one selection before editing unless the caller already approved the
correction; auto mode skips routine selection, never a material product decision or missing access.
Do not commit, push, deploy or change external state unless requested.
