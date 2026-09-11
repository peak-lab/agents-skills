---
paths:
  - "**/*.py"
---

# SQLAlchemy Rules

Scope: `**/*.py` files that use SQLAlchemy

## Match the installed SQLAlchemy generation

Check the declared SQLAlchemy version and existing repository style before changing queries. In SQLAlchemy 2.x code, construct ORM queries with `select()` and execute them through `Session.execute()`, `Session.scalar()`, or `Session.scalars()` as appropriate. Do not introduce the legacy `Query` API into modern code.

```python
stmt = select(User).where(User.id == user_id)
user = session.scalar(stmt)
```

## Scope sessions to one unit of work

Create sessions through the application's configured factory or dependency. Keep each `Session` or `AsyncSession` local to one request, task, command, or explicit unit of work; never share one across threads or concurrent asyncio tasks.

Use context management so connections and transactional state are released on success and failure. Make the transaction owner explicit. Lower-level helpers should not commit unexpectedly when the caller owns a larger transaction, while a documented unit-of-work boundary may commit by design.

## Make loading intentional

Choose relationship loading from the access pattern:

- use `selectinload()` when related collections will be accessed across multiple parents;
- use `joinedload()` where a join is appropriate and result semantics are understood;
- leave relationships unloaded when they are not needed.

Do not demand eager loading for every relationship. Prevent accidental N+1 queries in loops and avoid implicit I/O in async code.

## Preserve database semantics

Use bound parameters or SQLAlchemy expressions rather than interpolated SQL. Review cascades, delete behavior, server defaults, uniqueness, and transaction isolation when changing persistence logic. Pair mapped-model changes with the project's migration workflow and test both database constraints and application behavior.
