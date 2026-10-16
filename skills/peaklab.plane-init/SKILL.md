---
name: "peaklab.plane-init"
description: "Initialize a Plane project with standard modules, labels and weekly cycles."
effort: fast
argument-hint: "[--modules-only] [--labels-only] [--cycles-only] [--cycles=N] [--dry-run]"
allowed-tools: "Bash(python3 :*), Bash(rtk :*), Read, Skill"
---

# Initialize Plane Project

Create the standard modules, labels and weekly cycles on a Plane project. Configuration,
credentials and the shared client come from [peaklab.plane-api](../peaklab.plane-api/SKILL.md);
load it first.

## Options

- `--modules-only`, `--labels-only`, `--cycles-only`: limit the run to one kind of item.
- `--cycles=N`: number of weekly cycles (default 4).
- `--dry-run`: show what would be created without creating anything.

## Defaults

The source of truth is `init_project.py` in the plane-api package:

- **Modules:** Config / VPS, Deploy Project, Mise à jour du projet, Design de la maquette,
  Intégration du design, Testing / Livraison.
- **Labels:** feat, fix, config, frontend, backend, urgent, blocker.
- **Cycles:** weekly, starting next Monday, named `{Mois}-S{week of month}` (e.g. `Mars-S1`).

## Process

1. Resolve `PLANE_API_DIR` to the absolute directory of the loaded plane-api package and run from
   the target project's checkout so its configuration is used:

   ```bash
   python3 "$PLANE_API_DIR/init_project.py" [options]
   ```

   The script is idempotent: it fetches existing modules, labels and cycles, skips any name that
   already exists (case-insensitive), and sends the `owned_by` and `project_id` body fields that
   `POST /cycles/` requires. Always use it; do not hand-roll cycle creation with curl.

2. Report one line per item: ✓ created, ○ already exists, ✗ failed (with the error).

## Done when

Every default module, label and requested cycle exists, no duplicate was created, and the summary
was shown.
