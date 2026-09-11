---
paths:
  - "**/*"
---

# Stripe Rules

Scope: all files when Stripe is part of the project

## Represent money exactly

Send integer amounts in the currency's smallest unit as required by the Stripe API and store the currency beside the amount. Do not assume every currency has two decimal places or call every minor unit a cent. Avoid binary floating-point arithmetic for monetary calculations.

Prefer configured Price identifiers for catalog products. When inline price data is intentional, validate currency, amount, tax behavior, and quantity at a trusted server boundary.

## Treat webhooks as untrusted, repeatable input

Verify the `Stripe-Signature` against the exact raw request body using the endpoint's webhook secret before parsing or acting on the event. Reject unverifiable requests without exposing secret or payload details.

Stripe may retry events and does not guarantee that related events arrive in business order. Record the event identifier behind a uniqueness constraint or equivalent durable deduplication mechanism, and make each transition idempotent. Retrieve current Stripe state when event order matters.

Return success only after the durable work required by the handler has completed or been safely enqueued. Keep slow, retryable work out of the request path when the architecture provides a durable queue.

## Keep fulfillment server-side

Do not grant access, mark an order paid, or fulfill a purchase solely from a browser redirect. Use verified server-side state and the event types required by the product's payment or subscription model. Consult the installed Stripe API version for current event fields and status values rather than encoding an assumed universal lifecycle.

## Isolate credentials and modes

Keep test and live keys, webhook secrets, customers, prices, and data separated. Never expose secret keys to client code or logs. Use restricted keys where suitable and preserve the project's authorization checks around customer and subscription identifiers.
