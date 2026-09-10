---
name: "peaklab.improve-skill"
description: Use when the user asks to improve, audit, or apply best practices to an agent command (commands/*.md) or skill (skills/*/SKILL.md). Triggers on "apply best practices", "improve this skill/command", "audit", "add XML", "refactor command", or when given a path/glob to a command or skill file.
effort: deep
allowed-tools: Read, Edit, Write, Bash(python3 *)
---

# Improve Skill

<overview>
Audit and rewrite agent commands and skills (Claude Code + Codex compatible) to follow best practices: clear routing metadata, XML structure, English instructions, token efficiency, credential loading order, and verification patterns. Supports single file or batch mode.
</overview>

<constraints>
- Always read the target file(s) before editing
- Audit requests are read-only; apply changes only when the user authorizes implementation
- Evaluate applicable checklist items; mark others N/A instead of adding boilerplate
- Preserve useful behavior and safeguards; document intentional behavior changes and migrate their callers
- Invocation depends on the host: slash command, skill tool, or reading installed instructions; never require one provider's tool
- Never add content that doesn't improve clarity or usability
- After every edit, verify the file passes the validation step
</constraints>

---

<workflow>

## Execution flow

1. **Resolve target** — single file or batch glob → build file list
2. **Detect type** per file (command vs skill)
3. **Run audit checklist** → mark each applicable item pass / fail / N/A; report only actionable findings for audit-only requests
4. **Skip if already compliant** — if all items pass, report "already good" and stop
5. **Apply authorized improvements** in order: contracts and callers → verification and safety → clarity → token efficiency
6. **Validate** — run post-edit checks
7. **Report** fixes, preserved capabilities, intentional changes, verification limits, and size delta (not a measured speed gain)

</workflow>

---

<step name="resolve-target">

## Step 1 — Resolve target

Resolve the actual repository and skill root first: this catalog uses top-level `*/SKILL.md`;
other repositories may use `skills/*/SKILL.md`. Expand relative examples against that root.
A nonexistent path or a glob matching no skills is an input error, never an "already compliant"
result. Audit only the selected repository, not a user's entire installed collection.

Single file:
- `<skill-root>/peaklab.plane-do-issue/SKILL.md` → one file
- `<skill-root>/peaklab.plane-api/SKILL.md` → one file

Batch mode (glob):
- `commands/` → all `commands/*.md`
- `<skill-root>/peaklab.*` → all matching `peaklab.*/SKILL.md` under that root
- `all` → all commands + all skills

For batch: inspect shared contracts and callers together, then validate each changed file and report the combined result.

</step>

---

<step name="detect-type">

## Step 2 — Detect file type

| Signal | Type |
|--------|------|
| Path starts with `commands/` | Command |
| Path contains `/SKILL.md` | Skill |
| Content has YAML frontmatter with `name:` | Skill |

**Command** — user invokes via `/name [args]`, has `$ARGUMENTS`
**Skill** — has YAML frontmatter; invocation varies by host. Both types may use `$ARGUMENTS`, so it is not a type discriminator.

</step>

---

<step name="audit">

## Step 3 — Audit Checklist

<audit_checklist>

### Core function — does the skill do what it claims?
- [ ] `description` triggers match what the body actually does — no promise/behavior drift
- [ ] Body delivers the stated main function end-to-end — every promised capability has a concrete step
- [ ] `name` reflects the main function
- [ ] Examples, globs, and paths referenced in the body exist and are current — no stale names or dead files
- [ ] Single responsibility — secondary features don't dilute the main function; split the skill if they do
- [ ] No overlap or contradiction with sibling skills — one canonical owner per function
- [ ] The skill passes its own rules when they apply to itself (self-consistency)

If any Core function item fails, fix it BEFORE any formatting item — a well-formatted skill that
does the wrong thing is worse than an ugly one that works.

### Language
- [ ] All agent-facing instructions in **English** (frontmatter, constraints, phase logic, step descriptions)
- [ ] User-facing `echo` output and inline code comments may stay in author's language

Auto-detect non-English: scan for French indicators (`quand`, `depuis`, `toujours`, `jamais`, `étape`, `voici`) in instruction text (not inside code blocks or echo strings). Flag any found.

| Element | Required language |
|---------|------------------|
| `description:` frontmatter | English — used for skill discovery |
| Skill/command instruction body | English |
| `echo` / `print` output to user | Any |
| Inline bash/python comments | Any |

### Frontmatter (skills only)
- [ ] `name` present and compatible with the repository's naming convention and supported installers
- [ ] `description` starts with `"Use when..."` — triggering conditions ONLY, not workflow summary
- [ ] `description` third-person, under 500 chars
- [ ] No provider-specific `model` field in shared skill frontmatter
- [ ] `effort` present with one of: `fast`, `standard`, `deep`
- [ ] `allowed-tools` scoped to minimum — no `Bash(*)` wildcards

### Effort convention
- `effort: fast` — lookups, CRUD, status checks, small local utilities, low-risk metadata edits
- `effort: standard` — implementation, debugging, CI, targeted refactors, normal multi-step workflows
- `effort: deep` — architecture, security, code review, product/design audits, high-risk orchestration
- Use effort as routing intent only; do not encode concrete model names in shared skill metadata

### Naming convention
- [ ] Existing public names are preserved; this catalog uses `peaklab.` for org-specific tooling
- [ ] Generic/reusable skills have no prefix (`debug-code`)
- [ ] Directory name matches `name` field in frontmatter

### Structure
- [ ] Markdown or semantic XML makes routing and phase boundaries clear; neither requires converting the other
- [ ] Intent, inputs, constraints, completion states, and relevant references are explicit where needed
- [ ] Optional examples and detailed implementation recipes live in referenced files when that reduces routine loading

### Best Practices
- [ ] Task spec upfront: intent + constraints + acceptance criteria + relevant file locations
- [ ] Subagent patterns explicit where parallel work exists
- [ ] Verification step before marking complete
- [ ] Error paths (`<on_blocked>`, `<on_error>`) explicit for multi-step workflows

### Code Quality
- [ ] Python used instead of bash curl chains for API calls
- [ ] JSON payloads built via `json.dumps()` — never bash string concatenation
- [ ] Credentials use the standard loading pattern (see Step 4)
- [ ] State/config IDs fetched dynamically — never hardcoded
- [ ] Error handling present (try/except or exit codes)

### Token Efficiency
- [ ] No redundant alternatives — one canonical approach per operation
- [ ] No duplicated patterns — extract to variables/functions
- [ ] Tables and gotchas are included only when they prevent a concrete mistake or improve navigation
- [ ] Model-default advice is removed only if it carries no project-specific invariant or useful failure recovery

</audit_checklist>

</step>

---

<step name="skip-check">

## Step 3b — When NOT to improve

Stop and report "already compliant" if:
- All applicable checklist items pass, including caller contracts and referenced resources

Short files and thin wrappers still need contract checks; size alone does not establish correctness.

Do NOT apply changes just to reformat a file that already communicates clearly.

</step>

---

<step name="apply">

## Step 4 — Apply improvements

### Optional XML structure patterns

**Command skeleton:**

    <purpose>One sentence: what this command does end-to-end.</purpose>

    <arguments>
    $ARGUMENTS — accepts:
    - `PREFIX-14` or `14` — sequence ID
    - (empty) — auto-select highest priority
    </arguments>

    <constraints>
    - Rule 1
    - Rule 2
    </constraints>

    <acceptance_criteria>
    - [ ] Criterion 1
    - [ ] Criterion 2
    </acceptance_criteria>

    <step name="setup">
    ...code...
    </step>

    <phase name="ANALYZE">
    - What to do in this phase
    </phase>

    <on_success>
    ...code...
    </on_success>

    <on_blocked>
    ...code...
    </on_blocked>

**Skill skeleton:**

    <overview>
    Core principle in 1-2 sentences.
    </overview>

    <constraints>
    - Non-negotiable rules
    </constraints>

    <bootstrap>
    ```python
    # Setup — run once before any operation
    ```
    </bootstrap>

    <operations>
    ## Quick Reference
    | Operation | Call |
    |-----------|------|

    ## Specific Operation
    ```python
    # example
    ```
    </operations>

    <gotchas>
    | Trap | Fix |
    |------|-----|
    </gotchas>

### Credential loading pattern (generic)

Canonical global env lives in `~/.agents/.env` (never committed, shared by all agents).
Prefer the service's existing shared loader and its documented precedence; do not replace atomic host/token selection with a per-key fallback. For a new independent integration without a loader, exported variables take priority, then project `.env`, then global fallback. Never source env files as shell code or print credentials. The following sketch is not a replacement for service-specific parsing or credential-pair validation:

```python
import os

def load_credentials(*var_names):
    # 1. project .env (project-scoped, wins)  2. ~/.agents/.env (global fallback)
    for path in ('.env', os.path.expanduser('~/.agents/.env')):
        if all(os.environ.get(k) for k in var_names):
            break
        if os.path.exists(path):
            for line in open(path):
                if '=' in line and not line.startswith('#'):
                    k, _, v = line.strip().partition('=')
                    os.environ.setdefault(k, v.strip().strip('"\''))
    missing = [k for k in var_names if not os.environ.get(k)]
    if missing:
        import sys; print(f"Missing: {', '.join(missing)}", file=sys.stderr); sys.exit(1)

load_credentials('MY_TOKEN', 'MY_PROJECT_URL')
```

### Description fix

    # ❌ Describes workflow
    description: Manage Plane issues: create, update status, add comments.

    # ❌ Missing "Use when..."
    description: Interact with the Plane API proactively.

    # ✅ Triggering conditions only, third-person
    description: Use when the user mentions creating, updating, or listing Plane issues,
      references an issue by ID (PREFIX-XX), or asks about project status.

</step>

---

<step name="validate">

## Step 5 — Validate after edit

Run repository checks and relevant helper tests first. Trace changed flags, terminal states, approval, delivery and error paths through callers; use existing contract scenarios where available. Static text checks do not prove an agent executed the workflow correctly. The optional checker below only detects basic formatting issues, not correct XML nesting or behavioral regressions.

```python
import sys, re

def strip_code(text):
    # Remove fenced blocks, 4-space indented blocks, and inline code spans:
    # documented tags/examples must not count as structure
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    text = re.sub(r'^(?:    |\t).*$', '', text, flags=re.M)
    text = re.sub(r'`[^`\n]+`', '', text)
    return text

def validate(path):
    content = open(path).read()
    errors = []

    # YAML frontmatter parseable (skills only)
    if 'SKILL.md' in path:
        import re
        fm = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
        if not fm:
            errors.append("Missing or malformed YAML frontmatter")
        else:
            try:
                import yaml; yaml.safe_load(fm.group(1))
            except Exception as e:
                errors.append(f"YAML parse error: {e}")

    # XML tags balanced (count-based: nesting order is legal, only missing tags are errors)
    from collections import Counter
    body = re.sub(r'^---\n.*?\n---\n', '', content, count=1, flags=re.DOTALL)
    structural = strip_code(body)
    opens  = re.findall(r'<(\w[\w-]*)(?:\s[^>]*)?>',  structural)
    closes = re.findall(r'</(\w[\w-]*)>', structural)
    # Filter out self-closing and HTML void elements
    void = ('br','hr','img','input','meta','link')
    paired_opens  = Counter(t for t in opens  if t not in void)
    paired_closes = Counter(t for t in closes if t not in void)
    if paired_opens != paired_closes:
        diff = (paired_opens - paired_closes) + (paired_closes - paired_opens)
        errors.append(f"Unbalanced XML tags: {dict(diff)}")

    # English check on instruction text (outside code blocks and code spans)
    no_code = strip_code(content)
    french_words = re.findall(r'\b(quand|depuis|toujours|jamais|étape|voici|utiliser|toutes|lors)\b', no_code, re.I)
    if french_words:
        errors.append(f"Possible French instructions found: {set(french_words)}")

    return errors

errors = validate(sys.argv[1])
if errors:
    for e in errors: print(f"  ❌ {e}")
    sys.exit(1)
else:
    print("  ✅ Validation passed")
```

Run as: `python3 -c "..." path/to/file.md`

</step>

---

<step name="report">

## Step 6 — Output report

Single file:

    File: skills/peaklab.plane-do-issue/SKILL.md
    Type: skill

    Fixes applied:
    - [x] Translated instructions to English
    - [x] Added XML structure (<purpose>, <constraints>, <step>, <phase>)
    - [x] Replaced bash curl chains with Python api() helper
    - [x] Reused shared credential loading (exports, project .env, global fallback)
    - [x] Added <acceptance_criteria>
    - [x] Added <on_blocked> error path
    - [ ] Subagent patterns — not applicable

    Size delta: 438 → 187 lines; list checks passed and remaining behavioral validation limits

Batch summary:

    | File                          | Type    | Fixes | Lines before→after | Status |
    |-------------------------------|---------|-------|--------------------|--------|
    | skills/peaklab.plane-do-issue/SKILL.md | skill   | 6     | 438 → 187          | ✅     |
    | skills/peaklab.plane-api/SKILL.md     | skill   | 3     | 95 → 91            | ✅     |
    | skills/peaklab.infra-config/... | skill   | 0     | 42 → 42            | already compliant |

</step>

---

<gotchas>

| Trap | Fix |
|------|-----|
| `$ARGUMENTS` literals in a SKILL.md body get substituted with the invocation args — the loaded skill text is corrupted | Always Read the target file from disk; never audit from the injected skill body |
| Auditing this skill with itself: the loaded copy shows substituted placeholders | Same fix — Read from disk |
| `import yaml` may be missing from system python | Fall back to a frontmatter regex sanity check if `yaml` import fails |
| Ordered-list tag comparison flags legal nesting as unbalanced | Validator uses `Counter` — count-based, order-insensitive |
| Renaming public skills leaves stale callers and installation dependencies | Preserve names unless requested; search the catalog, dependency manifest and installed callers after an authorized rename |

</gotchas>
