---
paths:
  - "**/*.py"
---

# ARQ Rules

Scope: `**/*.py` files that enqueue or execute ARQ jobs

## Design for retries and duplicate execution

Assume a job can run more than once whenever retries, cancellation, pessimistic execution, or worker recovery are enabled. Make externally visible work idempotent with a database constraint, state transition, provider idempotency key, or other durable guard. An in-memory flag is not sufficient across workers.

Use a stable job identifier only when duplicate enqueue suppression matches the product requirement. Define what should happen after that identifier's result expires.

## Pass durable references

Pass small values supported by the project's configured ARQ serializer, normally identifiers and immutable parameters. Do not pass live ORM entities, open connections, request objects, or credentials. Load current authoritative state inside the job.

Do not claim that ARQ universally serializes jobs as JSON; its behavior depends on the installed version and configured serializer.

## Bound execution

Set job timeouts, retry counts, retry delays, and expiration according to the installed ARQ version and the operation's service limits. Use the exact option names supported by that version rather than copying an example blindly.

Retry transient failures only. Surface permanent validation, authorization, and configuration errors without a futile retry loop. Ensure cancellation and timeout paths release resources and leave durable state recoverable.

## Own worker resources and deployments

Create shared clients in worker startup hooks and close them in shutdown hooks. Keep database sessions scoped to one job or unit of work.

Coordinate producer and worker deployments when changing job names or payloads. During rolling deployments, keep payloads backward-compatible or deploy consumers before producers. Verify the worker has registered the expected functions before enabling new enqueue paths.
