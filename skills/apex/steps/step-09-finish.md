---
name: step-09-finish
description: Clean up APEX resources, report verified results, and deliver a PR only when explicitly requested
previous_step: steps/step-04-validate.md
---

# Step 9: Finish

<outcome>
Preserve an existing `blocked`, `needs_planning`, `needs_clarification`, `needs_confirmation`, or cancelled status.
Otherwise set `status=complete` only when all acceptance criteria are met, required validation
is current, and any requested review has no unresolved blocking finding. If a gate is missing,
set `status=blocked` and record the missing evidence or decision before continuing.
</outcome>

<cleanup>
This is the single terminal path. Stop or release every worker recorded in canonical state on every outcome, after preserving their useful completion messages.
</cleanup>

<without_pr>
When `{pr_mode}` is false or status is not complete, do not commit, push, or create a PR. Report the terminal status, owned files, acceptance-criteria status, fresh validation evidence, unresolved issues, and canonical task path. For `needs_planning`, summarize the decision-sized unknowns and recommend `wayfinder`. For `needs_confirmation`, include the plan path and revision awaiting approval. Branch mode alone does not authorize delivery.
</without_pr>

<with_pr>
Proceed only when status is complete (as defined above, with validation current for the recorded environment) and `-pr`/`--pull-request` was explicitly supplied.

1. Verify the branch is not the default branch and inspect the exact owned diff against `{base_sha}`.
2. Stage only APEX-owned hunks. If a path contains inseparable pre-existing user edits, stop and ask rather than committing them implicitly.
3. Create a concise repository-conventional commit with no co-author or tool-generated attribution.
4. In non-auto mode, confirm before the first push. In auto mode, the explicit PR flag authorizes the ordinary push and PR creation, but never a force push.
5. Push the current branch and create the PR with `gh`. Include a concise summary and the actual validation commands/results.
6. Return the PR URL and final commit SHA. On push conflicts or required history rewrites, stop and request direction; never force push without explicit authorization.
</with_pr>

Always persist the terminal status and results to the canonical task artifact, with save mode's expanded evidence fields when enabled. Exception: when `{resume_lookup_failed}=true`, no canonical task was selected; report the missing or ambiguous candidates without creating or overwriting an artifact. Do not promise deferred monitoring unless the user requested it.
