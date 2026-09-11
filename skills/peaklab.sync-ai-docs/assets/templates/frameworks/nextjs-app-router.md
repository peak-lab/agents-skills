---
paths:
  - "app/**"
  - "src/app/**"
---

# Next.js App Router

Scope: App Router code.

- Prefer Server Components. Add `"use client"` only for browser APIs, event handlers, client hooks, or a client-only dependency.
- Follow the installed Next.js version's request API contracts; newer releases make several request values asynchronous, so verify before changing `params`, `searchParams`, cookies, headers, or route-handler signatures.
- Treat route handlers and Server Functions as public endpoints: validate input and authenticate and authorize each operation at the boundary.
- Use an execution runtime compatible with the dependencies used by that route; do not select an edge runtime for Node-only dependencies.
- Cache and revalidate intentionally. Associate related reads with a stable tag where appropriate, and invalidate only the paths or tags affected by a successful mutation.
- Keep secrets server-only. Public environment variables must be deliberately safe to expose.
