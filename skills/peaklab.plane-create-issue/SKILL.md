---
name: "peaklab.plane-create-issue"
description: "Draft or create a validated Plane issue, checking for duplicates before creation."
effort: standard
argument-hint: "[title or request] [--priority=none|low|medium|high|urgent]"
allowed-tools: "Bash(rtk :*), Read, Write, Edit, Skill"
---

<objective>
Create one clear, actionable Plane work item from the current request and return its `PREFIX-SEQ_ID` and URL. This skill is the only path for creating Plane issues.

Configuration, credentials, the shared client, state resolution and name-to-ID resolution are owned by [peaklab.plane-api](../peaklab.plane-api/SKILL.md); load it and follow its rules rather than restating them here.
</objective>

<quick_start>
Resolve `PLANE_CREATE_SKILL_DIR` to the absolute directory of this loaded `SKILL.md` and check that [scripts/create_issue.py](scripts/create_issue.py) and the sibling plane-api package exist. Run commands from the target project's checkout.

1. Load `peaklab.plane-api` for configuration, client and metadata lookup only.
2. Search existing issues for a duplicate (step 2) before drafting.
3. Choose a unique `SESSION_ID`, run `rtk mkdir -p /private/tmp/plane-create-issue/SESSION_ID`, and write a fresh `payload.json` there with the file-editing tool (never interpolate JSON or HTML into a shell command, never reuse an earlier payload). `name` is required.
4. Validate without contacting Plane:

```bash
rtk python3 "$PLANE_CREATE_SKILL_DIR/scripts/create_issue.py" --dry-run /private/tmp/plane-create-issue/SESSION_ID/payload.json
```

5. When the user explicitly requested creation, execute exactly once:

```bash
rtk python3 "$PLANE_CREATE_SKILL_DIR/scripts/create_issue.py" --request-id SESSION_ID /private/tmp/plane-create-issue/SESSION_ID/payload.json
```

6. Report the result (step 6), then `rtk rm -f` the payload and `rtk rmdir` its session directory.
</quick_start>

<mutation_gate>
- Create only when the user explicitly asks to create, file, open or add the issue to Plane. For a draft, preview or wording request, stop after the dry run and show the draft.
- Do not add a redundant confirmation when creation is explicit and context is sufficient. Ask one concise question only when a missing fact would materially change the issue.
- Attachments, comments and cycle assignment are follow-ups on the returned `ISSUE_ID`; they never trigger another creation. The create schema has no cycle field. Use `peaklab.plane-do-issue` when the user wants the ticket implemented.
</mutation_gate>

<workflow>
<step_1_intake>
Use the current request only. A concrete title, or enough to derive one, is required; outcome, acceptance criteria, priority, scope, links and requested metadata are optional. Default `priority` to `none` and omit other unset fields so project defaults apply.

For a bug (`fix(...)` title or defect report), two fields are mandatory because quality analytics reads them:

- One origin label: `source/client` (customer or support), `source/qa` (qa-tracker, recette), `source/glitchtip` (production error), `source/interne` (team, audit, review). Infer it; ask only when nothing indicates the origin.
- A calibrated `priority`, never `none`:
  - `urgent`: production blocked, data loss or leak, payment broken, no workaround. Target fix within 48 h.
  - `high`: a main flow broken for some users, or a costly workaround. Target within 14 days.
  - `medium`: degraded but usable, secondary flow, cosmetic on a main screen.
  - `low`: cosmetic, edge case, internal tooling.
</step_1_intake>

<step_2_duplicate_check>
Before drafting, list open issues with the plane-api client and compare titles and intent. If a likely duplicate exists, show its identifier and link and ask whether to create anyway, update it, or stop.
</step_2_duplicate_check>

<step_3_description>
Title: `type(scope): description` when the repository uses that convention; preserve a clear user-supplied title when normalizing would change its meaning.

When the request references code, an error or a feature area, read the smallest relevant scope first. Never invent a root cause, affected file or acceptance criterion; label uncertain guidance as a proposal or omit it.

`description_html` uses semantic HTML with only the sections that add value:

```html
<h2>Objectif</h2>
<p>What should change and why.</p>
<h2>Contexte</h2>
<p>Observed behavior, constraints, or reproduction evidence.</p>
<h2>Critères d’acceptation</h2>
<ul>
  <li>Specific, verifiable outcome.</li>
</ul>
<h2>Notes techniques</h2>
<p>Evidence-backed implementation context, when useful.</p>
```

HTML-escape literal user text, URLs, logs and code before embedding them.
</step_3_description>

<step_4_metadata>
Supported fields: `name`, `description_html`, `priority`, `state`, `assignees`, `labels`, `parent`, `estimate_point`, `type`, `module`, `start_date`, `target_date`. Resource fields take IDs: resolve user-supplied names through the plane-api ID resolution rules (ask on zero or several matches; never create missing resources unless separately requested).
</step_4_metadata>

<step_5_creation>
Fix every dry-run error first; the dry run never loads credentials or contacts Plane.

The helper probes with GET, prefers the `/work-items/` collection and falls back to `/issues/` only on 404/405; auth, rate-limit and server errors stop discovery. It performs exactly one POST. `--request-id SESSION_ID` writes an atomic pending receipt under `${XDG_STATE_HOME:-~/.local/state}/plane-create-issue/attempts/` before the POST: replaying the same ID and payload after success returns the stored result, while pending or uncertain receipts block replay.

After `CREATED=1`, reuse the returned `ISSUE_ID` for every follow-up and never call the creation helper again for this request.
</step_5_creation>

<step_6_result>
Reply with `PREFIX-SEQ_ID`, the title, the direct Plane URL, the priority and any metadata applied, plus any requested metadata omitted because it could not be resolved. Remove only this request's temporary payload.
</step_6_result>
</workflow>

<duplicate_safety>
- One invocation creates at most one work item; validation may repeat, creation may not.
- Pass the same `SESSION_ID` through `--request-id`; never mint a new ID to bypass a pending or uncertain receipt.
- Never retry a POST after a timeout, connection drop, invalid response or server error. Search Plane read-only by exact title and recent creation time, and resume only after proving nothing was created.
- If Plane rejects the POST with a 4xx, correct the payload and use a new request ID (the rejected receipt is immutable).
- Retry a failed follow-up (attachment, comment, label, cycle) against the existing `ISSUE_ID`, never with a replacement issue.
</duplicate_safety>

<validation>
For skill maintenance:

```bash
rtk python3 -m unittest discover -s "$PLANE_CREATE_SKILL_DIR/scripts" -p 'test_*.py'
```

The tests cover helper behavior, atomic configuration loading, replay protection, skill structure, canonical creation routing and RTK compliance, without credentials or network calls.
</validation>

<success_criteria>
- Exactly one work item is created when explicitly requested, zero for drafts, and no likely duplicate was ignored.
- The payload passed the dry run, and metadata IDs were resolved, not guessed.
- The title and description reflect the current request with verifiable acceptance criteria when appropriate.
- The helper returned `CREATED=1`, `ISSUE_ID`, `SEQ_ID` and `URL`, reported as issue number plus link.
- No credential, stale payload, duplicate issue or unrelated file change was introduced.
</success_criteria>
