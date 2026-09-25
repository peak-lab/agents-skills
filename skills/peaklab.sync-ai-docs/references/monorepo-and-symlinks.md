# Instruction topology and migration

## Ownership and approvals

Project `AGENTS.md` is the canonical instruction source. An authorized sync migrates useful
content from project `CLAUDE.md` files and removes them; do not create replacement wrappers.
Shared project Markdown rules live in a real `.agents/rules/` directory.
Do not assume a user's global layout or a private topology guide exists.

| Existing state | Action during sync (audit only reports) |
|---|---|
| `AGENTS.md` exists, `CLAUDE.md` absent | Update AGENTS.md as needed; do not create CLAUDE.md |
| Only `CLAUDE.md` exists | Write its useful instructions into AGENTS.md at the same project/package scope, verify preservation, then remove CLAUDE.md |
| Both exist with compatible content | Merge unique useful instructions into AGENTS.md, remove duplication, verify, then remove CLAUDE.md |
| Both contradict each other | Ask only about unresolved material conflicts; preserve the source until resolved, and report this migration as blocked |
| CLAUDE.md is only an import wrapper | Verify its referenced content remains available through explicit AGENTS.md instructions, then remove the wrapper |
| CLAUDE.md is a symlink | Inspect the target read-only; preserve relevant instructions in a real in-scope AGENTS.md, then unlink only the project CLAUDE.md entry, never its target |
| CLAUDE.md is unreadable or its link/import cannot be resolved | Preserve it and report a blocked migration rather than deleting unverified instructions |
| Existing valid non-CLAUDE file/directory symlink | Resolve and verify its actual target; preserve unless a change was requested |
| Broken or unexpected non-CLAUDE symlink | Report the target and obtain approval before retargeting |
| Real rules directory where a link is desired | Compare contents and collisions; approval before migration or replacement |

Inventory root and nested project-owned `CLAUDE.md` files, including project `.claude/CLAUDE.md`
when present. Respect `--dirs`; exclude dependencies, generated output and unrelated fixtures.
`--root-rules-only` changes rule placement, not the scope of nested instructions. For a file under
`.claude/`, migrate to the containing project's AGENTS.md. Do not follow directory symlinks outside
the selected project, modify global instruction files or write through a symlinked AGENTS.md.
If its destination is unsafe, preserve the source and report the blocker.

Write and verify the destination before removing the source. Preserve useful host-only content
with explicit host labels. Convert relevant `@` imports into explicit read instructions with
correct relative links: AGENTS.md does not expand Claude imports. Rebase relative paths when
moving content, avoid self-imports, and update active project references to deleted files.
Historical records need not be rewritten. A second sync must not recreate CLAUDE.md or duplicate
migrated content. This migration is included in sync authorization, including `--no-rules`, and
does not need a separate routine approval; audit mode never writes or deletes files.

Creating a missing project-local `.claude/rules -> ../.agents/rules` is a normal part of
authorized Claude rules setup. Do not create it when no rules were generated or Claude was
not selected. Never write through a link to global configuration. On platforms without
symlink support, keep explicit rule-reading instructions in `AGENTS.md`;
report that this does not establish automatic Claude loading or native path scoping.

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
