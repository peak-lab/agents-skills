---
name: peaklab.fix-glitchtip
description: Use when fixing GlitchTip errors end to end, triaging unresolved errors, applying fixes, shipping PRs, or clearing the GlitchTip inbox.
effort: deep
allowed-tools: Bash(git:*), Bash(gh:*), Bash(rg:*), Bash(pnpm:*), Bash(npm:*), Bash(python3 *), Bash(curl:*), Bash(jq:*), Bash(glitchtip:*), Read, Edit, Write, Glob, Grep, Agent, Skill, TaskCreate, TaskUpdate, TaskList
argument-hint: "[project-slug] [--level fatal|error|warning|info] [--all] [--limit N] [--auto]"
---

<overview>
Drain the GlitchTip inbox project-by-project: collect unresolved issues, build evidence-backed root-cause clusters, fix one cluster at a time, ship the PR, then resolve only the covered issues. Prefer one complete root-cause fix over several fingerprint-specific patches.
</overview>

<constraints>
- Never guess a target when a monorepo has multiple GlitchTip projects; ask the user which production target to process.
- Keep production, staging, and QA projects separate unless the user explicitly requests a cross-environment comparison.
- Group issues only when they share an in-app code path and a common acceptance test; matching titles are not enough.
- Never resolve an issue before the relevant PR has merged, and never resolve an issue merely because its title resembles a fixed issue.
- Never print, commit, or retain credentials or customer event data.
</constraints>

<acceptance_criteria>
- [ ] The target project and environment are explicit.
- [ ] Each fix is tied to an evidence-backed cluster with listed issue IDs.
- [ ] Each cluster has proportionate verification and a merged PR before GlitchTip mutation.
- [ ] The final report gives clusters, PRs, resolved IDs, blocked IDs, and remaining inbox count.
</acceptance_criteria>

<objective>
Fetch unresolved issues, cluster them by demonstrated root cause, route each cluster to the right fix workflow, ship the PR, then mark only covered issues resolved on GlitchTip.
</objective>

<config>
```bash
GLITCHTIP_API="https://glitchtip.example.com/api/0"
ORG_SLUG="peaklab"
# Token read from env: $GLITCHTIP_TOKEN
```

Use an already-exported `GLITCHTIP_TOKEN` first; otherwise load the project `.env`, then `~/.agents/.env` as a fallback. Parse `KEY=VALUE` lines rather than sourcing the file, then validate access with a harmless `GET /projects/` before fetching issues. Use `rtk proxy zsh -lc 'curl …'` (or plain `curl`) for API traffic: this GlitchTip deployment's edge may reject Python `urllib` with Cloudflare `403 / 1010` even for a valid token.
</config>

## Flags

| Flag | Meaning | Default |
|---|---|---|
| `project-slug` | Target GlitchTip project. If omitted, auto-detect from the closest `package.json` name or `composer.json` / repo folder name. | auto |
| `--level <lvl>` | Only process issues of this level or above (`fatal` > `error` > `warning` > `info` > `debug`). | `error` |
| `--all` | Process every unresolved issue sequentially. | off (pick one) |
| `--limit N` | Cap number of issues fetched. | 20 |
| `--auto` | Skip user confirmation between phases. Never skip confirmation before `peaklab.ship-pr --merge`. | off |

## Phase 1 — Detect the project

1. If `$ARGUMENTS` contains a slug, use it.
2. Else read `package.json` `name` (front) or `composer.json` `name` / repo root folder (back) and match the first slug in `${GLITCHTIP_API}/projects/` that contains the matched name.
3. For monorepos with multiple targets (e.g. Soowe: `soowe-front` and `soowe-back`), ask which one — never guess.

```bash
curl -s -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  "${GLITCHTIP_API}/projects/" -o /tmp/gt-projects.json
python3 -c "import json; [print(p['slug'], '|', p.get('platform')) for p in json.load(open('/tmp/gt-projects.json'))]"
```

## Phase 2 — Fetch unresolved issues

```bash
PROJECT_SLUG="<slug>"
LIMIT="${LIMIT:-20}"

curl -s -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  "${GLITCHTIP_API}/projects/${ORG_SLUG}/${PROJECT_SLUG}/issues/?query=is:unresolved&limit=${LIMIT}" \
  -o /tmp/gt-issues.json

python3 - <<'PY'
import json
data = json.load(open('/tmp/gt-issues.json'))
order = {'fatal':0,'error':1,'warning':2,'info':3,'debug':4}
data.sort(key=lambda i:(order.get(i.get('level','info'),9), -int(i.get('count',0) or 0)))
for i,issue in enumerate(data):
    lvl = issue.get('level','?')
    cnt = issue.get('count','?')
    print(f"[{i}] {lvl:>7} | id={issue['id']:<5} | x{cnt:<4} | {issue['title'][:90]}")
PY
```

- Empty list → report "inbox clean" and stop.
- Otherwise proceed to root-cause clustering before selecting a fix.

## Phase 2b — Build root-cause clusters

Fetch the latest event for the highest-ranked candidates before deciding scope. For each event retain only: exception type, a normalized message (remove IDs, UUIDs, URLs, and timestamps), culprit, top in-app frame, release, and environment. Do not copy request bodies, user identities, headers, or breadcrumbs into task files.

Group issues only in this order:

| Evidence | Decision |
|---|---|
| Same exception type, normalized message, in-app frame, and culprit | Same cluster. |
| Different exception fingerprints but one demonstrated failing guard/dependency and one code change removes both | Same cluster; write the proof. |
| Same title but different in-app frame, culprit, owning package, or remediation | Keep separate. |
| Same fingerprint in staging and production | Compare causes, but keep release validation and resolution separate. |
| Missing in-app frame or uncertain root cause | Keep separate and investigate the highest-priority issue first. |

Name each cluster `<project>-<top-frame-or-culprit>-<exception-type>`. Keep a cluster in one package unless a reviewed cross-service contract is demonstrably the cause. Record the decision under `.agents/tasks/glitchtip-<cluster-key>.md`:

```markdown
## Cluster <key>
- Issues: #123, #456
- Evidence: shared `path:function` and normalized exception
- Root-cause hypothesis: ...
- Non-members: #789 — same title, different frame
- Acceptance: targeted test + corrected behavior through the affected path
```

With `--all`, complete and verify one cluster before opening the next. It is not permission to mix projects.

## Phase 3 — Triage by level

Pick the target issue(s). Route each by `level`:

| Level | Route | Rationale |
|---|---|---|
| `fatal` | **/apex -a -x -s -pr** + `peaklab.ship-pr` | Production-breaking. Needs systematic multi-agent analysis + adversarial review. |
| `error` | **/apex -a -s -pr** + `peaklab.ship-pr` | Real bug. APEX workflow without adversarial unless count > 10 or affects auth/payment. |
| `warning` | Light fix (direct Edit + commit) + `peaklab.ship-pr` | Usually logging/deprecation/transient I/O. No apex overhead. |
| `info` / `debug` | Resolve on GlitchTip with a comment, no code change | Noise; escalate only if recurrent. |

Extra heuristics that bump a cluster up by one tier:
- `count >= 10` over 24h
- Title/stack references auth, session, payment, GDPR, DB migration
- Appears on more than one deploy (check `lastSeen` vs `firstSeen` spans > 48h)

Extra heuristics that demote an issue by one tier:
- Title/stack references `artisan tinker`, `psysh`, local scripts, or known dev-only paths
- Bot/HEAD requests on public endpoints (e.g. `HttpMethodNotSupported` on GET endpoints)

Never auto-fix a demoted issue — prefer `resolved` with a comment that says why.

## Phase 4 — Fetch full event detail

Before any fix, pull the most recent event to get stack/context:

```bash
ISSUE_ID="<id>"
curl -s -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  "${GLITCHTIP_API}/issues/${ISSUE_ID}/events/latest/" -o /tmp/gt-event.json
python3 -c "
import json; e=json.load(open('/tmp/gt-event.json'))
print('title:', e.get('title'))
print('culprit:', e.get('culprit'))
for entry in e.get('entries',[]):
    if entry.get('type')=='exception':
        for v in entry['data'].get('values',[]):
            print('---',v.get('type'),':',v.get('value'))
            for f in (v.get('stacktrace') or {}).get('frames',[])[-6:]:
                print(f\"  {f.get('filename')}:{f.get('lineNo')} in {f.get('function')}\")
"
```

Save the cluster analysis under `.agents/tasks/glitchtip-<cluster-key>.md` so `/apex -r` can resume if the session ends.

## Phase 5 — Route to fix workflow

### 5a. fatal / error → APEX

Invoke the `apex` skill. Build the task description from the analysis:

```
Skill("apex") with args:
  -a -s -pr  (add -x for fatal)
  <task description including: GlitchTip ID, error type, file:line, root cause hypothesis, acceptance criterion: "no new event of this fingerprint in GlitchTip within 30 min of deploy">
```

Wait for apex to finish its Execute + eXamine phases. If apex opens a PR itself via `-pr`, still complete the PR shipping gate before resolving the GlitchTip issue.

### 5b. warning → Light fix

Skip apex. Edit the file directly, commit on a fix branch:
```bash
git checkout -b fix/glitchtip-<issue-id>-<short-slug>
# Edit...
git commit -m "fix(<scope>): <short message> (GlitchTip #<id>)"
```

### 5c. info / debug or demoted → Skip to Phase 7 with `status:resolved` and a comment

## Phase 6 — Ship the PR

`peaklab.ship-pr` disables model-initiated Skill calls. Stop here and ask the user to explicitly authorize shipping with `ship --plane` or an equivalent direct instruction, then resume only after the PR is merged.

Add `--draft` if the fix needs human review before merge (auth, payment, migrations).

Block here until PR is merged — required before resolving on GlitchTip.

## Phase 7 — Resolve on GlitchTip

```bash
ISSUE_ID="<id>"
PR_URL="<merged-pr-url>"

# Use the global /issues/<id>/ endpoint — project-scoped endpoint returns 404
curl -s -X PUT \
  -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  -H "Content-Type: application/json" \
  "${GLITCHTIP_API}/issues/${ISSUE_ID}/" \
  -d "{\"status\":\"resolved\"}"
```

If `PUT` returns `405`, retry with `PATCH`.

Post a comment with the PR link on the GlitchTip issue (Sentry-compat endpoint):

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${GLITCHTIP_TOKEN}" \
  -H "Content-Type: application/json" \
  "${GLITCHTIP_API}/issues/${ISSUE_ID}/comments/" \
  -d "{\"data\":{\"text\":\"Fixed in ${PR_URL}\"}}"
```

(Comment endpoint may 404 on older GlitchTip — ignore and move on.)

## Phase 8 — Loop or stop

If `--all` was passed, return to Phase 3 with the next independent cluster. Otherwise report and stop. Leave an entire blocked or uncertain cluster unresolved; it must not delay an independent cluster when `--all` was explicitly requested.

## Output format

```
Project: example-app-back (production)
Clusters:
  - authenticate-InvalidToken: #188, #204 fatal → apex -a -x -s -pr → PR #123 merged → resolved
  - publish-TimeoutError: #118 error → apex -a -s -pr → blocked in validation → unresolved
  - health-MethodNotAllowed: #166 error → demoted (bot request) → resolved (no-op)
Inbox remaining: 8
```

## Rules

- Never resolve on GlitchTip before the PR is merged.
- Never bypass review on `fatal` issues — always pass `-x` to apex.
- Never guess a project when multiple match — ask.
- Never commit GlitchTip tokens, PRs, or `/tmp/gt-*.json` dumps.
- Never merge issues based only on matching titles; record the shared stack/culprit or the demonstrated common dependency.
- Do not replace the canonical curl transport with Python `urllib` without verifying it passes this deployment's edge policy.
- If apex fails or PR review blocks, stop, report, and keep the GlitchTip issue unresolved.
- Use `rtk proxy curl` when available to avoid shell transforms; fall back to plain `curl` otherwise.

User: $ARGUMENTS
