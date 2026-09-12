---
name: peaklab.sync-ai-docs
description: "Synchronize project instructions, AGENTS.md, Claude compatibility files and shared agent assets."
effort: deep
disable-model-invocation: true
argument-hint: "[--commit] [--dirs <dir1,dir2,...>] [--no-rules] [--root-rules-only] [--sync-symlinks]"
---

# Sync AI Documentation

Keep project instructions accurate and make applicable rules discoverable in the selected host.
Templates are bundled in `assets/templates/`; no personal template directory is required.

## Scope and modes

An audit is read-only. A sync/regeneration request permits scoped documentation edits, not
application changes, global installation, tracker updates or deployment. Preserve unrelated edits.
Bind the target project before reading or writing. Never follow a project rules symlink into
someone's home directory and regenerate its contents there.

| Flag | Behavior |
|---|---|
| `--commit` | Commit only the reviewed files changed by this invocation; default is no commit |
| `--dirs <list>` | Limit changes to selected directories; otherwise inspect relevant project boundaries |
| `--no-rules` | Update documentation without generating or wiring rules |
| `--root-rules-only` | Keep selected rules at the project root instead of per-package |
| `--sync-symlinks` | Also inspect and repair explicitly selected shared-asset directory links; default is audit only |

Replacing real files/directories with imports or links, changing a link's target, and moving
existing instruction ownership require approval. Do not modify provider settings or command
permission policies as part of Markdown rule generation.

## 1. Inspect the project

Read existing instructions and inspect tracked manifests, lockfiles, scripts and representative
source. Detect actual framework versions and conventions, not only package names. Ignore vendor,
build and dependency directories. Do not read `.env` values to discover a stack.

Inspect instruction files and link targets with read-only checks. Distinguish missing, valid,
divergent and stale content. Use separate package/code-pattern reviewers only when the scope
benefits from parallel inspection; a small project needs no fixed agent quota.

Summarize proposed changes and any required approvals. Reuse accurate project documentation;
do not impose a new architecture, runtime version, test framework or directory tree.

## 2. Update project guides

Read [guide content](references/guides-content.md). Keep shared project conventions in `AGENTS.md`
and add targeted guides only where they provide distinct local knowledge. Preserve existing
host-only content. For instruction migrations, monorepos or shared links, read
[topology and migration policy](references/monorepo-and-symlinks.md).

## 3. Regenerate applicable rules

Unless `--no-rules`, read [rules generation](references/rules-generation.md). Select templates
from the bundled catalogue using actual project evidence. Read each selected template, adapt
its scope and version-dependent details, and preserve useful project-specific additions.

The bundled [renderer](scripts/render-rule.ts) lists templates or prints one to stdout. It
does not write files, detect stacks or install configuration. Use ordinary reviewed file edits
to materialize the result. Missing Bun does not block manual reading/adaptation of the assets.

Do not overwrite a conflicting existing rule blindly. Explain intentional semantic changes;
remove stale generated rules only with a clear target and user authorization. Never bulk-copy
all templates into a project. Security invariants remain in always-read instructions, not only
an optional path-scoped reference.

## 4. Wire the selected host

- Codex: use root/nested `AGENTS.md`. Include an explicit instruction to read each applicable
  rule by relative path; a Markdown link or `Scope:` line is not automatic loading. Keep
  critical invariants directly in `AGENTS.md` when they must always be present.
- Claude Code: a new `CLAUDE.md` can import `@AGENTS.md`. For native path-scoped rules, a
  project-local `.claude/rules` link to `../.agents/rules` is supported; use the migration
  policy before changing an existing path. A documented read instruction is a portable fallback.
- Do not create `.codex/rules` links for Markdown loading. Codex execution `.rules` policies
  are a different feature and are outside this workflow.

## 5. Verify and report

Check selected templates exist after installation, generated paths match actual sources, guide
commands exist, local links resolve, and no private configuration or duplicate contradictory
rules were introduced. Re-run generation to check stable output. Verify host loading separately
when the host is available; filesystem checks alone do not prove instructions were loaded.

Report files changed, templates selected/skipped, meaningful rule changes, validation and any
remaining approval or loading checks. With `--commit`, inspect and stage explicit paths only;
never commit unrelated pre-existing edits or infer permission to push.
