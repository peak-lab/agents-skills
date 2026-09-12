---
name: step-03-verify
description: Verify build passes and summarize changes
prev_step: steps/step-02-apply.md
next_step: null
---

# Step 3: VERIFY

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER complete with failing build
- ✅ ALWAYS run build before marking done
- 📋 YOU ARE A VALIDATOR ensuring quality
- 💬 FOCUS on verification and summary
- 🚫 FORBIDDEN to skip any check

## EXECUTION PROTOCOLS:

- 🎯 Run all verification commands
- 💾 Save summary if `{save_mode}` = true
- 📖 Fix any errors before completing
- 🚫 FORBIDDEN to mark complete if build fails

## CONTEXT BOUNDARIES:

- From step-02: changes applied, files modified
- Build/lint commands from package.json

## YOUR TASK:

Run build, fix any errors, and provide final summary.

---

## EXECUTION SEQUENCE:

### 1. Discover Applicable Checks

Read `package.json` and the repository instructions. Detect the declared package manager and the
available scripts before running anything. Use only that package manager, and skip TypeScript checks
for projects that do not use TypeScript.

### 2. Run TypeScript Check (if applicable)

Run the repository's type-check script when it exists. Otherwise, if TypeScript is installed locally,
run its compiler through the detected package manager with `--noEmit`.

**If errors:** Fix and re-run until clean.

### 3. Run Linter (if configured)

```bash
<package-manager> run lint
```

**If errors:** Use the repository's documented lint-fix script when one exists, then make the
remaining manual fixes. Do not invent a `--fix` flag for an unknown linter.

### 4. Run Build (if configured)

```bash
<package-manager> run build
```

**If build fails:**
1. Read error
2. Fix issue
3. Re-run
4. **Loop until passes**

### 5. Run Tests (if configured)

```bash
<package-manager> run test
```

### 6. Generate Summary

```markdown
## Clean Code Complete ✓

### Verification
| Check | Status |
|-------|--------|
| TypeScript | ✅ |
| ESLint | ✅ |
| Build | ✅ |

### Improvements
| Metric | Before | After |
|--------|--------|-------|
| useEffect fetching | 5 | 0 |
| any types | 12 | 0 |

### Files Changed: 12
```

**If `{save_mode}` = true:**
→ Write to the host task-output directory for `{task_id}/03-verify.md`

### 7. Offer Commit

**Use AskUserQuestion:**
```yaml
questions:
  - header: "Complete"
    question: "Clean code complete. Create commit?"
    options:
      - label: "Create Commit (Recommended)"
        description: "Commit changes"
      - label: "Done"
        description: "Finish without commit"
    multiSelect: false
```

**If commit:**
```bash
git status --short
# For owned files containing only this run's changes:
git add -- <exact-owned-files>
# For owned files that also contain unrelated hunks:
git add -p -- <file-with-mixed-hunks>
git diff --cached --name-only
git diff --cached
git commit -m "refactor: apply clean code improvements"
```

If `{initial_staged_changes}` was non-empty, leave the index untouched and do not create an automated
commit; report that the verified clean-code changes remain uncommitted. Otherwise, never use
`git add -A` or stage pre-existing or unrelated changes. Use hunk staging for an owned file with mixed
changes, and commit only after the staged diff contains exactly the hunks owned by this run.

---

## SUCCESS METRICS:

✅ TypeScript passes
✅ Linter passes
✅ Build passes
✅ Summary generated

## FAILURE MODES:

❌ Completing with failing build
❌ Skipping verification
❌ Not offering commit option

## VERIFY PROTOCOLS:

- Always run build
- Fix errors before completing
- Provide clear summary

---

## WORKFLOW COMPLETE

<critical>
NEVER complete if build fails!
</critical>
