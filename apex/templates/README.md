# Legacy APEX output templates

These templates support APEX v1 multi-file saved runs and `-r` compatibility. Modern runs treat `.claude/output/apex/` as read-only and keep canonical state in the caller's harness task artifact.

## Legacy initialization

`../scripts/setup-templates.sh` accepts:

```text
feature_name task_description auto_mode examine_mode save_mode test_mode
tdd_mode economy_mode branch_mode pr_mode interactive_mode tasks_mode
branch_name original_input
```

It creates `.claude/output/apex/NN-feature-name/`, renders `00-context.md` and the enabled phase templates, then prints `TASK_ID` and `OUTPUT_DIR`.

## Legacy progress updates

```bash
bash ../scripts/update-progress.sh TASK_ID STEP_NUMBER STEP_NAME in_progress
bash ../scripts/update-progress.sh TASK_ID STEP_NUMBER STEP_NAME complete
```

The updater modifies the progress table in the legacy `00-context.md`. New runs should update their single state artifact at phase boundaries instead.

## Compatibility rules

- Keep placeholder names and numbered template filenames stable for old resume directories.
- Do not introduce new workflow logic here; the canonical workflow lives in `../SKILL.md` and `../steps/`.
- These scripts are compatibility utilities, not idempotent modern state management.
