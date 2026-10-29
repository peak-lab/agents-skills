---
name: refactor
description: "Apply a defined structural change across code while preserving behavior. Use clean-code for an open-ended maintainability assessment."
effort: standard
argument-hint: <search-pattern-or-description>
---

# Refactor

Apply the requested transformation without changing observable behavior or unrelated work.

1. Locate affected definitions and callers, including tests and public interfaces. Read the
   repository's instructions and existing changes before editing. Resolve ambiguity about the
   transformation or compatibility contract; file count alone does not require confirmation.
2. Define the pattern to replace and the invariants to preserve. Reuse the caller's plan;
   create a shared instruction artifact only when resumption or delegation needs one.
3. Apply coherent batches that keep callers and definitions consistent. Delegate only genuinely
   independent work when it benefits the task and the host supports it; otherwise work directly.
   Avoid concurrent edits to the same files and preserve unrelated changes.
4. Search for remaining old references and unintended replacements. Run the affected tests and
   required checks using the repository's own commands and package manager. Do not substitute a
   text search or type check for behavior verification where behavior can change.
5. Report the transformation, affected scope, checks and remaining limitations. Stop on an
   unresolved compatibility decision or a blocker without broadening the refactor. Do not
   commit, push or create a PR unless requested.
