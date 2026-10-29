---
name: step-04-fix
description: Implement the selected correction and remove temporary logs
prev_step: steps/step-03-propose.md
next_step: steps/step-05-verify.md
---

# Fix

Apply the selected behavior and scope; read each file before editing. Adapt routine implementation
details to current code without another approval. Ask if evidence requires changing the agreed
behavior, compatibility contract or material scope. Preserve unrelated work; do not add refactors.

Record `{files_modified}`. Temporary logs follow the
[metadata-only instrumentation rules](step-01b-log-instrumentation.md) and enter `{debug_logs}`.
Remove every log added by this run before verification, including instrumentation when no fix
can be completed. Search modified files for its debug markers without removing pre-existing logs.

Continue to [verification](step-05-verify.md).
