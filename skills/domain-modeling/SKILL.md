---
name: domain-modeling
description: "Clarify business terminology and domain boundaries; record consequential architectural decisions."
---

# Domain Modeling

Keep the domain language precise, shared, and independent from implementation details.

## Start with existing language

1. Read `CONTEXT-MAP.md` when it exists; otherwise read the relevant `CONTEXT.md`.
2. Read applicable ADRs under `docs/adr/`.
3. Compare the user's terms with that vocabulary and surface mismatches before designing a solution.

## Refine the model

- Separate overloaded terms: distinguish concepts that have different lifecycles, owners, or invariants.
- Use concrete edge cases to test proposed definitions and boundaries.
- Check the implementation when a stated business rule might contradict it; report the conflict rather than silently choosing one side.
- Capture a resolved domain term immediately in the appropriate `CONTEXT.md`. Define what it is in one or two sentences and list terms to avoid.
- Never put APIs, class names, schemas, or implementation notes in `CONTEXT.md`.

Create a root `CONTEXT.md` only when the first term is settled. For multiple bounded contexts, use `CONTEXT-MAP.md` to point to each context's glossary.

## ADRs

Offer an ADR only when the decision is difficult to reverse, non-obvious to a future reader, and chosen after a genuine trade-off. Keep it short: context, decision, and rationale. Use the next sequential filename in `docs/adr/`, such as `0004-orders-owned-by-sales.md`.

## Completion

Summarize the vocabulary or decision that changed, the scenarios that validate it, and any code/documentation contradictions that still need resolution.
