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
- Apply ALL checklist items — do not skip any
- Preserve all existing functionality — improve structure, not behavior
- Commands use `$ARGUMENTS` and are user-invoked (`/name`); skills are agent-invoked via `Skill("name")`
- Never add content that doesn't improve clarity or usability
- After every edit, verify the file passes the validation step
</constraints>

---

<workflow>

## Execution flow

1. **Resolve target** — single file or batch glob → build file list
2. **Detect type** per file (command vs skill)
3. **Run audit checklist** → mark each item ✅ / ❌
4. **Skip if already compliant** — if all items pass, report "already good" and stop
5. **Apply improvements** in order: language → XML → credential pattern → code quality → token efficiency
6. **Validate** — run post-edit checks
7. **Report** fixes applied + token delta

</workflow>

---

<step name="resolve-target">

## Step 1 — Resolve target

Single file:
- `skills/peaklab.plane-do-issue/SKILL.md` → one file
- `skills/peaklab.plane-api/SKILL.md` → one file

Batch mode (glob):
- `commands/` → all `commands/*.md`
- `skills/peaklab:*` → all `skills/peaklab:*/SKILL.md`
- `all` → all commands + all skills

For batch: run Steps 2–7 for each file independently, then print a summary table.

</step>

---

<step name="detect-type">

## Step 2 — Detect file type

| Signal | Type |
|--------|------|
| Path starts with `commands/` | Command |
| Path contains `/SKILL.md` | Skill |
| Content contains `$ARGUMENTS` | Command |
| Content has YAML frontmatter with `name:` | Skill |

**Command** — user invokes via `/name [args]`, has `$ARGUMENTS`
**Skill** — the agent invokes via `Skill("name")`, has YAML frontmatter

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
- [ ] `name` field present — letters, numbers, hyphens, plus an optional `namespace:` prefix; quote names containing `:` in YAML
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

### Naming convention — `peaklab:` prefix
- [ ] Skills specific to this org's tooling use `peaklab:` prefix (`peaklab.improve-skill`)
- [ ] Generic/reusable skills have no prefix (`peaklab.plane-api`, `debug-code`)
- [ ] Directory name matches `name` field in frontmatter

### XML structure
- [ ] Top-level sections use semantic XML tags, not bare Markdown headers
- [ ] Commands have: `<purpose>`, `<arguments>`, `<constraints>`, `<acceptance_criteria>`
- [ ] Skills have: `<overview>`, `<constraints>`, `<workflow>` (if multi-step)
- [ ] Named step tags used: `<step name="X">`, `<phase name="X">`
- [ ] Bash/Python blocks wrapped in named tags: `<setup>`, `<bootstrap>`, `<on_merged>`, `<on_blocked>`

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
- [ ] Quick Reference table present for multi-operation skills
- [ ] `<gotchas>` or common mistakes section present

</audit_checklist>

</step>

---

<step name="skip-check">

## Step 3b — When NOT to improve

Stop and report "already compliant" if:
- All checklist items pass
- File is under 50 lines and already clear
- File is a thin wrapper that delegates entirely to another skill

Do NOT apply changes just to reformat a file that already communicates clearly.

</step>

---

<step name="apply">

## Step 4 — Apply improvements

### XML structure patterns

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
Project `.env` holds project-scoped values and takes priority. Replace any other loading with:

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
    structural = strip_code(content)
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
    - [x] Updated credential loading (~/.agents/.env first, project .env fallback)
    - [x] Added <acceptance_criteria>
    - [x] Added <on_blocked> error path
    - [ ] Subagent patterns — not applicable

    Token delta: 438 → 187 lines  ✅ validation passed

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
| Renamed skills (`peaklab.x` → `peaklab:x`) leave stale references in sibling skills | Grep `~/.agents` for the old name after any rename |

</gotchas>
