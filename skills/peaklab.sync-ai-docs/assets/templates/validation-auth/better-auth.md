# Better Auth

Scope: authentication configuration and server-side session handling.

- Use Better Auth's supported server integration for the installed version; keep secrets and provider configuration server-side.
- Configure trusted origins narrowly for every deployed first-party origin. Do not accept arbitrary origins or infer trust from a client-supplied header.
- Verify the session and enforce authorization in each sensitive server operation; UI gating and a valid session alone are not sufficient permission checks.
- Use secure cookie and transport settings appropriate to the deployment, and rotate or revoke sessions through supported mechanisms when accounts or privileges change.
- Validate callback URLs and redirect targets against an allowlist to prevent open redirects.
- A cookie's presence is only an optimistic UI signal. Resolve and validate sessions through the server API. If cookie caching is enabled, account for its revocation delay; use the installed version's cache-bypass option for operations requiring current session validity and load current resource permissions server-side.
- For Next.js Server Actions that set auth cookies, preserve the supported `nextCookies()` integration and its required plugin order. Do not assume a Server Component can perform session-refresh cookie writes.
