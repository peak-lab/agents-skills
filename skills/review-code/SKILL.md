---
name: review-code
description: Use when reviewing a specified patch, pull request, or local code changes for correctness, security risks, and missing regression coverage. Review is read-only unless fixes are requested.
effort: deep
argument-hint: "[PR number or file paths]"
---

<objective>
Review the exact requested patch, loading the relevant domain references. Use independent
specialists when distinct risks justify them; consolidate one explicit verdict for the caller.
</objective>

<constraints>
- Review is read-only unless the user also requested implementation; do not post findings or change PR state implicitly.
- Bind the repository, PR or baseline, head SHA and scope before inspection. Do not substitute the current checkout for a caller's explicit target.
- If a caller already supplied a current verdict for the same scope/head/base, reuse it unless an independent review was requested; inspect changed evidence and renew stale verdicts.
- Use the host's available review capabilities and its model/effort routing. No particular vendor model, private agent or Task API is required.
</constraints>

<workflow>
## Phase 1: SCOPE - Analyze changes and determine review domains

1. **Get the diff.** Determine what to review:
   - If user provided a PR number: bind its repository and use `gh pr diff {number} --repo {owner/repo}`; do not replace it with local changes.
   - If user provided file paths: inspect their relevant diff and current contents; an explicitly requested file can need review even when unchanged or untracked.
   - If nothing specified: use `git status --short`, `git diff` (unstaged), `git diff --cached` (staged), and `git ls-files --others --exclude-standard` (untracked). Read in-scope new source files directly; Git diffs alone omit them. Do not open unrelated secrets, ignored files or generated artifacts merely because they exist.
   - A caller-provided PR or commit range remains the target even with a clean worktree. Ask only when no target can be established.
   - Record head/base for committed changes. For local changes, also record the reviewed file set and content snapshot/digests: HEAD alone cannot identify a dirty or untracked patch. Recheck relevant contents before reusing a verdict.

2. **Categorize changed files** into domains by scanning extensions and paths:

| Domain | Signals |
|--------|---------|
| **frontend** | `.tsx`, `.jsx`, `.css`, `.scss`, `components/`, `pages/`, `app/`, `ui/` |
| **backend** | `.ts`/`.js` in `api/`, `server/`, `routes/`, `middleware/`, `lib/`, `services/`, `prisma/`, `drizzle/` |
| **security-sensitive** | Auth files, middleware, API routes, env handling, crypto, payments |
| **database** | Migration files, schema files, ORM models, raw SQL |
| **tests** | `.test.`, `.spec.`, `__tests__/`, `vitest`, `jest` |
| **config** | `.config.`, `package.json`, `tsconfig`, CI/CD files |

3. **Determine review agents to launch** based on domains detected:

| Condition | Agent | Focus | Reference to load |
|-----------|-------|-------|-------------------|
| Maintainability risk in changed code | **Clean Code** | Complexity obscuring correctness or safe maintenance | Relevant parts of `references/clean-code-principles.md` and `references/code-quality-metrics.md` |
| Backend or security-sensitive files | **Security** | OWASP, auth, injection, secrets | `references/security-checklist.md` |
| Frontend files (.tsx/.jsx/.css) | **UX/UI** | Accessibility, responsive, UX patterns | `references/ux-ui-checklist.md` |
| Backend files (API, DB, services) | **Backend** | API design, DB patterns, error handling | `references/backend-patterns.md` |
| Test files changed | **Tests** | Coverage gaps, test quality | (inline guidance) |

4. **Determine review scale:** one reviewer may cover several domains. Add an independent
   specialist for a distinct material risk, respecting host capacity; file count alone does
   not impose a reviewer quota. Keep the final verdict under one owner.

## Phase 2: DISPATCH - Launch parallel specialized review agents

Launch independent review assignments in parallel using the host's available agent tools and
deep review intent. Use repository-declared reviewers when present; if delegation is unavailable,
read the same references and perform an explicit local review with the same reporting standard.

Each agent gets a structured prompt following this template:

```xml
<review_request>
  <focus_area>{domain}</focus_area>
  <reference_files>
    <file>{SKILL_PATH}/references/{reference-file}.md</file>
  </reference_files>
  <changed_files>
    <file path="src/example.ts" />
  </changed_files>
  <diff_context>
{paste relevant portions of the diff for this domain's files}
  </diff_context>
  <pr_context>
    <title>{PR title if available}</title>
    <description>{PR description if available}</description>
  </pr_context>
</review_request>

INSTRUCTIONS:
1. Read EACH reference file listed in <reference_files> - these contain your domain-specific checklists
2. Read EACH file listed in <changed_files> completely
3. Apply the checklist from the reference against the actual code
4. For EACH issue found, provide: Severity | Issue | Location (file:line) | Why It Matters | Concrete Fix
5. Report findings supported by a concrete affected path, plausible triggering condition and observable consequence. Mark uncertain hypotheses as unverified; no invented numerical confidence, style-only nitpicks or speculative refactors.
6. Use severity labels: BLOCKING (must fix) | CRITICAL (high-impact, must fix) | SUGGESTION (optional improvement). Reference-guide priority is not automatically a defect severity: justify impact in this patch.
```

**Review task names:** `review-{domain}` (e.g., `review-security`, `review-ux-ui`). These label assignments, not agent types. Use a repository-declared reviewer or the host's available review capability; keep the local fallback when delegation is unavailable.

**If a best-practice skill exists** for the detected tech stack (e.g., `vercel-react-best-practices` for Next.js/React), include it in the prompt: tell the agent to load its installed instructions through the host's available facility for additional framework-specific checks. This is optional, not an undeclared required dependency.

## Phase 3: CONSOLIDATE - Merge and present findings

After the review assignments complete (or the equivalent local review):

1. **Collect all findings** from each agent
2. **Deduplicate**: If multiple agents flagged the same issue, keep the most detailed one
3. **Sort by severity**: BLOCKING first, then CRITICAL, then SUGGESTION
4. **Present the unified report:**

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

5. **Verdict logic:**
   - Any BLOCKING or CRITICAL issue → REQUEST CHANGES
   - Only non-blocking SUGGESTIONS → APPROVE WITH COMMENTS
   - No findings after a completed review → APPROVE
   - Missing target, inaccessible evidence or an incomplete review → report INCOMPLETE with the missing evidence, never APPROVE. State which checks were inspected versus actually run.
</workflow>

<execution_rules>
- Perform at least one explicit review; do not require an unavailable agent to complete it
- Resolve deep review model/effort through the repository and host routing policy
- ALWAYS pass the relevant reference file paths so agents can Read them
- ALWAYS include the actual diff context in the agent prompt (not just file paths)
- NEVER skip the scoping phase - it determines which agents are needed
- Small focused changes usually need one general review, not multiple specialist passes
- Each agent should complete independently - they don't need to communicate with each other
</execution_rules>

<reference_files>
Domain-specific checklists loaded by sub-agents:

| Reference | Domain | Content |
|-----------|--------|---------|
| `references/security-checklist.md` | Security | OWASP Top 10, auth, injection, input validation, secrets |
| `references/clean-code-principles.md` | Clean Code | SOLID, code smells, function design, naming |
| `references/code-quality-metrics.md` | Clean Code | Complexity metrics, maintainability index, thresholds |
| `references/ux-ui-checklist.md` | UX/UI | Accessibility (WCAG), responsive design, UX patterns, loading states |
| `references/backend-patterns.md` | Backend | API design, database, error handling, concurrency, observability |
| `references/feedback-patterns.md` | All | How to structure feedback (What + Why + Fix), priority labels |
</reference_files>
