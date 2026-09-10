---
name: to-tickets
description: Break an approved plan or specification into independently verifiable vertical-slice tickets with explicit blockers. Use when work needs parallelizable, trackable execution.
disable-model-invocation: true
---

# To Tickets

Turn a plan into a dependency-aware delivery queue without losing end-to-end ownership.

1. Read the source plan, specification, related issue, and relevant glossary/ADRs.
2. Identify any prefactoring that makes the intended change easier and sequence it first.
3. Create tracer-bullet tickets: each one delivers a narrow but complete, demonstrable behavior across the layers it needs.
4. For every ticket, declare only the blockers that genuinely gate its start. Tickets with no blockers form the immediately actionable frontier.
5. Present the breakdown for approval before creating external issues or changing tracker state.

Do not split ordinary work horizontally into separate database, API, UI, and test tickets. The exception is a broad mechanical refactor whose blast radius cannot stay green in vertical slices: sequence it as expand, migrate in bounded batches, then contract, keeping compatibility until migration is complete.

Each ticket must include:

```markdown
## What to build

## Acceptance criteria

## Blocked by
```

Describe observable behavior rather than a file-by-file implementation recipe. Keep tickets small enough for one fresh implementation session and publish them in dependency order using the project's configured tracker workflow.
