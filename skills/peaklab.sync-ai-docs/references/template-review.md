# Template Review — 2026-10-29

All 30 existing templates were read and checked against the primary sources
below. Fourteen received targeted changes, sixteen were retained, and one React
TanStack Start template was added. These are concise decision rules, not full
framework manuals, vulnerability audits or dependency-upgrade instructions.
No upstream prose or third-party skill was copied into the templates.

## Version and Evidence Limits

- Check the target lockfile/configuration before selecting APIs. Current online
  documentation may describe a different release; a dependency declaration is
  not enough to establish supported behavior.
- The reference project uses Next 16.2.3, Prisma 7.8.0, Zod 4.3.6, Query v5 and
  Start 1.169.4. Start validator/import-protection guidance was also checked in
  its installed package sources. In this installation, `createServerFn` exposes
  `.validator(...)`; do not prescribe `.inputValidator(...)` from older examples.
  Context7 was consulted for Start, but versioned source remains authoritative
  where online examples differ.
- Sources below were read during the review. “Retained” means no actionable
  problem was found in the template's existing guidance, not exhaustive API
  compatibility certification. Recheck sources when changing dependent guidance.
- Static renderer/link checks establish file structure and deterministic output;
  they do not test host instruction loading or application runtime behavior.

## Frameworks, Server Boundaries and Validation

| Template | Decision | Primary sources and rationale |
| --- | --- | --- |
| `frameworks/tanstack-start` | Added | [Execution](https://tanstack.com/start/latest/docs/framework/react/guide/execution-model), [server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions), [import protection](https://tanstack.com/start/latest/docs/framework/react/guide/import-protection), [Query integration](https://tanstack.com/start/latest/docs/framework/react/guide/tanstack-query), [auth boundary](https://tanstack.com/start/latest/docs/framework/react/guide/authentication-server-primitives): isomorphic loaders, runtime validation, request isolation and bundling boundaries. |
| `frameworks/nextjs-app-router` | Updated | [Next 16 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-16), [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag): async request APIs, proxy limits and distinct invalidation behavior, without imposing Cache Components. |
| `patterns/server-actions` | Updated | [Start data boundaries](https://tanstack.com/start/latest/docs/framework/react/guide/authentication-server-primitives), [Next data security](https://nextjs.org/docs/app/guides/data-security): include private reads and distinguish intentionally public operations from protected endpoints. |
| `validation-auth/better-auth` | Updated | [Session management](https://better-auth.com/docs/concepts/session-management), [Next integration](https://better-auth.com/docs/integrations/next): cookie-cache revocation delay and server cookie-write integration. |
| `validation-auth/zod` | Updated | [Basics](https://zod.dev/basics), [schema APIs](https://zod.dev/api): async parsing, input/output distinction, error issues and explicit coercion/unknown-key policy. |
| `frameworks/fastapi` | Updated | [Concurrency](https://fastapi.tiangolo.com/async/), [lifespan](https://fastapi.tiangolo.com/advanced/events/): avoid blocking async handlers; clarify resource lifecycle. |
| `frameworks/symfony` | Retained | [Symfony Messenger](https://symfony.com/doc/current/messenger.html): existing DI, authorization and transaction/side-effect boundaries remain appropriate. |
| `frameworks/hono-mastra` | Retained | [Hono validation](https://hono.dev/docs/guides/validation), [Mastra authentication](https://mastra.ai/docs/auth/overview): validation and server protection remain applicable without assuming default auth. |

## Frontend and Languages

| Template | Decision | Primary sources and rationale |
| --- | --- | --- |
| `frontend/tanstack-query` | Updated | [SSR](https://tanstack.com/query/latest/docs/framework/react/guides/ssr), [defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates): per-request caches, identity changes and reconciliation. |
| `frontend/next-intl` | Updated | [Server/client components](https://next-intl.dev/docs/environments/server-client-components): hooks can work in non-async Server Components; async components need the awaitable API; client props must be serializable. |
| `frontend/tailwind-v4` | Updated | [Class detection](https://tailwindcss.com/docs/detecting-classes-in-source-files): full static utility strings and source registration for excluded packages. |
| `frontend/zustand` | Updated | [v5 migration](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md): selector output stability matters beyond selecting a small slice. |
| `frontend/shadcn-ui` | Retained | [Introduction](https://ui.shadcn.com/docs): application-owned accessible components and local customization remain appropriate. |
| `frontend/jinja` | Retained | [API](https://jinja.palletsprojects.com/en/stable/api/): explicit autoescaping and rendering boundaries remain appropriate. |
| `languages/typescript` | Retained | [Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html): boundary validation, narrowing and discriminated unions remain appropriate. |
| `languages/python` | Retained | [Logging](https://docs.python.org/3/library/logging.html): existing runtime-aware typing and parameterized logging guidance needs no version mandate. |
| `languages/php` | Retained | [Properties](https://www.php.net/manual/en/language.oop5.properties.php): readonly does not recursively freeze contained objects; preserve runtime qualification. |

## Persistence, Infrastructure and Testing

| Template | Decision | Primary sources and rationale |
| --- | --- | --- |
| `data/prisma` | Retained | [Prisma 7 migration](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7): existing version-sensitive workflow, configured client and separate generation/migration requirements remain sound. |
| `data/sqlalchemy` | Updated | [2.x ORM results](https://docs.sqlalchemy.org/en/20/changelog/migration_20.html#orm-rows-not-uniquified-by-default): collection joined eager loads require explicit `Result.unique()`. |
| `data/alembic` | Retained | [Autogeneration](https://alembic.sqlalchemy.org/en/latest/autogenerate.html): existing review and migration graph safeguards cover known limitations. |
| `data/redis` | Retained | [Pub/Sub](https://redis.io/docs/latest/develop/use-cases/pub-sub/), [Streams](https://redis.io/docs/latest/develop/data-types/stream/): existing delivery and connection qualifications avoid unsupported exactly-once guarantees. |
| `data/resend` | Updated | [Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys): provider retention is 24 hours; longer business deduplication needs durable application state. |
| `data/stripe` | Updated | [Idempotent requests](https://docs.stripe.com/api/idempotent_requests), [webhook duplicates](https://docs.stripe.com/webhooks#handle-duplicate-events): add outbound request idempotency while keeping business fulfillment server-authoritative. |
| `infra/arq` | Retained | [ARQ](https://arq-docs.helpmanual.io/): existing pessimistic execution, job ownership and duplicate handling remain appropriate. |
| `infra/celery` | Updated | [Worker time limits](https://docs.celeryq.dev/en/stable/userguide/workers.html#time-limits): limits depend on pool/platform and do not replace network timeouts. |
| `infra/docker` | Retained | [Build secrets](https://docs.docker.com/build/building/secrets/), [Compose build](https://docs.docker.com/reference/compose-file/build/): existing builder qualifications and secret-mount guidance remain appropriate. |
| `testing/vitest` | Retained | [Mocking](https://vitest.dev/guide/mocking): existing hoisting, async assertion and restoration guidance remains appropriate. |
| `testing/pytest` | Updated | [Fixture setup errors](https://docs.pytest.org/en/stable/how-to/fixtures.html#handling-errors-for-yield-fixture): post-yield teardown cannot clean up a setup failure before the yield. |
| `patterns/biome` | Retained | [Configuration](https://biomejs.dev/configuration/configure-biome/): existing repository-owned configuration and justified exclusions remain appropriate. |
| `patterns/clean-architecture` | Retained | [Original dependency rule](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html): preserve dependency direction only where the architecture actually exists. |
| `patterns/multi-tenant` | Retained | [OWASP multi-tenant guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html): existing server-owned scope and negative access checks remain appropriate. |
