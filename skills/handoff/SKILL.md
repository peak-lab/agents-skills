---
name: handoff
description: "Write a concise continuation brief when work pauses or transfers to another agent or session."
argument-hint: "What should the next session accomplish?"
disable-model-invocation: true
---

# Handoff

Write a compact continuation document outside the repository, in the operating system's temporary directory. Tailor it to the user's stated next objective when provided.

Include:

- objective and current status;
- decisions made and why;
- exact files, issues, plans, ADRs, commits, and commands that matter (reference artifacts instead of duplicating them);
- verification already completed and its results;
- unresolved risks, blockers, and the first safe next action;
- suggested skills for the next agent to invoke.

Redact credentials, tokens, personal data, and other sensitive values. Do not make a handoff document an alternative source of truth: link to the durable specification, plan, issue, or diff that already contains details.
