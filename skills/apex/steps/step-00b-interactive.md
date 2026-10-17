---
name: step-00b-interactive
description: Configure APEX flags with one compact interaction
returns_to: step-00-init.md
---

# Optional setup: interactive

Present the current flag values once and let the user select overrides in a single interaction. Preserve explicit command-line choices unless the user changes them here.

After selection, re-apply the implications and conflict rules from `SKILL.md`; explicit negative flags remain authoritative. Reject unresolved conflicts, otherwise return to `step-00-init.md` without a second confirmation.
