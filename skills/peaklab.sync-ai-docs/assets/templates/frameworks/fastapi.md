---
paths:
  - "**/*.py"
---

# FastAPI

Scope: FastAPI application code.

- Use dependency injection for shared request concerns such as authentication, database sessions, and policy checks. Ensure protected endpoints enforce authorization server-side.
- Define request and response schemas explicitly and validate input at the boundary. Follow the installed Pydantic version's supported APIs.
- Map expected domain failures to consistent HTTP responses; do not leak implementation details in errors.
- Treat WebSocket and background-job identifiers as untrusted inputs: authenticate or authorize access, constrain subscriptions, and clean up resources on disconnect.
- Use enums or validated constrained types for stable domain values when that improves correctness; do not introduce ceremony for transient text.
