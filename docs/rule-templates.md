# Shared rule templates

The 30 reviewed templates live inside
[`skills/peaklab.sync-ai-docs/assets/templates/`](../skills/peaklab.sync-ai-docs/assets/templates/).
Installing that skill includes the templates and renderer; no global template directory,
repository build or extra npm package is required. Existing personal templates are unchanged.

## Use in a project

Install `peaklab.sync-ai-docs`, then ask it to regenerate rules for the current project's actual
stack. It inspects existing instructions and code, selects relevant templates, proposes changes
and preserves local adaptations. It does not install all 30 rules or upgrade the project's stack.

From this source checkout, preview a rule with Bun 1.3+:

```bash
bun skills/peaklab.sync-ai-docs/scripts/render-rule.ts --list
bun skills/peaklab.sync-ai-docs/scripts/render-rule.ts --template languages/typescript
bun skills/peaklab.sync-ai-docs/scripts/render-rule.ts --template languages/typescript --path 'src/**/*.ts'
```

In an installed copy, use the script under the resolved skill directory instead. The renderer
prints to stdout only: review and apply its output with file-editing tools. This deliberately
avoids silently overwriting local rules or personal configuration. Without Bun, the skill can
read and adapt the same Markdown assets manually.

## This repository's generated rules

| Template | Output | Scope |
|---|---|---|
| `languages/typescript` | `.agents/rules/typescript.md` | All TypeScript/TSX source |
| `languages/python` | `.agents/rules/python.md` | All Python source |

These outputs use the templates' default scopes without local content overrides. No application
framework is detected here; Bun tests and Python unittest do not justify Vitest or pytest rules.
`bun test` checks that these generated files remain in sync and the copied skill runs independently.

`AGENTS.md` explicitly tells agents when to read each rule. `CLAUDE.md` imports the common
instructions, so this repository uses a symlink-free, explicit-read setup. It does not claim
native automatic Claude path-scoping. Other projects can use `.claude/rules` for that behavior.
Do not place Markdown rules in `.codex/rules` and assume they are discovered: Codex's execution
permission policies are separate from its `AGENTS.md` instructions.

## Audit decisions

The imported templates preserve operational invariants such as authorization, tenant isolation,
transaction ownership, bounded retries, migration review and secret handling. The audit removes
personal paths and replaces universal library/version/tool mandates with conditions grounded in
the target project. Paths and examples may be adapted; meaningful rule changes must be reviewed.

The local regeneration changes only this repository. Global templates, global rules and other
projects are not refreshed. Filesystem and renderer tests do not prove a host loaded a rule;
inspect an actual session's instruction sources when validating a team's host setup.

Host references checked 2026-09-11:

- [Codex AGENTS.md discovery](https://developers.openai.com/codex/guides/agents-md)
- [Codex execution policies](https://developers.openai.com/codex/rules)
- [Claude imports and rules](https://code.claude.com/docs/en/memory)

Representative technical checks used during the template audit:

- [Prisma null and undefined](https://docs.prisma.io/docs/orm/prisma-client/special-fields-and-types/null-and-undefined): omitted filters depend on configuration/version; reject missing authorization identity first.
- [Alembic autogeneration](https://alembic.sqlalchemy.org/en/latest/autogenerate.html): generated migrations require review, including operations autogeneration cannot infer.
- [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/): delivery semantics differ from durable job processing.
- [Next.js authentication](https://nextjs.org/docs/app/guides/authentication): protect data and mutation boundaries, not only UI visibility.
- [TanStack Query migration guidance](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5): match options and APIs to the installed major version.

The generic Codex skill validator rejects this catalogue's existing `effort`, `argument-hint`
and `disable-model-invocation` metadata. Installer discovery and repository validation pass;
that generic-validator mismatch is not reported as a successful validation.
