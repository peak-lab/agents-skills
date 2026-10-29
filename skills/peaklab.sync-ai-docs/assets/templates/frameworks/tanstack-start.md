---
paths:
  - "src/**"
  - "vite.config.*"
  - "rsbuild.config.*"
  - "server.*"
---

# TanStack Start (React)

Scope: React TanStack Start routes, server functions, SSR and build configuration.

- Verify installed Start, Router and build-plugin versions before copying examples. Use the configured runtime and bundler; do not impose Next.js conventions or a deployment adapter the project has not adopted.
- Route loaders and `beforeLoad` are isomorphic and can execute in the browser. Access private services through `createServerFn` or server route handlers; a route guard improves navigation but does not authorize the data endpoint.
- Treat server functions as callable endpoints, including reads. Parse untrusted input with a runtime validator supported by the installed API, authenticate protected operations and enforce resource permissions in the server boundary. A TypeScript annotation or a validator that merely returns its input performs no runtime validation. Use POST for mutations.
- Keep credentials and server dependencies in server-only modules/functions. Use the installed import-protection facilities; fail production builds on boundary violations rather than disabling protection. Distinguish RPC server functions from server-only utilities, which cannot be invoked remotely from client code.
- Validate private environment configuration on the server. Read request-dependent configuration in the active server context; only deliberately public values may use the bundler's exposed environment prefix.
- Create router and server-side QueryClient state per SSR request, never in a shared singleton. When Query is used, preserve the configured SSR integration and hydration; do not add a second cache/provider that bypasses it. Clear or partition private client caches when identity changes.
- Do not publicly cache personalized HTML or server-function responses. Keep browser APIs out of server rendering, and ensure the initial client render agrees with SSR.
- Preserve file-route generation and type registration. Do not hand-edit generated route trees; use the project's router links, params and search validation.
- Verify the configured build/server entrypoint and relevant SSR, hydration, navigation and boundary tests. A dev-server success does not establish production hosting compatibility.
