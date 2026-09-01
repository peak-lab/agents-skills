---
name: "peaklab.plane-init"
description: "Use when bootstrapping a new Plane project with its standard modules, labels, and weekly cycles."
effort: fast
argument-hint: "[--modules-only] [--labels-only] [--cycles-only] [--cycles=N]"
allowed-tools: "Bash(python3 :*), Bash(rtk :*), Read, Skill"
---

# Initialize Plane Project

Setup standard modules, labels, and cycles for a new Plane project.
Load `peaklab.plane-api` first for configuration, authentication, and the shared client.

Setup standard modules, labels, and cycles for a new Plane project.

## Arguments

If no arguments provided, use the default modules, labels, and cycles listed below.

**Options:**
- `--modules-only`: Only create modules
- `--labels-only`: Only create labels
- `--cycles-only`: Only create cycles
- `--cycles=N`: Number of weekly cycles to create (default: 4)
- `--dry-run`: Show what would be created without actually creating anything

<objective>
Initialize a Plane project with standard modules, labels, and cycles. This skill is idempotent — it skips items that already exist.
</objective>

<critical_rules>
## CRITICAL: Idempotent Execution

- ALWAYS fetch existing modules, labels, and cycles BEFORE creating new ones
- SKIP any module, label, or cycle that already exists (match by name, case-insensitive)
- Report skipped items clearly so the user knows what was already there

## CRITICAL: Dynamic Configuration

- Read PLANE_TOKEN and PLANE_PROJECT from `.env`
- Parse workspace, project ID, and host from PLANE_PROJECT URL
- NEVER hardcode any IDs
</critical_rules>

<default_modules>
| Name | Description |
|------|-------------|
| Config / VPS | Configuration serveur, infrastructure VPS, environnements |
| Deploy Project | Déploiement du projet, CI/CD, mise en production |
| Mise à jour du projet | Mises à jour techniques, dépendances, migrations |
| Design de la maquette | Conception UI/UX, maquettes, prototypes |
| Intégration du design | Intégration des maquettes, développement frontend |
| Testing / Livraison | Tests, QA, recette, livraison client |
</default_modules>

<default_labels>
| Name | Color |
|------|-------|
| feat | #4caf50 |
| fix | #f44336 |
| config | #9c27b0 |
| frontend | #2196f3 |
| backend | #ff9800 |
| urgent | #d32f2f |
| blocker | #b71c1c |
</default_labels>

<default_cycles>
By default, 4 weekly cycles are created starting from the next Monday.

**Naming format:** `{Mois}-S{numéro semaine du mois}`

Example (if today is Feb 19):
| Cycle | Start | End |
|-------|-------|-----|
| Février-S4 | 2026-02-23 | 2026-03-01 |
| Mars-S1 | 2026-03-02 | 2026-03-08 |
| Mars-S2 | 2026-03-09 | 2026-03-15 |
| Mars-S3 | 2026-03-16 | 2026-03-22 |

Use `--cycles=N` to change the number of cycles (e.g., `--cycles=8` for 2 months).
</default_cycles>

<api_notes>
## Plane API Gotchas

These are known quirks discovered during usage. The Python helper script handles them automatically.

### Cycles API requires extra fields
The `POST /cycles/` endpoint requires fields NOT present in the URL:
- `owned_by` (string, UUID): The user ID who owns the cycle. Fetch via `GET /users/me/`
- `project_id` (string, UUID): The project UUID — must be in the body, not just the URL

Without these fields, the API returns HTTP 400 with unhelpful error messages like `"Project ID is required"` or `"This field is required"` for `owned_by`.

### Paginated responses
All list endpoints return paginated responses with `{ results: [...] }`, not raw arrays.
</api_notes>

<process>

### 1. Run the Python helper script

The Python script handles everything: config parsing, idempotent checks, API quirks, and summary output.

```bash
python3 ~/.agents/skills/peaklab.plane-api/init_project.py
```

Pass arguments if needed:
```bash
python3 ~/.agents/skills/peaklab.plane-api/init_project.py --modules-only
python3 ~/.agents/skills/peaklab.plane-api/init_project.py --cycles=8
python3 ~/.agents/skills/peaklab.plane-api/init_project.py --dry-run
```

The script:
1. Reads `.env` for PLANE_TOKEN and PLANE_PROJECT
2. Fetches existing modules, labels, and cycles (skips duplicates)
3. Fetches current user via `/users/me/` (needed for cycle `owned_by`)
4. Creates missing items with correct API payloads
5. Prints a summary table

### 2. Display Result

Show a table with status for each item:
- ✓ Created
- ○ Already exists
- ✗ Failed (with error)

**IMPORTANT:** Always use the Python script. Do NOT use bash curl for cycles — the API requires `owned_by` and `project_id` body fields that are easy to miss.

</process>

<success_criteria>
- All default modules exist on the project (created or already present)
- All default labels exist on the project (created or already present)
- All default cycles exist on the project (created or already present)
- No duplicates created
- Clear summary displayed to user
</success_criteria>
