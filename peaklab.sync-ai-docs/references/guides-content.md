# AGENTS.md Content — Root Structure & Targeted Guides

## Root AGENTS.md structure

```markdown
# AGENTS.md

## Project Overview
[What the app does — 2-3 sentences]

**Tech Stack:**
- [Actual packages and versions from package.json / pyproject.toml]

## Development Commands
[Commands that actually work today]

## Architecture
[Structure, key directories]

## Authentication
[Which library, server pattern, client pattern, signout pattern]

## Important Patterns & Conventions
[Breaking changes, form validation, data fetching, etc.]

## Common Issues
[Real gotchas encountered]
```

Update rules:

1. Only update what's wrong — don't rewrite accurate sections
2. Concrete code examples — patterns without examples are forgotten
3. Document the "why" behind non-obvious rules
4. Keep it scannable — read at the start of a task

## Targeted guide candidates

High-value directories (check which exist without an AGENTS.md):

- `app/actions/` / `src/actions/` — security-critical: auth guards
- `src/lib/` / `lib/` — what's importable where
- `app/api/` — route patterns, runtime constraints
- `prisma/` — migration rules, schema notes
- `src/components/` / `components/` — component conventions
- `src/contexts/` — providers, context vs server fetch
- `app/(private)/` — protected route conventions
- `src/query/` — data fetching patterns

Python equivalents: `app/routers/`, `app/services/`, `app/models/`, `alembic/`, `templates/`.

Output a table: Directory | Has AGENTS.md | Value | Action.

## Targeted guide template

```markdown
# <Directory Name>

[One-sentence purpose]

## <Pattern Name>

[Rule + concrete code example]
```

## Content guidelines per directory type

**actions/**: auth guard pattern (MUST precede try block and any ORM call — `userId: undefined`
bypasses filters silently); return type convention `{ success, data?, message? }`; list of action files.

**lib/**: what each file exports and where importable; server-only vs client-only; singletons
(prisma, auth); what NOT to import in client components.

**app/api/**: auth pattern for route handlers; runtime constraint (Node.js required for auth, no edge);
cron route protection.

**prisma/ or alembic/**: never `db push` in prod / always review autogenerate; naming convention;
schema notes (soft delete, table ownership).

**contexts/**: what each context provides; context vs server-side fetch; no server-only imports.

**components/**: client vs server conventions; UI library, icon library; shared patterns.

**routers/services (FastAPI)**: dependency injection patterns; response models; where transactions
are owned; background job enqueue patterns.
