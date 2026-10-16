---
name: review-code
description: "Review a specified patch or PR for correctness, security and missing tests. Read-only unless fixes are requested."
effort: deep
argument-hint: "[PR number or file paths]"
---

<objective>
Review the exact requested patch. Use independent specialists when distinct risks justify them;
consolidate one explicit verdict for the caller.
</objective>

<constraints>
- Review is read-only unless the user also requested implementation; do not post findings or change PR state implicitly.
- Bind the repository, PR or baseline, head SHA and scope before inspection. Do not substitute the current checkout for a caller's explicit target.
- If a caller already supplied a current verdict for the same scope/head/base, reuse it unless an independent review was requested; inspect changed evidence and renew stale verdicts.
- Use the host's available review capabilities and its model/effort routing. No particular vendor model, private agent or Task API is required.
</constraints>

<workflow>
## Phase 1: SCOPE

1. **Get the diff.**
   - PR number: bind its repository and use `gh pr diff {number} --repo {owner/repo}`; do not replace it with local changes. If the diff cannot be accessed, report INCOMPLETE; never approve a substituted local checkout.
   - File paths: inspect their relevant diff and current contents; an explicitly requested file can need review even when unchanged or untracked.
   - Nothing specified: use `git status --short`, `git diff`, `git diff --cached` and `git ls-files --others --exclude-standard`. Read in-scope new source files directly; Git diffs alone omit them. Do not open unrelated secrets, ignored files or generated artifacts merely because they exist.
   - A caller-provided PR or commit range remains the target even with a clean worktree. Ask only when no target can be established.
   - Record head/base for committed changes. For local changes, also record the reviewed file set and content snapshot/digests: HEAD alone cannot identify a dirty or untracked patch. Recheck relevant contents before reusing a verdict.

2. **Pick review domains** from changed paths: security-sensitive (auth, middleware, API routes, env, crypto, payments), backend/database (services, queries, migrations, schemas), frontend (components, styles, accessibility), tests, config/CI. Maintainability counts only where complexity obscures correctness or safe maintenance.

3. **Scale.** Small focused changes usually need one general review. Add an independent specialist only for a distinct material risk, respecting host capacity; file count alone imposes no reviewer quota. Keep the final verdict under one owner.

## Phase 2: DISPATCH

Launch independent assignments in parallel, named `review-{domain}` (labels, not agent types).
Prefer the `code-reviewer` native agent (read-only, deep) or another repository-declared reviewer;
if delegation is unavailable, perform the same review locally with the same reporting standard.
Always include the actual diff context, not just file paths. Assignments do not communicate.

Each assignment gets this request:

```xml
<review_request>
  <focus_area>{domain}</focus_area>
  <changed_files>
    <file path="src/example.ts" />
  </changed_files>
  <diff_context>
{relevant portions of the diff for this domain's files}
  </diff_context>
  <pr_context>
    <title>{PR title if available}</title>
    <description>{PR description if available}</description>
  </pr_context>
</review_request>

INSTRUCTIONS:
1. Read EACH file listed in <changed_files> completely and inspect the patch in context.
2. For EACH issue found, provide: Severity | Issue | Location (file:line) | Why It Matters | Concrete Fix
3. Apply the confidence threshold and severity labels from review-code's SKILL.md.
```

If a best-practice skill exists for the detected stack (e.g. `vercel-react-best-practices`), tell
the reviewer to load it through the host's facility. It is optional, not a required dependency.

## Confidence threshold and severity

- Report only findings supported by a concrete affected path, a plausible triggering condition and an observable consequence. Mark uncertain hypotheses as unverified; no invented numerical confidence, style-only nitpicks or speculative refactors.
- Flag only code the patch changes or directly breaks; linter-covered style and pre-existing issues outside the diff are not findings.
- Labels: BLOCKING (must fix) | CRITICAL (high-impact, must fix) | SUGGESTION (optional). Checklist priority is not a defect severity: justify impact in this patch.

## Phase 3: CONSOLIDATE

Collect all findings, deduplicate (keep the most detailed), sort BLOCKING → CRITICAL → SUGGESTION,
then present:

```markdown
# Code Review Report

**Scope**: {X files across Y domains}
**Agents dispatched**: {list of agents launched}

## BLOCKING Issues (must fix before merge)
{consolidated blocking issues table}

## CRITICAL Issues (high-impact, must fix)
{consolidated critical issues table}

## SUGGESTIONS (optional improvements)
{consolidated suggestions table}

## Summary
{2-3 sentence overview of code health}
{Verdict: APPROVE / APPROVE WITH COMMENTS / REQUEST CHANGES / INCOMPLETE}
```

**Verdict logic:**
- Any BLOCKING or CRITICAL issue → REQUEST CHANGES
- Only non-blocking SUGGESTIONS → APPROVE WITH COMMENTS
- No findings after a completed review → APPROVE
- Missing target, inaccessible evidence or an incomplete review → report INCOMPLETE with the missing evidence, never APPROVE. State which checks were inspected versus actually run.
</workflow>
