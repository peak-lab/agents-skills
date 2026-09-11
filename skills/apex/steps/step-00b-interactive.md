---
name: step-00b-interactive
description: Configure APEX flags with one compact interaction
returns_to: step-00-init.md
---

# Optional setup: interactive

Present the current flag values once and let the user select overrides in a single interaction. Preserve explicit command-line choices unless the user changes them here.

After selection:

- PR implies branch.
- Teams implies tasks.
- Forced TDD implies tests and conflicts with disabled tests.
- Disabled tests suppress adaptive and non-TDD test creation; repository-mandated validation checks remain authoritative.
- Explicit negative flags remain authoritative.

Reject unresolved conflicts, otherwise return to `step-00-init.md` without a second confirmation.
