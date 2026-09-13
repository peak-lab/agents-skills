---
name: optimize-prisma-query
description: Audit Prisma queries for unnecessary fetched data and replace broad includes with suitable select projections.
effort: standard
allowed-tools: "Bash(rg:*), Bash(pnpm:*), Read, Grep, Glob, Write"
argument-hint: "[path-or-scope] [--report-only]"
---

# Optimize Prisma Queries

Audit Prisma queries for over-fetching, unused relation includes and avoidable N+1 patterns.
Report findings by default; change queries only when the user explicitly asks for fixes.

## Inspect

Search the requested scope for `prisma.`, `findMany`, `findUnique`, `findFirst`, `include` and
`select`. Group results by production path before inspecting tests or fixtures. Prioritize API
handlers, server actions, repositories and frequently rendered lists.

For each query, trace the returned fields into callers, serialization and UI props. Record the
query location, fields actually read, broad nested relations, call frequency and any data that must
remain available.

## Recommend

For each actionable finding, give the current shape, a minimal `select` projection, the expected
benefit, behavior risk and the validation required. Do not replace `include` blindly: a relation
may be used by serialization or a later caller. Classify priority as high, medium or low.

## Apply only when requested

Keep the returned behavior and types correct. Change the smallest query surface, then run the
targeted tests and type checks for the touched package. Report the commands and results.

## Completion criteria

- Every recommendation cites an exact query and observed downstream use.
- High-priority findings show before/after query examples.
- Applied changes preserve required relation data and type correctness.
