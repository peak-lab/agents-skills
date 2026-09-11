---
paths:
  - "**/*.prisma"
  - "**/prisma/**"
---

# Prisma Rules

Scope: `**/*.prisma`, `**/prisma/**`

## Follow the installed Prisma workflow

Check the installed Prisma major version, generator configuration, package manager, and repository scripts before suggesting commands or client APIs. Prisma workflows and generated-client APIs can differ substantially between major versions.

For a project with versioned migrations, every deployed schema change needs a reviewed migration. Use the repository's migration command in development and its deployment command in release environments. Do not substitute schema synchronization such as `db push` for migration history unless the project explicitly uses a disposable, non-migrated prototype database.

Review generated SQL for destructive operations, data backfills, constraints, indexes, and database-specific behavior before applying it.

## Protect query scope

Validate required identifiers before building read, update, or delete filters. Optional values must be handled according to the installed client's documented `null`, `undefined`, and omit/skip semantics; never assume an absent value remains a restrictive filter.

Apply extra scrutiny to bulk operations such as update-many and delete-many. Require an intentional filter or an explicit, reviewed full-table operation.

## Reuse the configured client

Use the project's generated client entrypoint and lifecycle abstraction. Do not add a second client instance when the application already owns one. Connection reuse and shutdown behavior must match the runtime: a long-lived server, serverless function, edge runtime, test process, and CLI may require different lifecycles.

## Preserve application policies

Follow schema-defined conventions for tenancy, soft deletion, audit fields, identifiers, and naming. Do not invent a `deleted` field or hard-delete policy from this template.

After a schema change, run the repository's generation, migration, type-check, and relevant test commands. Treat a generated client and a migration file as separate required artifacts when the project uses both.
