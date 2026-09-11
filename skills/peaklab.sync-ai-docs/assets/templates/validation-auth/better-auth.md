# Better Auth

Scope: authentication configuration and server-side session handling.

- Use Better Auth's supported server integration for the installed version; keep secrets and provider configuration server-side.
- Configure trusted origins narrowly for every deployed first-party origin. Do not accept arbitrary origins or infer trust from a client-supplied header.
- Verify the session and enforce authorization in each sensitive server operation; UI gating and a valid session alone are not sufficient permission checks.
- Use secure cookie and transport settings appropriate to the deployment, and rotate or revoke sessions through supported mechanisms when accounts or privileges change.
- Validate callback URLs and redirect targets against an allowlist to prevent open redirects.
