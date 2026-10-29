---
name: clean-code
description: "Assess maintainability or apply requested clean-code improvements. Use review-code for a patch and refactor for a defined transformation."
effort: standard
argument-hint: "[-a] [-e] [-s] [-r <id>] [--react] [--nextjs] [--zustand] [--query] <feature/file>"
---

# Clean code

Find maintainability problems that matter in the requested scope. An audit is read-only,
including with `-a`; apply corrections only when the request authorizes changes.

## Options

| Flag | Effect |
|---|---|
| `-a` | Skip routine checkpoints for authorized corrections; never resolve missing product intent by guessing. |
| `-e` | Work directly, without subagents. |
| `-s` | Save resumable evidence in the host task directory under `clean-code/{task_id}/`. |
| `-r <id>` | Resume from `clean-code/{id}*/00-context.md`; verify scope and evidence before reuse. |
| `--react`, `--nextjs`, `--zustand`, `--query` | Include the named technology in the analysis; these flags do not authorize installing it. |

The remaining input is the scope; derive a task ID only when saving or resuming needs one.

## Inspect and decide

Read applicable instructions, manifests, configuration, affected code and callers. Record existing
working-tree and staged changes; preserve their contents and leave the index untouched.

Report actionable problems with `file:line`, consequence and the smallest useful correction.
Separate defects from optional preferences. Missing tools, libraries or abstractions are not
automatically problems. Check version-specific advice against project configuration and current
official documentation when needed: for example, do not remove React memoization on an assumption
that the compiler is enabled, or replace working fetching solely to introduce TanStack Query.

For an audit, return findings and stop. For changes, reuse the caller's approved selection. Otherwise,
without `-a`, present the proposed corrections once for selection before editing. Ask again only
when a material scope or behavior decision changes. Delegate bounded independent questions only
when they have a clear benefit and `-e` is absent; no particular agent or quota is required.

## Apply and verify

Keep behavior and public contracts stable. Follow existing project conventions; introducing a
dependency, replacing a state-management approach or changing cache/retry behavior requires a
demonstrated need within the authorized scope. Use the repository's package manager and lockfile.

Run affected tests and repository-required checks discovered from its instructions and scripts.
Report failed or unavailable checks without claiming completion; investigate supported causes
and stop if progress needs missing intent or access. Do not create a generic fix-until-green loop.

Summarize corrections, preserved behavior and validation. With `-s`, persist `00-context.md`
(scope, selection, existing changes, progress, evidence and next step), `02-apply.md` and
`03-verify.md`; link existing evidence rather than duplicating it. Do not commit or push unless
requested. For an authorized commit, never include pre-existing staged work or unrelated hunks;
if the initial index was non-empty, leave it untouched and report the changes as uncommitted.
