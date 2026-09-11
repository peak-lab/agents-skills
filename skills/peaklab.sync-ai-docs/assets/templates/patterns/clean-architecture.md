---
paths:
  - "**/*"
---

# Clean architecture

Scope: application code when a layered architecture is already useful or established.

- Keep domain rules independent of delivery mechanisms and infrastructure details where that separation has a clear payoff.
- Direct dependencies inward: adapters depend on application/domain contracts, not the reverse.
- Make transaction boundaries, authorization checks, and external side effects explicit in application workflows.
- Use interfaces at meaningful seams such as storage, clocks, payment providers, or external APIs; do not add abstractions solely to mirror every class.
- Test business rules without network or database dependencies, and cover adapters separately at their integration boundary.
