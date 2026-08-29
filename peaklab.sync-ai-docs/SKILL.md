---
name: "peaklab.sync-ai-docs"
description: Use when syncing or unifying AI documentation across AGENTS.md files, Codex rules, Claude compatibility context, project guides, and shared agent assets after a project has evolved.
effort: high
disable-model-invocation: true
allowed-tools: "Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(mkdir:*), Bash(ln:*), Bash(mv:*), Bash(rmdir:*), Bash(readlink:*), Bash(python3:*), Bash(test:*), Bash(diff:*), Read, Write, Edit, Glob, Grep, Agent"
argument-hint: "[--commit] [--dirs <dir1,dir2,...>] [--no-rules] [--root-rules-only] [--sync-symlinks]"
---

<objective>
Keep AI-facing project documentation accurate, deduplicated, and useful by syncing it with the actual
current state of the project, with maximum Claude Code + Codex compatibility.

1. Audit what the project actually uses today (packages, auth, DB, deployment, linting)
2. Update the canonical root `AGENTS.md` + targeted per-directory guides
3. Generate tech rules in `.agents/rules/` from `~/.agents/templates/` — single source for both agents
4. Monorepo: apply the same doc + rules model per sub-project (hybrid rules)
5. Audit/unify shared asset symlinks; optionally commit

## Compatibility model (Claude Code + Codex)

| Artifact | Canonical | Claude Code | Codex |
|---|---|---|---|
| Project instructions | `AGENTS.md` (real file) | `CLAUDE.md` = `@AGENTS.md` import | reads `AGENTS.md` natively |
| Tech rules | `.agents/rules/*.md` | `.claude/rules -> ../.agents/rules` | `.codex/rules -> ../.agents/rules` |
| Shared assets | `~/.agents/{skills,hooks,...}` | `.claude/* -> ../.agents/*` | `.codex/* -> ../.agents/*` |

- Claude Code does NOT read `AGENTS.md` natively — `CLAUDE.md` imports it (`@AGENTS.md`), optionally
  followed by Claude-only content. Files use `@import`/pointer (Windows-portable); directories use symlinks.
- Rules carry `paths:` frontmatter (Claude path-scoping — loaded only when touched files match) plus a
  human-readable `Scope:` line (Codex ignores frontmatter). Security-critical rules have NO `paths:`.
- Full target topology: `~/.agents/docs/ai-layout-reference.md`.

## AGENTS.md vs rules

| | AGENTS.md | .agents/rules/ |
|---|---|---|
| Loaded | working in that directory | always, or on matching `paths:` globs |
| Best for | directory context, API patterns, file lists | proactive "always do X when Y" behaviors |
| Example | "this dir holds server actions, auth guard required" | "when editing any server action, check the auth guard" |
</objective>

<context>
- Current branch: !`git branch --show-current`
- Root AGENTS.md: !`test -e AGENTS.md && ls -l AGENTS.md || echo "absent"`
- Root CLAUDE.md: !`test -e CLAUDE.md && { ls -ld CLAUDE.md; head -5 CLAUDE.md; } || echo "absent"`
- All AGENTS.md files: !`find . -name "AGENTS.md" -not -path "./node_modules/*" -not -path "./.next/*" | sort`
- Sub-projects: !`python3 -c "
import glob, os
SKIP = ('node_modules', '.venv', 'venv', '.git', '.next', 'dist', 'build', 'site-packages', '__pycache__', '.tox')
marks = ('package.json','pyproject.toml','composer.json','go.mod')
subs = set()
for m in marks:
    for f in glob.glob('**/'+m, recursive=True):
        d = os.path.dirname(f)
        if not d or any(s in f for s in SKIP): continue
        subs.add(d)
for d in sorted(subs):
    has = [n for n in ('CLAUDE.md','AGENTS.md','.claude/rules','.codex/rules','.agents/rules') if os.path.exists(os.path.join(d,n))]
    print(f'  {d}: {\", \".join(has) or \"no AI docs\"}')
" 2>/dev/null || echo "none"`
- Existing .agents/rules: !`ls .agents/rules/ 2>/dev/null || echo "none"`
- Rules symlinks: !`for d in .claude/rules .codex/rules; do test -L "$d" && echo "$d -> $(readlink "$d")" || { test -e "$d" && echo "$d (REAL dir — migrate to .agents/rules)" || echo "$d (absent)"; }; done`
- AI symlinks: !`find . -maxdepth 3 \( -path "./node_modules" -o -path "./.git" -o -path "./.next" \) -prune -o -type l -print -exec readlink {} \; | paste - - | sort`
- JS/TS stack: !`python3 -c "
import json, glob
SKIP = ('node_modules', '.next', 'dist', 'build', '.turbo', '.vercel', 'out', 'coverage', '.git', '.yarn', '.pnpm-store')
keys = ['next','react','typescript','prisma','better-auth','next-auth','@biomejs/biome','eslint','tailwindcss','zod','@tanstack/react-query','drizzle-orm','hono','@mastra/core','zustand','stripe','next-intl','resend','vitest','ioredis']
for f in sorted(glob.glob('**/package.json', recursive=True)):
    if any(s in f for s in SKIP): continue
    try:
        p = json.load(open(f))
        deps = {**p.get('dependencies',{}), **p.get('devDependencies',{})}
        hits = [f'{k}:{deps[k]}' for k in keys if k in deps]
        if hits: print(f'  {f}: {\", \".join(hits)}')
    except (json.JSONDecodeError, OSError) as e:
        print(f'  {f}: <unreadable: {e}>')
"`
- Python stack: !`python3 -c "
import glob, re, tomllib
SKIP = ('node_modules', '.venv', 'venv', '.tox', 'site-packages', '__pycache__')
keys = ['fastapi','sqlalchemy','alembic','arq','celery','jinja2','pytest','redis','django','flask','pydantic','httpx']
for f in sorted(glob.glob('**/pyproject.toml', recursive=True)):
    if any(s in f for s in SKIP): continue
    try:
        data = tomllib.load(open(f, 'rb'))
        deps = list(data.get('project', {}).get('dependencies', []))
        for g in data.get('dependency-groups', {}).values(): deps += [d for d in g if isinstance(d, str)]
        names = {re.split(r'[<>=\[~!; ]', d)[0].lower() for d in deps}
        hits = [k for k in keys if k in names]
        if hits: print(f'  {f}: {\", \".join(hits)}')
    except Exception as e:
        print(f'  {f}: <unreadable: {e}>')
for f in sorted(glob.glob('**/requirements.txt', recursive=True)):
    if any(s in f for s in SKIP): continue
    names = {re.split(r'[<>=\[~!; ]', l.strip())[0].lower() for l in open(f) if l.strip() and not l.startswith('#')}
    hits = [k for k in keys if k in names]
    if hits: print(f'  {f}: {\", \".join(hits)}')
" 2>/dev/null || echo "none"`
</context>

<arguments>
| Argument | Description | Default |
|----------|-------------|---------|
| `--commit` | Commit changes after sync | `false` (show diff only) |
| `--dirs <list>` | Comma-separated list of dirs to target | auto-detect |
| `--no-rules` | Skip `.agents/rules/` generation | `false` |
| `--root-rules-only` | Monorepo: keep all rules centralized at root | `false` (hybrid) |
| `--sync-symlinks` | Create/repair shared-asset dir symlinks (`.claude/{agents,hooks,skills,tasks}`, `.codex/{agents,tasks}`) | `false` (audit only) |
</arguments>

<workflow>

Detailed procedures live in `references/` — read the file when you reach its phase:

- `references/guides-content.md` — AGENTS.md structure, targeted guide candidates + content per directory
- `references/rules-generation.md` — template→rule mapping, detection, adaptation, format, wiring
- `references/monorepo-and-symlinks.md` — docs linking, sub-project hybrid rules, symlink policy, verification

## Phase 1: AUDIT

Goal: what the project actually uses today — not what old docs say.

1. Launch two Explore agents in parallel:
   - **Package audit**: deps from manifests, auth library, linter, ORM, framework versions, deploy hints
     (`.env*`, `vercel.json`, coolify config)
   - **Code pattern audit**: how auth is used server/client-side, where actions/routers live, env var
     validation, runtime constraints
2. Read existing root `AGENTS.md`; list stale claims (wrong lib, dead commands, outdated patterns)
3. Audit AI docs topology against the compatibility model (see context probes + layout reference);
   classify each `AGENTS.md`/`CLAUDE.md`/rules dir: conform | legacy stub | real dir to migrate | missing
4. Identify targeted-guide candidates → table (see `references/guides-content.md`)

## Phase 2: UPDATE ROOT AGENTS.md

`AGENTS.md` is the canonical file. Structure and update rules: `references/guides-content.md`.
Only update stale sections; concrete examples; document the why; keep scannable.
Ensure `CLAUDE.md` exists and imports it (`@AGENTS.md`) — flipping a legacy big-CLAUDE.md setup
requires approval (`references/monorepo-and-symlinks.md`).

## Phase 3: TARGETED GUIDES

Create/update per-directory `AGENTS.md` for each candidate from Phase 1.
Content guidelines per directory type: `references/guides-content.md`.

## Phase 4: RULES (skip if --no-rules)

Follow `references/rules-generation.md`:

1. `mkdir -p .agents/rules`; migrate any real `.claude/rules` / `.codex/rules` dir into it first
   (approval required to replace a non-empty real dir)
2. Detect technologies (context probes above) → copy matching templates from `~/.agents/templates/`,
   adapt import/dir paths only — never alter the rules or invent new ones
3. Preserve template `paths:` frontmatter + `Scope:` line; security rules stay unscoped
4. Wire `.claude/rules` + `.codex/rules -> ../.agents/rules` (always — not gated by `--sync-symlinks`)
5. Only create missing rule files; refresh stale ones

## Phase 4b: SUB-PROJECTS (monorepo only)

Follow `references/monorepo-and-symlinks.md`:

1. Per sub-project: canonical `AGENTS.md` + `CLAUDE.md` = `@AGENTS.md` (auto-detect current state;
   flips need approval)
2. Hybrid rules (skip if `--root-rules-only`): stack-specific rules in `<sub>/.agents/rules/`,
   cross-cutting rules stay at root, no duplication, no empty rule dirs
   - Distinct stack without template → derive rules from the sub-project's own documented conventions
3. Wire `<sub>/.claude/rules` + `<sub>/.codex/rules` symlinks

## Phase 5: SHARED ASSET SYMLINKS

Audit `.claude/{agents,hooks,skills,tasks}` and `.codex/{agents,tasks}` against `~/.agents` and report.
Create/repair only with `--sync-symlinks` or explicit ask. Full policy + safety rules:
`references/monorepo-and-symlinks.md`. Never replace real files/non-empty dirs without approval.

## Phase 6: VERIFY

1. No contradictions between root AGENTS.md and targeted guides
2. Code examples reference real paths: extract `@/...` and `from ...` imports from examples,
   `test -e` their resolved targets
3. Documented commands exist: compare against `package.json` scripts / Makefile / pyproject scripts
4. Stale info removed (replaced libraries leave no patterns behind)
5. Topology check: every `CLAUDE.md` imports or links its `AGENTS.md`; rules symlinks resolve;
   no broken symlinks; no cross-cutting rule duplicated into a sub-project; no empty rule dirs
   (verification commands: `references/monorepo-and-symlinks.md`)
6. After any doc flip/rename: no stale references to the old filename remain (grep `CLAUDE.md`
   links in README, shared docs, sibling sub-projects — see the flip procedure in
   `references/monorepo-and-symlinks.md`)

## Phase 7: COMMIT (only if --commit)

```bash
git add $(find . \( -name "AGENTS.md" -o -name "CLAUDE.md" \) -not -path "./node_modules/*" -not -path "./.next/*")
git add .agents/rules .claude/rules .codex/rules
find . -maxdepth 2 -name ".agents" -type d -not -path "./.agents" -exec git add {}/rules \; 2>/dev/null
git commit -m "docs: sync AI docs and unify .agents/rules with current project state"
```

Without `--commit`: show a summary and let the user commit.

</workflow>

<rules>
- Only document what the codebase actually does — no fictional patterns
- No duplication between root and targeted guides — targeted goes deep, root stays high-level
- No implementation details that belong in the code itself
- Keep guides short and scannable — section > 30 lines → split
- Code examples must be real patterns from the codebase
- Verify package versions from manifests, not from memory
- Rules content only from `~/.agents/templates/` or the project's own documented conventions
</rules>

<output>
On completion, display (adapt to what actually ran):

```
AI docs sync complete
─────────────────────────────
Root AGENTS.md: updated (N sections) — CLAUDE.md imports it

Targeted guides:
  ✓ <dir>/AGENTS.md — created/updated
  + N new guides

.agents/rules/ (single source, path-scoped):
  ✓ <tech>.md — <one-line what it enforces> [scoped: <globs> | always]
  ↳ .claude/rules + .codex/rules -> ../.agents/rules

Sub-projects:
  ✓ <sub> — AGENTS.md canonical, CLAUDE.md = @AGENTS.md; rules: <techs>
  ↳ each: .claude/rules + .codex/rules -> ../.agents/rules

Topology: no broken symlinks, no duplicated shared assets
Pending approvals: <legacy flips / real-dir migrations awaiting user>

Run: git diff --stat to review
```
</output>
