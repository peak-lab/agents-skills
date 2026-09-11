---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Hono and Mastra

Scope: code using Hono or Mastra.

- Keep transport concerns in routes and middleware; isolate domain and provider integrations behind small interfaces.
- Validate external input before use and return deliberate, non-sensitive error responses.
- Authenticate and authorize protected routes and tool invocations on the server. Do not rely on client-provided tenant, role, or tool permissions.
- Bound model/tool execution with explicit allowed tools, timeouts, input/output limits, and audit-friendly identifiers where the application needs them.
- Keep provider credentials and internal service URLs in server-side configuration, never in client bundles or example literals.
