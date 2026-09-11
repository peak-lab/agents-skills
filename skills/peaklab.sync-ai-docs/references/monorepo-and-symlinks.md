# Instruction topology and migration

## Ownership and approvals

Project `AGENTS.md` is the preferred common source; `CLAUDE.md` may import it and retain
Claude-only additions. Shared project Markdown rules live in a real `.agents/rules/` directory.
Do not assume a user's global layout or a private topology guide exists.

| Existing state | Action |
|---|---|
| `AGENTS.md` exists, `CLAUDE.md` absent | During an authorized Claude setup, create a wrapper with `@AGENTS.md` |
| Only `CLAUDE.md` exists | Propose separating common and host-specific instructions; obtain approval before moving/replacing content |
| Both exist and differ | Preserve both; identify contradictions and propose a scoped merge |
| Both duplicate common content | Propose canonicalization; do not replace either without approval |
| Existing valid file/directory symlink | Resolve and verify its actual target; preserve unless a change was requested |
| Broken or unexpected symlink | Report the target and obtain approval before retargeting |
| Real rules directory where a link is desired | Compare contents and collisions; approval before migration or replacement |

Creating a missing project-local `.claude/rules -> ../.agents/rules` is a normal part of
authorized Claude rules setup. Do not create it when no rules were generated or Claude was
not selected. Never write through a link to global configuration. On platforms without
symlink support, keep explicit rule-reading instructions in `AGENTS.md`, imported by Claude;
report that this is not native automatic path scoping.

Codex loads `AGENTS.md` through its instruction discovery mechanism. `.codex/rules` contains
execution-policy files when configured; a Markdown symlink there is not a loading mechanism.
Do not change `.codex/config.toml`, `.rules` permission policies or Claude settings here.

## Monorepos

Use manifests plus build/deployment boundaries to identify real sub-projects. A fixture with a
package manifest is not automatically a sub-project. Respect `--dirs` and `--root-rules-only`.

Keep shared rules at root and distinct stack rules near their package. Each relevant `AGENTS.md`
explicitly routes to its applicable rule files with correct relative paths. Do not assume parent
instructions disappear merely because the current directory is a package; inspect host discovery
and the actual repository root. A package used outside this repository needs a self-contained
instruction setup; do not silently duplicate root rules everywhere to anticipate that scenario.

When linking Claude rules per package, use paths relative to that package and avoid repeating
the same cross-cutting rules at multiple levels. Never create empty rules directories.

## Shared assets

`--sync-symlinks` concerns only explicitly selected asset links. Resolve source and destination,
check that the selected host supports the asset format, and preserve real files and directories.
Do not symlink whole native agent directories across hosts with different definition formats.
Never link generated runtime state, provider settings, hooks or personal secrets by assumption.

## Verification after migration

Check file/link targets and content, root and nested instruction routes, name collisions, and
stale documentation links. Preserve historical records. Report filesystem validity separately
from actual host loading. Use Claude's `/memory` or an isolated Codex session to inspect loaded
instructions when available; do not claim this was tested merely because a link resolves.

Official references (checked 2026-09-11):

- [Codex instruction discovery](https://developers.openai.com/codex/guides/agents-md)
- [Codex execution rules](https://developers.openai.com/codex/rules)
- [Claude memory and path-scoped rules](https://code.claude.com/docs/en/memory)
