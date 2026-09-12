---
name: to-spec
description: "Turn established requirements and codebase context into an implementation-ready specification."
disable-model-invocation: true
---

# To Spec

Synthesize what is already known. Do not restart discovery with a generic interview; ask only about a concrete ambiguity that would materially alter the contract.

1. Read relevant domain glossary entries and ADRs, then inspect the affected code paths and existing behavior.
2. State the public seams through which the behavior will be verified. Prefer existing, observable interfaces and the highest meaningful seam.
3. Produce a durable spec in the project's normal planning location or issue tracker, respecting its configured conventions.

Use this structure:

```markdown
## Problem

## Desired outcome

## User stories

## Behaviour and acceptance criteria

## Technical and architectural decisions

## Verification strategy

## Out of scope

## Open questions
```

Keep user-facing behavior and acceptance criteria specific and testable. Record stable technical decisions, contracts, invariants, and migration constraints, but avoid volatile file paths and code snippets unless a compact state machine, schema, or type shape is the clearest expression of a decision.

Before publishing, verify that every acceptance criterion has a proposed observable verification path and that out-of-scope items are explicit.
