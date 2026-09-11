---
paths:
  - "**/*"
---

# Redis Rules

Scope: all files when Redis is part of the project

## Define key ownership and lifetime

Use a documented, collision-resistant key namespace that includes the application or environment when Redis is shared. Include tenant or authorization scope where isolation depends on it. Do not put secrets or unnecessary personal data in keys, because keys can appear in diagnostics.

Set an expiration for caches, sessions, locks, rate limits, and transient job state. Persistent keys are allowed only when persistence is intentional and their deletion or archival lifecycle is owned. Choose TTLs from product and operational requirements rather than a universal table of values.

## Use the right data and delivery model

Use the client library's supported serializer and validate decoded data. JSON is useful for interoperable structured values but is not mandatory for counters, sets, hashes, or opaque binary values.

Redis Pub/Sub is ephemeral and provides at-most-once delivery. Use Streams or a durable primary store when consumers must recover missed events. Give subscription consumers dedicated client state as required by the selected client and protocol; do not assume a subscribed RESP2 connection can also serve ordinary commands.

## Manage connections centrally

Reuse bounded client pools or application-owned clients. Do not create a new network connection per request. Close clients during process shutdown and give each concurrent Pub/Sub consumer the isolation required by its library.

## Degrade intentionally

Classify each Redis dependency:

- cache failures may fall back to the source of truth;
- lock, rate-limit, session, queue, and authorization failures are not automatically safe to ignore;
- malformed cached data should be invalidated or surfaced according to policy, not silently treated as every kind of cache miss.

Use bounded timeouts and retries. Never log connection URLs, credentials, session values, or raw sensitive payloads.
