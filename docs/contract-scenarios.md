# Workflow contract scenarios

Run these when changing a flag, caller handoff or terminal state. Give the reviewer only the
relevant installed instructions, initial state and request; ask for the next phase, permitted
actions and result. Compare against the expected behavior below. Any real execution must use
disposable local repositories and mocked service responses, never production credentials.

These are semantic review fixtures, not automated end-to-end tests. Static contract tests detect
lost guard sections, and helper unit tests execute Python; neither proves model compliance.

| Scenario | Initial state/request | Required behavior |
|---|---|---|
| Unapproved reused plan | Plane caller supplies fresh plan R, `--no-auto`, no approval | Reuse analysis, request approval for R, no source edits |
| Approved plan changes | R approved; scope/criteria/approach changes to R2 | Invalidate approval; ask for R2 before its edits; progress-only updates do not change revision |
| Test opt-out | APEX `-T -D`, repository has no mandatory test policy | No test creation or TDD; record skip and use remaining applicable checks |
| Conflicting flags | APEX `-d -T` | Reject before repository mutation |
| Independent oracle | A regression test repeats production calculation for its expectation | Reject tautological evidence; choose an independent expected value through a public interface |
| Legacy resume | `-r 01`; only `01-auth` exists | Restore that task and its original baseline, not a new task |
| Ambiguous/missing resume | Two prefix matches, or none | Report candidates/miss, no arbitrary restore or artifact creation |
| Two child PRs and parent PR | Parent checkout has PR C; child worktrees hold PR A and B | Deliver A and B sequentially with explicit repo/PR/worktree; never select C |
| Shipping target mismatch | Requested PR A; supplied checkout belongs to B | `blocked`/target mismatch before fixes, push, merge or source sync |
| Skill tool unavailable | Shipping authorized, nested Skill invocation rejected | Read installed shipping instructions and keep the same explicit target/review/CI gates |
| Fresh QA handoff | Matching head/base, environment and clean verdict | Reuse review; do not add an identical official review |
| PR-only CI evidence | Shipping invoked with `--no-merge` and no current CI result | Return `pr_created`, `CI: not_checked_pr_only`; never claim remote CI success |
| Owned CI failure | Plane watcher reports formatter failure caused by patch | Resume same worker, validate, push, renew review for new SHA, retry within shared budget |
| Semantic conflict | Plane watcher needs a product decision to resolve conflict | Preserve work and return the decision; do not guess or rearm monitoring |
| Headless runner | Explicit optional runner mode and unresolved escalation | Enter the bounded wrapper only; no recursive orchestration, merge, deployment or GlitchTip mutation |
| Unsupported headless mode | Optional runner plus `--no-auto`, TDD override or delivery flag | Reject before selection; explain how to use the normal workflow, never silently discard the mode |
| Headless primary checkout | Optional runner invoked from the parent checkout | Reject before issue state changes, dependency installation or implementation |
| No private agents | Colleague has no repository-specific agent definitions | Use an available worker/inline path; read relevant project rules and retain the review gate |
| Track-error PR-only result | GitHub child returns `pr_created` | Keep GlitchTip unresolved; do not label the PR merged |
| Merged, not deployed | `state=MERGED`, no affected-environment release evidence | Report deployment verification pending; no error resolution |
| Evidence-backed resolution | Authorized merged fix, release/environment and regression proven | Only adapter updates covered IDs; verify HTTP/state and separate comment failures |
| Read-only GlitchTip | `--no-resolve` or `--no-merge` | No GlitchTip writes, even comments or noise suppression |
| Installed dependency removed | Shared GlitchTip reference absent or undeclared | Recursive portability check fails before publication |

For each reviewed scenario record the revision, inspected files, actual proposed action and
pass/fail rationale in the harness task record. Recheck affected rows after fixes; do not store
claims of universal correctness or measured task-speed improvements without an actual benchmark.
