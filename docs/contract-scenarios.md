# Workflow contract scenarios

Run these when changing a flag, caller handoff or terminal state. Give the reviewer only the
relevant installed instructions, initial state and request; ask for the next phase, permitted
actions and result. Compare against the expected behavior below. Any real execution must use
disposable local repositories and mocked service responses, never production credentials.

These are semantic review fixtures, not automated end-to-end tests. Static contract tests detect
lost guard sections, and helper unit tests execute Python; neither proves model compliance.

See the [contributor guide](contributing.md) for checks to run with these scenarios.

## APEX planning and validation

| Scenario | Initial state/request | Required behavior |
|---|---|---|
| Unapproved reused plan | Plane caller supplies fresh plan R, `--no-auto`, no approval | Reuse analysis, request approval for R, no source edits |
| Approved plan changes | R approved; scope/criteria/approach changes to R2 | Invalidate approval; ask for R2 before its edits; progress-only updates do not change revision |
| Test opt-out | APEX `-T -D`, repository has no mandatory test policy | No test creation or TDD; record skip and use remaining applicable checks |
| Conflicting flags | APEX `-d -T` | Reject before repository mutation |
| Independent oracle | A regression test repeats production calculation for its expectation | Reject tautological evidence; choose an independent expected value through a public interface |
| Legacy resume | `-r 01`; only `01-auth` exists | Restore that task and its original baseline, not a new task |
| Ambiguous/missing resume | Two prefix matches, or none | Report candidates/miss, no arbitrary restore or artifact creation |

## Worker coordination and review

| Scenario | Initial state/request | Required behavior |
| Two child PRs and parent PR | Parent checkout has PR C; child worktrees hold PR A and B | Deliver A and B sequentially with explicit repo/PR/worktree; never select C |
| Shipping target mismatch | Requested PR A; supplied checkout belongs to B | `blocked`/target mismatch before fixes, push, merge or source sync |
| Skill tool unavailable | Shipping authorized, nested Skill invocation rejected | Read installed shipping instructions and keep the same explicit target/review/CI gates |
| Fresh QA handoff | Matching head/base, environment and clean verdict | Reuse review; do not add an identical official review |
| Report ownership transfer | Implementer returns evidence while parent starts review | Implementer stops writing; parent owns canonical state; reviewer returns findings without editing it |
| Missing result evidence | Worker returns PR without acceptance-validation evidence | Parent requests the specific gap from the same worker; transfer write ownership; no duplicate exploration or premature release |
| Specialist worker handoff | Parent loaded shared execution/APEX; repository worker has only the task brief | Pass readable contract/APEX paths, resolved flags and state ownership; worker loads them and reuses analysis, without an acknowledgment loop |
| Interactive specialist handoff | Caller requested `--no-auto --no-tdd`, supplied plan has no approval | Pass APEX `-e -A -D`; do not lose approval gate or disable ordinary verification; no edits before approval |
| Quiet running worker | Wait expires; transcript is old but host reports a running worker | Inspect existing status/tools once, continue waiting; no duplicate dispatch or inference that tests failed |
| Unknown worker state | No new output and host cannot confirm running or stopped | Report handle and uncertainty; do not launch another writer or claim a provider failure |
| Idle worker without result | Host confirms idle; no complete result delivered | Inspect artifacts and resume same worker for missing result; do not rebuild its analysis |
| Accepted terminal result | Reviewed PR requested and accepted; worker still has reporting suggestions | Release worker after required cleanup; no autonomous report polishing, acknowledgment or memory loop |
| Evidence changes after return | A new fact invalidates the worker's reported result | Report the fact to the parent; renew affected verification and review before delivery |
| Independent review with valid tests | Author provides inspectable passing commands for current scope/environment | Independently inspect patch/interactions; reuse valid tests; run missing checks; retain official verdict |
| Stale or incomplete tests | Matching head SHA but changed environment or uncovered affected callers | Matching SHA alone is insufficient; validate uncovered or invalidated scope before accepting evidence |
| Structured issue comments | Explicit GitHub issue requires body and comments | One repository-bound `gh issue view --json` call includes `comments`; no separate `--comments` flag |
| Test runner prerequisite | First focused run needs a generated client; package script forwards arguments differently | Inspect recipe, prepare missing prerequisite, verify selected tests and exit status; setup failure is not RED |
| Silent test process | Test output is empty while a process may still run | Inspect process/output before another launch; never infer pass from an empty log |
| Reviewer regression experiment | Current tests pass but pre-fix failure evidence is missing | Use disposable checkout/copy and isolated services; preserve author checkout and clean up only experiment |

## Delivery and headless execution

| Scenario | Initial state/request | Required behavior |
| PR-only CI evidence | Shipping invoked with `--no-merge` and no current CI result | Return `pr_created`, `CI: not_checked_pr_only`; never claim remote CI success |
| Owned CI failure | Plane watcher reports formatter failure caused by patch | Resume same worker, validate, push, renew review for new SHA, retry within shared budget |
| Semantic conflict | Plane watcher needs a product decision to resolve conflict | Preserve work and return the decision; do not guess or rearm monitoring |
| Headless runner | Explicit optional runner mode and unresolved escalation | Enter the bounded wrapper only; no recursive orchestration, merge, deployment or GlitchTip mutation |
| Unsupported headless mode | Optional runner plus `--no-auto`, TDD override or delivery flag | Reject before selection; explain how to use the normal workflow, never silently discard the mode |
| Headless primary checkout | Optional runner invoked from the parent checkout | Reject before issue state changes, dependency installation or implementation |
| No private agents | Colleague has no repository-specific agent definitions | Use an available worker/inline path; read relevant project rules and retain the review gate |

## GlitchTip resolution and service transport

| Scenario | Initial state/request | Required behavior |
| Track-error PR-only result | GitHub child returns `pr_created` | Keep GlitchTip unresolved; do not label the PR merged |
| Merged, not deployed | `state=MERGED`, no affected-environment release evidence | Report deployment verification pending; no error resolution |
| Evidence-backed resolution | Authorized merged fix, release/environment and regression proven | Only adapter updates covered IDs; verify HTTP/state and separate comment failures |
| Read-only GlitchTip | `--no-resolve` or `--no-merge` | No GlitchTip writes, even comments or noise suppression |
| Split API environments | Shell reports credentials present; separate API kernel lacks them | Apply configured precedence inside requesting process and validate locally before networking; do not print secrets |
| Verified API transport | Current task established Python 403/1010 and successful curl | Reuse working client/transport for subsequent endpoints; generic 403 alone is not a Cloudflare diagnosis |

## Dependency portability

| Scenario | Initial state/request | Required behavior |
| Installed dependency removed | Shared GlitchTip reference absent or undeclared | Recursive portability check fails before publication |

For each reviewed scenario record the revision, inspected files, actual proposed action and
pass/fail rationale in the harness task record. Recheck affected rows after fixes; do not store
claims of universal correctness or measured task-speed improvements without an actual benchmark.
