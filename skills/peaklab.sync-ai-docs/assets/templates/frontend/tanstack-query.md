---
paths:
  - "**/*.tsx"
  - "**/query/**"
  - "**/hooks/**"
---

# TanStack Query

Scope: data fetching, client cache and SSR integration using TanStack Query.

- Follow the installed major version's API. In v5, use the single object form with a stable array `queryKey` and a `queryFn` that returns or throws.
- Make query keys describe every input that changes the result. Keep key construction close to the feature or centralize it consistently.
- Render pending, error, and success states deliberately; distinguish an initial load from a background refresh when that changes the UI.
- Model server-changing operations as mutations. On success, update or invalidate the smallest affected cache scope.
- Do not treat client-cache state as authorization. The server remains the authority for every read and mutation.
- In SSR, create a QueryClient per request and preserve the framework's dehydration/hydration integration; a module-level server cache can expose one user's data to another. Partition or remove private client cache data when the authenticated identity changes.
- Choose `staleTime`, retry and refetch behavior deliberately for the feature instead of disabling defaults globally to hide repeated requests. Optimistic mutations need cancellation of conflicting refetches, a rollback path on failure and reconciliation with server state.
