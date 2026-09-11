---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Zod validation

Scope: TypeScript code using Zod.

- Validate untrusted input at system boundaries: requests, forms, environment configuration, webhooks, and third-party responses.
- Use `parse` when invalid input should stop execution and `safeParse` when the caller must handle validation failure as data.
- Derive TypeScript types from the schema when practical so runtime validation and static types stay aligned.
- Reject or explicitly handle unknown fields for security-sensitive payloads; do not silently pass unvalidated values to persistence or privileged operations.
- Keep schemas reusable but close enough to their boundary that error messages and authorization context remain clear.
