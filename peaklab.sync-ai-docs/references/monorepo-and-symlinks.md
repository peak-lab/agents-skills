# Monorepo, Docs Linking & Symlink Policy

Canonical target topology: `~/.agents/docs/ai-layout-reference.md`.

## Link policy — one decision table

| Action | When it runs | Approval needed |
|---|---|---|
| Create missing `CLAUDE.md` = `@AGENTS.md` (root + subs) | always, docs phase | no |
| Create missing `AGENTS.md` from existing `CLAUDE.md` content | always, docs phase | no |
| Flip legacy direction (big `CLAUDE.md` + stub `AGENTS.md`) | recommend; apply on approval | yes |
| `.claude/rules` + `.codex/rules -> ../.agents/rules` | always, rules phase | only to replace a real dir |
| `.claude/{agents,hooks,skills,tasks}`, `.codex/{agents,tasks}` -> `../.agents/*` | only with `--sync-symlinks` | yes if target is real/non-empty |

Absolute rules:

- Never replace a real file or non-empty directory with a symlink/import without explicit approval
- Repairing a broken symlink with a clear target is always safe
- Files use `@import`/pointer (Windows-portable); only directories use symlinks
- Never symlink generated folders (`.codex/output`, `.codex/data`) or provider config
  (`.codex/config.toml`, `.codex/hooks.json`, `.claude/settings*.json`)
- If the repo has no project-local `.agents/` yet, create the directory (real, not a symlink to
  `~/.agents`) — project rules are project content

## Docs linking — AGENTS.md canonical

`AGENTS.md` is the canonical real file (Codex + all agents.md-compatible tools read it natively).
`CLAUDE.md` is a real file whose first line imports it, with optional Claude-only additions:

```markdown
# CLAUDE.md

@AGENTS.md
```

Per sub-project, auto-detect the current state:

- `AGENTS.md` real, `CLAUDE.md` missing → create `CLAUDE.md` with `@AGENTS.md`
- `CLAUDE.md` real, `AGENTS.md` missing → move content to `AGENTS.md`, rewrite `CLAUDE.md` as `@AGENTS.md`
- both real and identical → keep `AGENTS.md`, rewrite `CLAUDE.md` as `@AGENTS.md`
- both real and different → check for the legacy stub pattern (tiny `AGENTS.md` pointing at `CLAUDE.md`):
  recommend the flip, apply only on approval. Genuinely divergent files: leave, report
- existing `CLAUDE.md -> AGENTS.md` symlink → leave (works; convert to `@import` only if Windows
  contributors are expected)

**After a flip, update stale references.** Moving content from `CLAUDE.md` to `AGENTS.md` breaks every
link pointing at the old file. Grep and fix them all:

```bash
grep -rn "<sub>/CLAUDE.md\|CLAUDE.md)" --include="*.md" . | grep -v node_modules
```

- doc links: `README.md`, shared docs (`.agents/docs/*`), other sub-projects' `AGENTS.md`
- structure trees inside the moved file itself (e.g. `└── CLAUDE.md` → list both files with roles)
- the moved file's own header: retitle `# CLAUDE.md` → `# AGENTS.md`, drop/generalize the
  "guidance to Claude Code" intro line
- skip historical archives (task folders, changelogs) — they describe the past

## Sub-projects — hybrid rules

A **sub-project** is independently buildable: own `package.json` / `pyproject.toml` / `composer.json` /
`go.mod`. It can be opened standalone as cwd, so root rules are out of scope there.

- Root `.agents/rules/` holds **cross-cutting** rules (git, infra, repo-wide conventions)
- Each sub-project with a distinct stack gets its own `<sub>/.agents/rules/` (stack rules only,
  adapted to its paths) + `<sub>/.claude/rules` and `<sub>/.codex/rules` symlinks
- Never copy cross-cutting rules into sub-projects
- A sub-project fully covered by root rules gets NO `.agents/rules` dir (no empty dirs)
- `--root-rules-only` forces everything at root instead. Claude-only alternative: nested rule subdirs
  at root with `paths: ["<sub>/**"]` — do NOT use it here, Codex would lose per-sub rules when opened
  standalone

Wiring (idempotent):

```bash
for sub in <sub1> <sub2>; do
  mkdir -p "$sub/.agents/rules"
  for d in "$sub/.claude/rules" "$sub/.codex/rules"; do
    mkdir -p "$(dirname "$d")"
    if [ -L "$d" ]; then :;
    elif [ -e "$d" ]; then echo "REAL dir at $d — migrate to $sub/.agents/rules then symlink";
    else ln -s ../.agents/rules "$d"; fi
  done
done
```

## Verification

```bash
# all symlinks + broken ones
find . -maxdepth 3 \( -path ./node_modules -o -path ./.git -o -path ./.next \) -prune -o -type l -print | sort
find . -maxdepth 3 -type l ! -exec test -e {} \; -print 2>/dev/null

# every CLAUDE.md resolves to AGENTS.md content (import or symlink)
for f in $(find . -maxdepth 2 -name CLAUDE.md -not -path "./node_modules/*"); do
  grep -q "@AGENTS.md" "$f" || test -L "$f" || echo "unlinked: $f"
done
```

## Windows caveat

Directory symlinks require `git config --global core.symlinks true` + Developer Mode (or Git as admin).
Without it, symlinks checkout as text files containing the target path. This is why files use `@import`
instead of symlinks. Document it in the project README/AGENTS.md when the repo relies on dir symlinks.
