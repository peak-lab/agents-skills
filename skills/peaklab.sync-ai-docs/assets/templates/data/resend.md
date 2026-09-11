---
paths:
  - "**/*"
---

# Resend and Email Rules

Scope: all files when Resend or another email provider is part of the project

## Keep transport at the boundary

Use the project's email interface or provider adapter when one exists. Business logic should provide the message intent and data; provider credentials, retries, and environment-specific transport belong at the infrastructure boundary. Do not impose a particular local SMTP service or directory layout on projects that use another design.

Validate required configuration at startup and inject it into the adapter. Never print API keys, webhook secrets, SMTP credentials, or complete message bodies containing sensitive data.

## Send deliberately

- Send production mail from a domain verified for the active provider and environment.
- Keep test and production recipients and credentials isolated.
- Use a stable idempotency key for a retryable logical send when the provider and SDK support it.
- Treat API acceptance as `sent`, not proof of inbox delivery; process provider events when product behavior depends on delivery, bounce, or complaint state.
- Propagate or record provider errors with enough non-secret context to retry or investigate them.

## Secure webhooks

When handling email-provider webhooks, verify the signature using the exact request representation required by the installed SDK before trusting or parsing the event. Deduplicate retries using the provider event identifier and make state transitions idempotent.

Handle unknown event types safely. Do not assume a fixed event list remains exhaustive across provider versions.

## Protect recipient data

Minimize stored recipient data and retention. Avoid placing confidential values in subjects, tags, metadata, logs, or idempotency keys. Respect the project's consent, suppression, unsubscribe, and deletion policies.
