# Server Functions and Actions

Scope: server-callable functions and action handlers, including private reads and mutations.

- Treat every Server Function/Action as a callable endpoint. Validate untrusted input at runtime; authenticate protected operations and authorize access to the specific resource on every invocation, including private reads. Public operations still need their own input and abuse controls.
- Do not rely on hidden form fields, client-side role checks, or page-level guards for authorization.
- Keep mutations small and explicit. Use a transaction when multiple durable changes must be atomic.
- Revalidate or update only the cache entries affected after a successful mutation.
- Return expected validation failures in a form the UI can render; avoid exposing internal errors, secrets, or stack traces.
- Configure any cross-origin action access narrowly and only when the deployment requires it.
