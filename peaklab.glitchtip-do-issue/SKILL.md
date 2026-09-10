---
name: peaklab.glitchtip-do-issue
description: Use when the user asks to fix GlitchTip errors as root-cause clusters, with isolated implementation and reviewed PRs.
effort: deep
argument-hint: "[id|url...] [--project SLUG] [--level fatal|error|warning] [--swarm [N]] [--limit N] [--base BRANCH] [--draft] [--no-auto] [--no-tdd] [--async-merge | --wait-merge | --no-merge] [--no-resolve] [--no-subagent]"
---

# GlitchTip Issue Delivery

One demonstrated root cause covering one or more GlitchTip IDs is one unit of work.
Use this workflow for isolated fixes or bounded batches. `peaklab.fix-glitchtip` owns an
inline inbox drain; `peaklab.track-error` owns an error needing a GitHub issue as its record.

Before implementation, read the installed `peaklab.gh-do-issue` skill's
[shared execution contract](../peaklab.gh-do-issue/references/execution.md).
It owns worktrees, APEX, QA and requested delivery. This adapter owns GlitchTip evidence
and resolution. Dependencies: `peaklab.gh-do-issue`, `apex`, `peaklab.ship-pr`.

## Inputs and modes

| Input | Meaning |
|---|---|
| Empty | Select one highest-ranked unresolved cluster |
| IDs / issue URLs | Cluster seeds; verify project/environment |
| `--project SLUG` | Explicit project |
| `--level fatal\|error\|warning` | Minimum severity; default error |
| `--limit N` | Maximum inbox candidates considered; default 20 |
| `--swarm [N]` | Select up to N clusters; default 3 |
| `--base`, `--draft`, `--no-subagent` | Base override, draft PR, or single-cluster inline work |
| `--auto` / `--no-auto` | Automatic agreed-scope work / plan approval |
| `--tdd` / `--no-tdd` | Test-first / opt out while retaining verification |
| `--no-merge` | Reviewed PR only; default unless delivery requested |
| `--wait-merge` / `--async-merge` | Explicit delivery with the shared contract's session limits |
| `--no-resolve` | No GlitchTip mutation, including comments |

Validate options before mutation. Numeric option values are not IDs; seeds and `--swarm`
are alternative selectors. Reject conflicting modes and nonpositive limits. Automatic execution
and adaptive testing are defaults. Fatal errors need deeper investigation/review; ask only for
new authority or an unresolved product decision. Drafts are never merged.

## Configuration and transport

Read exported `GLITCHTIP_URL`, `GLITCHTIP_TOKEN`, `GLITCHTIP_ORG`; fill missing values from
project `.env`, then `~/.agents/.env`, without sourcing/printing files. Require real values;
examples are never defaults. API base: `<URL>/api/0`. Use Bearer authentication and verify
access with `GET /projects/`.

Use the deployment's supported transport. If its Cloudflare edge rejects Python with 403/1010,
use curl; a 403 alone does not prove this cause. Inspect HTTP status and response shape.
Serialize JSON payloads and use data files, not exception-message interpolation in shell JSON.
Temporary sensitive data needs a unique private location and deletion after extraction;
never retain a shared `/tmp/gt-issues.json`.

Reads are project-scoped; mutations use `/issues/<id>/`. On a documented PUT 405, retry PATCH.
Report a missing comment endpoint separately from resolution status.

## Select and prove clusters

1. For seeds, fetch `/issues/<id>/` and use the actual project; verify any explicit project
   matches. Otherwise map configured/repository metadata to the projects endpoint; ask when
   several projects are plausible.
2. Fetch unresolved candidates from `/projects/<org>/<project>/issues/`. Rank considered
   candidates by severity then count. State limits/pagination truncation; a bounded ranking
   or empty page does not establish a globally empty inbox.
3. Read relevant events, including `/issues/<id>/events/latest/`. Retain only sanitized
   exception type/message, culprit, in-app frames, release, environment and diagnostic context.
   For issues spanning environments, inspect enough evidence to isolate them.
4. Group only when exception, normalized message, frame and culprit match, or one demonstrated
   failing dependency explains all members. Matching titles alone are insufficient. A wrapper
   and underlying exception may share a cause; prove that relationship in code/events.
5. Never combine projects/environments. Record covered and rejected IDs, shared cause and
   restored behavior. Redact identities, request bodies, headers and private breadcrumbs.
6. Check existing PR/task ownership by exact IDs before creating work. Read source/history to
   distinguish active bugs, already-fixed behavior, stale signal and noise. A merged base-branch
   fix does not prove deployment in the emitting environment.

Use a filesystem-safe cluster slug plus a stable member ID to avoid collisions. One cluster
gets one branch/worktree/PR. If cause remains unknown, report missing evidence or a decision;
do not implement speculative suppression.

## Execute and review

Pass the shared executor IDs/permalinks, sanitized evidence, environment/release, scope,
criteria, task-state path and modes. Resolvers use APEX inline, preserve regression evidence
and never call the GlitchTip API.

PRs list every covered GlitchTip ID, common cause and validation. Never use GitHub `Closes #N`
for GlitchTip IDs. QA checks each member; remove uncovered IDs from the claim and keep them open.

## Resolution evidence

| Evidence | Outcome |
|---|---|
| Reviewed PR, not merged | `pr_created`; errors remain unresolved |
| Merged fix, deployment unverified | `merged`; deployment verification pending |
| Fix deployed in affected environment, regression verified | Resolve covered IDs if authorized |
| `already_done` / `stale_signal` | Require deployed-release evidence establishing the error is no longer active |
| `noise` | Explain classification and obtain agreement before resolving/suppressing |
| Unclear cause, failed checks, incomplete coverage | Keep affected IDs unresolved; report blocker |

`--no-resolve` or `--no-merge` skips all GlitchTip writes. Fix-and-deliver intent may include
resolution after this gate; it does not authorize deployment or future monitoring itself.
If runtime observation occurred, record environment, release and time window. Otherwise mark it
unverified; absence of events without representative traffic is not regression proof.

For each authorized covered ID, send `{"status":"resolved"}` to `/issues/<id>/` and verify the
response. Add a sanitized root-cause/PR/release comment when supported. If status succeeds but
comment fails, report both accurately. Never infer API success from a transport exit code alone.

Finish with one concise row per cluster: IDs, PR, code status, deployment evidence, GlitchTip
status and next action. Only report an inbox total if supplied by the API or actually measured.
No automatic queue chaining, background deployment or scheduled rechecks.
