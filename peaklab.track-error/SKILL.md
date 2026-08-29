---
name: "peaklab.track-error"
description: Use when tracking GlitchTip errors end to end, fetching unresolved errors, fixing code, creating GitHub issues, shipping PRs, or resolving GlitchTip issues.
effort: deep
allowed-tools: Bash(git:*), Bash(gh:*), Bash(rg:*), Bash(pnpm:*), Bash(npm:*), Bash(curl:*), Bash(jq:*), Bash(glitchtip:*), Read, Edit, Write, Glob, Grep, Agent, Skill
argument-hint: [project-slug]
---

<objective>
End-to-end error resolution: fetch → analyze → fix → issue → PR → resolve on GlitchTip.
</objective>

<config>
```bash
GLITCHTIP_API="https://glitchtip.example.com/api/0"
ORG_SLUG="peaklab"
```

Always use `rtk proxy curl` instead of bare `curl` for GlitchTip API calls to get raw JSON.
</config>

## Phase 1: Detect Project Slug

If `$ARGUMENTS` provided, use it. Otherwise auto-detect from `package.json`:

```bash
rtk proxy curl -s -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  "${GLITCHTIP_API}/projects/" | python3 -c "
import json,sys; [print(p['slug']) for p in json.load(sys.stdin)]"
```

Match project slug to `package.json` `name` field.

## Phase 2: Fetch Unresolved Errors

```bash
PROJECT_SLUG="<slug>"

rtk proxy curl -s -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  "${GLITCHTIP_API}/projects/${ORG_SLUG}/${PROJECT_SLUG}/issues/?is_status=unresolved&limit=20" \
  | python3 -c "
import json,sys
data=json.load(sys.stdin)
if not data: print('No unresolved errors.'); exit()
for i,issue in enumerate(data):
    print(f'[{i}] ID:{issue[\"id\"]} | x{issue[\"count\"]} | {issue[\"title\"][:80]}')
    print(f'    Last seen: {issue[\"lastSeen\"]}')
"
```

- **No errors** → report and stop
- **1 error** → auto-select
- **Multiple** → show list, ask user which one to fix

## Phase 3: Analyze the Error

Extract from issue metadata:
- `metadata.type` — error type
- `metadata.value` — error message
- `metadata.filename` — source file
- `title` — full error title

Investigate the codebase with `Grep` and `Read` to identify the root cause from the error message and context. Use an `Explore` subagent for complex analysis.

## Phase 4: Create GitHub Issue

Use the `create-issue` skill to document the error:
- Title: `fix(scope): <error description>`
- Include: GlitchTip error ID, permalink, error message, root cause, stack trace context
- Label: `bug`

**Capture the GitHub issue number** (e.g., `#42`) from the returned URL.

## Phase 5: Do the Issue

Invoke `do-issue` with the captured issue number:
```
Skill("do-issue"): <issue-number>
```

This handles investigation, fix, PR creation, review, and merge end-to-end. Wait for it to complete.

## Phase 6: Resolve on GlitchTip

```bash
ISSUE_ID="<glitchtip-issue-id>"

rtk proxy curl -s -X PUT \
  -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  -H "Content-Type: application/json" \
  "${GLITCHTIP_API}/projects/${ORG_SLUG}/${PROJECT_SLUG}/issues/${ISSUE_ID}/" \
  -d '{"status":"resolved"}'
```

If `PUT` returns "Method not allowed", try `PATCH` with the same payload.

## Output

```
GlitchTip: <error-id> resolved ✅
GitHub Issue: <url>
PR: <url> (merged)
```

## Rules

- Don't resolve GlitchTip error before `do-issue` completes (PR merged)
- If multiple errors: ask user which to fix, never guess
- Use `rtk proxy curl` for API calls
- Capture GitHub issue number after `create-issue` before calling `do-issue`

User: $ARGUMENTS
