# Server Functions and Actions

Scope: server-side functions and action handlers that perform application mutations.

- Treat every Server Function/Action as a public mutation endpoint. Validate its input and authenticate and authorize the specific operation on every invocation.
- Do not rely on hidden form fields, client-side role checks, or page-level guards for authorization.
- Keep mutations small and explicit. Use a transaction when multiple durable changes must be atomic.
- Revalidate or update only the cache entries affected after a successful mutation.
- Return expected validation failures in a form the UI can render; avoid exposing internal errors, secrets, or stack traces.
- Configure any cross-origin action access narrowly and only when the deployment requires it.
