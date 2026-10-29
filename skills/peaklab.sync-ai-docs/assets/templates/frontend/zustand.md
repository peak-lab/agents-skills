---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/stores/**"
---

# Zustand

Scope: code using Zustand stores.

- Keep stores focused on client state that is genuinely shared; prefer component state for local UI state and a server-state tool for remote cache data.
- Update state immutably. Select the smallest state slice a component needs to limit unnecessary renders.
- With Zustand v5, keep selector outputs referentially stable. Select primitives or existing references directly; use `useShallow` for computed object or tuple selections when shallow equality matches the intended behavior. Avoid allocating fallback functions or fresh containers in an unwrapped selector.
- Keep actions and their invariants with the state they change; avoid exposing mutable store internals.
- Persist only data that is safe to store on the client. Version and migrate persisted state when its shape changes.
- Never place credentials, authorization decisions, or sensitive server data in browser persistence.
