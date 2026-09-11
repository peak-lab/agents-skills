---
name: apex
description: Use when implementing a non-trivial feature, bug fix, or code change that benefits from an analyze-plan-execute-verify workflow, optional delegation, and explicit delivery controls.
effort: standard
argument-hint: "[--no-auto] [--no-tdd] [-x] [-s] [-b] [-pr] [-i] [-k] [-m] [-e] [-r TASK_ID] TASK_DESCRIPTION"
---

<overview>
APEX turns a requested code change into a scoped, verified patch. Reuse trustworthy context and artifacts supplied by the caller; perform only the missing work.
</overview>

<constraints>
- Preserve the user's scope and existing worktree changes. Never revert unrelated changes.
- Resolve material product ambiguity before editing. Decide ordinary implementation details from repository evidence.
- Use one canonical plan/task state. Do not copy the same plan into task files, todos, and logs.
- Prefer direct inspection and implementation. Delegate only independent work with a clear latency or context benefit.
- Never commit, push, or create a pull request unless `-pr`/`--pull-request` was explicitly supplied.
- Evidence is reusable only while the code and configuration it covers are unchanged. In non-auto mode, plan approval is separate evidence tied to the current plan revision.
- Clean up any workers created by this workflow on every terminal path.
- Before any completed, blocked, cancelled, `needs_planning`, `needs_clarification`, or `needs_confirmation` terminal response, load `step-09-finish.md`.
</constraints>

<flags>

| Enable | Disable | Meaning |
|---|---|---|
| `-a`, `--auto` | `-A`, `--no-auto` | Proceed without routine approval pauses. Default: enabled. |
| `-x`, `--examine` | `-X`, `--no-examine` | Run an additional risk-based review. Default: disabled. |
| `-s`, `--save` | `-S`, `--no-save` | Retain expanded resumable evidence in the canonical task artifact. Default: disabled. |
| `-t`, `--test` | `-T`, `--no-test` | Include appropriate automated tests. Default: enabled; `-T` disables every APEX test-writing and TDD phase. Repository-mandated checks still apply. |
| `-d`, `--tdd` | `-D`, `--no-tdd` | Force or disable strict RED-GREEN-REFACTOR. Default: adaptive. |
| `-e`, `--economy` | `-E`, `--no-economy` | Disable nested delegation. Verification is unchanged. |
| `-b`, `--branch` | `-B`, `--no-branch` | Prepare a task branch. Default: disabled. |
| `-pr`, `--pull-request` | `-PR`, `--no-pull-request` | Commit, push, and open a PR after verification; enables branch mode. |
| `-k`, `--tasks` | `-K`, `--no-tasks` | Add dependency-aware vertical slices to the canonical plan. |
| `-m`, `--teams` | `-M`, `--no-teams` | Delegate independent plan slices; enables task mode. |
| `-i`, `--interactive` | — | Ask once for configuration overrides. |
| `-r`, `--resume TASK_ID` | — | Resume modern state or a legacy `.claude/output/apex/` task. |

Reject conflicting enable/disable pairs. `-d` implies tests and conflicts with `-T`. `-D` disables only strict TDD, not testing. `-T` dominates adaptive and non-TDD test creation. Explicit flags override defaults regardless of order.
</flags>

<workflow>
1. Read `steps/step-00-init.md`.
2. Load only the next step selected by the current state.
3. Treat caller-supplied issue analysis, plans, test evidence, and task state as candidates for reuse; verify freshness instead of reproducing them.
4. If analysis determines the work is not yet implementation-ready, or required user intent is unavailable, set status `needs_planning` or `needs_clarification` and route directly to Finish for cleanup.
</workflow>

<compatibility>
Legacy step filenames, flags, templates, scripts, and `.claude/output/apex/` resume directories remain supported. They are read-only compatibility surfaces for modern runs, not mandatory work.
</compatibility>
