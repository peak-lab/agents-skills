---
paths:
  - "**/*.tsx"
  - "**/query/**"
  - "**/hooks/**"
---

# TanStack Query

Scope: client data-fetching code using TanStack Query.

- Follow the installed major version's API. In v5, use the single object form with a stable array `queryKey` and a `queryFn` that returns or throws.
- Make query keys describe every input that changes the result. Keep key construction close to the feature or centralize it consistently.
- Render pending, error, and success states deliberately; distinguish an initial load from a background refresh when that changes the UI.
- Model server-changing operations as mutations. On success, update or invalidate the smallest affected cache scope.
- Do not treat client-cache state as authorization. The server remains the authority for every read and mutation.
