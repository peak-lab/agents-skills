---
paths:
  - "**/*.php"
  - "config/**"
---

# Symfony

Scope: Symfony application and configuration code.

- Use framework services and dependency injection; keep controllers thin and put reusable business behavior in application services.
- Validate input with forms, request DTOs, or validators at the boundary, then enforce authorization with voters or explicit policies where appropriate.
- Use database transactions for changes that must succeed or fail together. Do not emit irreversible external effects until the transaction commits; use an outbox or equivalent when reliability requires it.
- Return user-safe errors and log diagnostic context without credentials or personal data.
- Follow the installed Symfony and Doctrine versions rather than migrating APIs incidentally while editing a feature.
