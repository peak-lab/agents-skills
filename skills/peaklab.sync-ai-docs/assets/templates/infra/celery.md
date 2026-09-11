---
paths:
  - "**/*.py"
---

# Celery Rules

Scope: `**/*.py` files that define, enqueue, or configure Celery tasks

## Define the task contract

Pass small, serializer-supported values such as identifiers and immutable parameters. Load current application state inside the task. Do not send ORM entities, request objects, secrets, or other process-local objects through the broker.

Use `bind=True` only when the task needs task context, retry APIs, request metadata, or progress state. It is not required for every Celery task.

## Make retry behavior explicit

Tasks that may be redelivered or retried must make external effects idempotent. Guard charges, emails, inserts, and state transitions with durable identifiers or constraints.

Retry only failures classified as transient. Set bounded retry count and backoff appropriate to the downstream service. Avoid `except Exception` followed by an unconditional retry, which can hide programming and validation errors.

Configure soft and hard execution limits with the option names supported by the installed Celery version. In task declarations these are commonly `soft_time_limit` and `time_limit`; project-wide settings may use different configuration keys. Leave enough time for the soft-limit handler to clean up before the hard limit terminates execution.

## Preserve delivery semantics

Review acknowledgements, visibility timeout, prefetch, worker-loss behavior, and broker-specific settings together. Acknowledging late can improve recovery but also increases duplicate execution, so it is safe only for idempotent tasks.

Route tasks to declared queues and ensure workers consume them. Treat broker choice, progress-event format, queue names, and monitoring tools as project configuration, not universal Celery rules.

## Deploy producers and workers compatibly

Keep task names and payloads compatible during rolling deploys, or deploy consumers before producers. Validate task registration and run representative retry and timeout cases with the project's test setup.
