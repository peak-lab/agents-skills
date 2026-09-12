---
name: peaklab.track-error
description: "Fix one GlitchTip error with a GitHub issue as its permanent trace. Use peaklab.glitchtip-do-issue for broader triage."
effort: deep
argument-hint: "[project-slug] [--wait-merge | --no-merge] [--no-resolve] [--no-auto] [--no-tdd]"
---

<overview>
Track one error through a GitHub issue. Use `peaklab.glitchtip-do-issue` instead for root-cause
clusters without a separate GitHub ticket, including an explicit `--inline` inbox pass.
</overview>

<constraints>
- Read [the shared GlitchTip contract](../peaklab.glitchtip-do-issue/references/glitchtip-contract.md)
  before API access. It owns configuration, sanitized evidence and resolution requirements.
- Default to a reviewed PR. Explicit delivery intent or `--wait-merge` permits shipping;
  `--no-merge` takes precedence. Never infer merge from a child workflow's completion.
- `--no-resolve` forbids GlitchTip writes, not creation of the requested GitHub trace.
- Preserve unknown or uncovered errors as unresolved. Never deploy or monitor implicitly.
</constraints>

<workflow>
1. Resolve the requested project and fetch unresolved candidates using the shared contract.
   Preserve the positional project-slug input. If no candidates exist, report the observed
   scope; if several exist, ask which one to track. Do not start an unrequested queue.
2. Read the selected error's current event and relevant code. Record sanitized evidence,
   environment/release, a proven or explicitly unconfirmed cause, and acceptance criteria.
   Ask only for a material missing decision; do not invent a code fix.
3. Look for an existing GitHub issue linked to this exact GlitchTip ID/permalink with `gh`.
   Reuse a matching issue; otherwise invoke `peaklab.gh-create-issue` with sanitized context.
   Capture its repository, issue number and URL. Keep one task record for the entire flow.
4. Invoke `peaklab.gh-do-issue <issue-number> <MERGE_FLAG>` in that repository with the current
   task record, existing analysis and criteria. Set `MERGE_FLAG=--wait-merge` only for authorized
   delivery; otherwise explicitly pass `--no-merge`. Propagate `--no-auto` and `--no-tdd`
   when requested; do not duplicate analysis or add another review/ship owner.
5. Handle the actual result:
   - `pr_created`: report the reviewed PR and keep GlitchTip unresolved.
   - `merged`: verify that exact PR's `state=MERGED` via `gh pr view --repo <repository>`.
     Then apply the shared deployment/regression evidence gate; missing evidence means
     resolution pending, not success.
   - `needs_confirmation` / `needs_clarification`: present the plan/question and resume the
     same task only after the required answer.
   - `already_done` / `obsolete` / `needs_planning` / `no_changes` / `blocked`: report the
     evidence and next action; do not resolve solely on that status.
6. Only when the shared gate and authority both permit it, update the selected GlitchTip ID.
   Never use the obsolete project-scoped mutation endpoint. Record the returned state and
   comment outcome separately.
</workflow>

<result>
Return GlitchTip ID, GitHub issue, PR, code status, deployment evidence, actual resolution
status and next action. A reviewed PR, merged code and a resolved runtime error are distinct.
</result>
