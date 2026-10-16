---
name: clean-code
description: "Assess maintainability or apply requested clean-code improvements. Use review-code for a patch and refactor for a defined transformation."
effort: standard
argument-hint: "[-a] [-e] [-s] [-r <id>] [--react] [--nextjs] [--zustand] [--query] <feature/file>"
---

# Clean code

Scan a feature or file, apply clean-code improvements, then verify: `SCAN → APPLY → VERIFY`.

## Flags

| Flag | Effect |
|------|--------|
| `-a` | Auto mode: skip confirmations (`{auto_mode}`) |
| `-e` | Economy mode: no subagents, direct tools only (`{economy_mode}`) |
| `-s` | Save mode: write outputs to a host task-output directory under `clean-code/{task_id}/` (`{save_mode}`) |
| `-r <id>` | Resume: restore state from `clean-code/{id}*/00-context.md` in the host task-output directory and continue at the right step |
| `--react` / `--nextjs` / `--zustand` / `--query` | Force the matching rules below even if not detected |

Parse flags first; the remainder is `{task_description}`; derive a kebab-case `{task_id}`.

## 1. Scan (read-only)

- Do not modify files in this step.
- Run `git status --short` and `git diff --cached --name-only`; record already-staged paths in `{initial_staged_changes}`. Never modify the existing index during this workflow.
- Read `package.json` first to detect technologies (`{detected_tech}`).
- Economy mode: direct tools only. Otherwise launch 3 `explore-codebase` agents in one message: detect technologies, find anti-patterns in `{task_description}`, find good patterns to preserve.
- Report detected technologies and `{issues}` as `file:line | issue | priority`, distinguishing "missing" from "incorrectly used".
- Without `-a`, confirm with the user before applying.

## 2. Apply

Apply the rules for each detected or forced technology; do not invent other patterns:

- **Always**: no `any` (use `unknown`, generics or discriminated unions); remove stray `console.log`.
- **React** (`--react`): no manual `useMemo`/`useCallback`/`memo` (React Compiler); `ref` as prop instead of `forwardRef`; `useActionState` for form state; add error boundaries; server state → TanStack Query, global UI state → Zustand, local state → `useState`/`useReducer`.
- **Next.js** (`--nextjs`): default to Server Components, `'use client'` only where needed; add `loading.tsx` and `error.tsx`; `await` async `params`; Server Actions + `useActionState` for forms.
- **Zustand** (`--zustand`): client/UI state only, never server data; always subscribe through selectors, `useShallow` for several values; one store per domain; never in Server Components.
- **TanStack Query** (`--query`, or the project has no data-fetching library): replace `useEffect` fetching and `useState` server data with TanStack Query; per-request `QueryClient` on the server, singleton in the browser; defaults `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: false`; query key factories; invalidate after every mutation; prefer `useSuspenseQuery` under Suspense and `HydrationBoundary` for server prefetch; `maxPages` on infinite queries.

Then:

1. Present recommendations grouped High / Medium / Quick wins. Without `-a`, ask: **Apply all (recommended)** or **High priority only**.
2. If a recommendation needs a new library, use only the package manager declared by `packageManager` and its lockfile; never create a second lockfile.
3. Apply changes: sequentially in economy mode, otherwise parallel Snipper agents when 4+ files. Track `file | status | change`.
4. In save mode, write `02-apply.md`.

## 3. Verify

Use the repository's package manager and scripts from `package.json`; skip TypeScript checks for non-TypeScript projects. Loop fix → re-run until each passes:

1. Type check: the repository's type-check script, else local `tsc --noEmit` through the package manager.
2. `<package-manager> run lint` (use a documented lint-fix script only; never invent `--fix`).
3. `<package-manager> run build`. Never complete with a failing build.
4. `<package-manager> run test` when configured.

Summarize checks, before/after metrics and files changed; in save mode, write `03-verify.md`.

### Commit (ask first)

Ask: **Create commit (recommended)** or **Done**. If `{initial_staged_changes}` was non-empty, leave the index untouched, do not commit, and report the verified changes as uncommitted. Otherwise stage only files owned by this run (`git add -- <file>`, or `git add -p` for files with unrelated hunks), never `git add -A`; check `git diff --cached` contains exactly this run's hunks, then `git commit -m "refactor: apply clean code improvements"`.
