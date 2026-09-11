# Rules Generation — Templates, Detection, Format

The catalogue is bundled in `../assets/templates/`, relative to this reference. It travels with
the installed skill. Do not read or modify global templates unless separately requested.
The mapping below suggests candidates; validate actual version and code usage before selection.
A dependency alone does not justify every rule, nor permission to change application code.

## Template → rule mapping

JavaScript/TypeScript (from `package.json` deps):

| Detected | Template | Output file |
|---|---|---|
| `better-auth` | `validation-auth/better-auth.md` | `better-auth.md` |
| `prisma` | `data/prisma.md` | `prisma.md` |
| `@biomejs/biome` (no eslint) | `patterns/biome.md` | `biome.md` |
| `next` (App Router) | `frameworks/nextjs-app-router.md` | `nextjs-app-router.md` |
| server actions dir found | `patterns/server-actions.md` | `server-actions.md` |
| `zod` | `validation-auth/zod.md` | `zod.md` |
| `@tanstack/react-query` | `frontend/tanstack-query.md` | `tanstack-query.md` |
| `tailwindcss` v4 (PostCSS, Vite or CLI integration) | `frontend/tailwind-v4.md` | `tailwind-v4.md` |
| `resend` | `data/resend.md` | `resend.md` |
| `stripe` | `data/stripe.md` | `stripe.md` |
| `zustand` | `frontend/zustand.md` | `zustand.md` |
| `next-intl` | `frontend/next-intl.md` | `next-intl.md` |
| `hono` / `@mastra/core` | `frameworks/hono-mastra.md` | `hono-mastra.md` |
| `ioredis` / `redis` | `data/redis.md` | `redis.md` |
| `vitest` | `testing/vitest.md` | `vitest.md` |
| `components.json` (shadcn) | `frontend/shadcn-ui.md` | `shadcn-ui.md` |
| `typescript` | `languages/typescript.md` | `typescript.md` |

Python (from `pyproject.toml` `[project].dependencies` / `requirements.txt`):

| Detected | Template | Output file |
|---|---|---|
| `fastapi` | `frameworks/fastapi.md` | `fastapi.md` |
| `sqlalchemy` | `data/sqlalchemy.md` | `sqlalchemy.md` |
| `alembic` | `data/alembic.md` | `alembic.md` |
| `arq` | `infra/arq.md` | `arq.md` |
| `celery` | `infra/celery.md` | `celery.md` |
| `jinja2` | `frontend/jinja.md` | `jinja.md` |
| `pytest` | `testing/pytest.md` | `pytest.md` |
| `redis` | `data/redis.md` | `redis.md` |
| any Python project | `languages/python.md` | `python.md` |

Other:

| Detected | Template | Output file |
|---|---|---|
| `symfony/*` in composer.json | `frameworks/symfony.md` | `symfony.md` |
| `composer.json` present | `languages/php.md` | `php.md` |
| `Dockerfile` / compose file | `infra/docker.md` | `docker.md` |
| `use-cases/`+`gateways/`+`domain/` in src | `patterns/clean-architecture.md` | `clean-architecture.md` |
| `tenantId`/`organizationId` in schema | `patterns/multi-tenant.md` | `multi-tenant.md` |

Read selected templates completely. Skip irrelevant rules and language guidance already covered
by project instructions. For an unsupported stack, use only evidenced project conventions and
report the gap; do not force the closest framework template.

## Render and regenerate

Bun 1.3+ can run the bundled TypeScript helper without a build or dependency installation.
Resolve `SKILL_ROOT` to the real installed skill directory; it is not the project root.

```bash
bun "$SKILL_ROOT/scripts/render-rule.ts" --list
bun "$SKILL_ROOT/scripts/render-rule.ts" --template languages/typescript
bun "$SKILL_ROOT/scripts/render-rule.ts" --template languages/typescript --path 'src/**/*.ts' --path 'tests/**/*.ts'
```

The renderer prints Markdown to stdout, never writes or installs anything. `--path` replaces
both YAML paths and the readable Scope line for a scoped template. It rejects path overrides
for unscoped security templates. Unknown IDs/flags fail. Without Bun, read the asset directly
and adapt it with the same review process.

For each selected rule:

1. Read the existing destination and resolve all parent/link targets. Do not write through
   global or unexpected symlinks.
2. Compare the template with the current rule and the project's actual configuration.
3. Adapt paths, version-dependent guidance and examples to observed conventions. Preserve
   security invariants and useful local additions; explain substantive changes.
4. Apply a reviewed patch to `.agents/rules/<template-basename>.md`. Check filename collisions.
   Existing content has no implicit overwrite permission merely because regeneration was requested.
5. Record template ID and selected scopes in the project maintenance documentation. A second
   render with the same inputs must produce the same candidate. Local adaptations remain reviewed
   project content, not something a future renderer should discard.

Do not automatically delete deselected rules or change the repository's framework/runtime.
Review stale candidates separately. Never write every catalogue rule into every project.

## Scope and loading

Tech templates carry Claude `paths:` metadata plus a human-readable `Scope:` line. The latter
is descriptive, not executable scoping. Use real project globs and verify representative files
match. Better Auth, multi-tenant and server-action security templates remain unscoped when
selected. Keep critical invariants directly in always-read project instructions as well.

Add an explicit rule-reading instruction in `AGENTS.md` for each applicable rule, using a
relative Markdown link and the condition under which it must be read. This is a deliberate agent
read, not automatic Markdown expansion. Claude can import the common instructions via
`CLAUDE.md`; native path-scoped loading uses `.claude/rules` when configured.

Use [topology and migration policy](monorepo-and-symlinks.md) before wiring links or migrating
files. Never create `.codex/rules` symlinks as a substitute for instruction discovery; Codex
execution policies are unrelated to these Markdown templates.
