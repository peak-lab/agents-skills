---
name: step-00b-save
description: Create or update one resumable APEX state artifact
returns_to: step-00-init.md
---

# Optional setup: save

Run only when `{save_mode}` is true.

<modern_state>
Use the canonical task artifact selected during initialization; do not create a parallel state file. Save mode retains these expanded resume fields in it:

- request, flags, base SHA, initial dirty paths, and owned paths;
- acceptance criteria and links to caller-owned issue/plan artifacts;
- vertical plan slices with status and ownership, `{plan_revision}`, and `{approved_plan_revision}` when approval was obtained;
- validation evidence with command, scope, result, and code/config/environment fingerprint;
- active workers and the next step.

`{task_id}` is set by initialization. Update the artifact at phase boundaries only.
</modern_state>

<legacy_compatibility>
For `-r`, accept directories produced by `scripts/setup-templates.sh` as read-only inputs. Read `00-context.md` first and consult numbered phase files only to recover missing state into the canonical artifact; do not update or copy their phase logs. Ordinary modern runs do not load `templates/` or invoke the scripts.
</legacy_compatibility>

Set `{output_dir}` to the canonical task artifact's parent directory for caller compatibility, then return to `step-00-init.md`.
