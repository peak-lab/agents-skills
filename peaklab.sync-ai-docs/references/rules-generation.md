# Rules Generation — Templates, Detection, Format

Single source: rules content comes from `~/.agents/templates/` — never invent rules on the fly.
Copy the template into `.agents/rules/`, then adapt paths only.

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
| `tailwindcss` v4 (`@tailwindcss/postcss`) | `frontend/tailwind-v4.md` | `tailwind-v4.md` |
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

Only create missing output files; update stale ones. Language templates (`typescript.md`, `python.md`,
`php.md`) are low-priority — skip when the project already has framework-level rules covering them,
to avoid rule bloat.

**No matching template?** A distinct stack with no template entry (e.g. an MCP/FastMCP server) still gets
rules — derive them from the project's already-documented conventions (its `AGENTS.md`/`CLAUDE.md`, README).
Only encode patterns the project already states. Consider promoting recurring derived rules into a new
template under `~/.agents/templates/`.

## Adapting a template to the project

- Replace placeholder import paths (`@/lib/auth`, `@/lib/prisma`) with the actual ones found
- Replace example directory paths with the actual ones
- Keep project conventions (e.g. French error messages)
- **Do NOT change the rules themselves** — only paths and file references

## Rule file format

Templates already follow it — preserve on copy:

```markdown
---
paths:
  - "prisma/**"
---
# <Technology> Rules

Scope: prisma/**

## Proactive Behavior

When <condition>, the agent must automatically <action>.

## <Rule Name>

<One-sentence rule.>

**Why**: <consequence — data loss, security hole, prod breakage.>

```typescript
// Correct pattern
```
```

- `paths:` frontmatter = Claude Code path-scoping (rule loads only when touched files match the globs).
  Codex ignores frontmatter — the `Scope:` body line keeps it readable there.
- Security-critical rules (better-auth, multi-tenant, server-actions) ship with NO `paths:` — always loaded.
  Never add scoping to them: a scoped auth rule that fails to load is a fail-open.

## Establish the single-source directory and wire symlinks

```bash
mkdir -p .agents/rules
```

If `.claude/rules` or `.codex/rules` exists as a **real directory**, migrate first (approval required to
replace a non-empty dir):

```bash
for f in .claude/rules/*.md; do [ -e "$f" ] && mv -n "$f" .agents/rules/; done
rmdir .claude/rules 2>/dev/null && ln -s ../.agents/rules .claude/rules
```

Then wire both agents (idempotent, ALWAYS part of rules generation — not gated by `--sync-symlinks`,
rules are unusable without the links):

```bash
for d in .claude/rules .codex/rules; do
  mkdir -p "$(dirname "$d")"
  if [ -L "$d" ]; then :;
  elif [ -e "$d" ]; then echo "REAL dir at $d — migrate then symlink";
  else ln -s ../.agents/rules "$d"; fi
done
```
