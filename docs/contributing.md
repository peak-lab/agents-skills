# Contributing

Work from the repository root. Repository tooling uses Bun; the packaged CLI targets Node 24+.
Python helpers target Python 3.13+.

```bash
cd /path/to/agents-skills
bun install --frozen-lockfile
```

Keep selectable packages in `skills/<name>/SKILL.md`. Preserve public names, keep bundled
resources with their owning skill, and declare cross-skill dependencies in
[`skill-dependencies.json`](../skill-dependencies.json). Do not add personal configuration,
credentials, or company-specific instructions to the catalogue.

## Validation

Run the relevant checklist below from the repository root. Before claiming a package migration
is complete, run every command below, including all helper suites and evaluation schema checks.
For documentation-only changes, check links and command examples with `bun run check:portability`
and `git diff --check`; the full validation sequence below is also available.

### Any catalogue change

```bash
bun run typecheck
bun test
bun run build
node dist/cli.js --help
bun run smoke:package
npx skills add . --list
bun run check:portability
```

### TypeScript tooling, evaluation runner, or packaging changes

Run the any-catalogue checks, then:

```bash
bun run eval:check
```

### Python helper changes

Run the any-catalogue checks, then run the helper suite(s) affected by the change:

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 -m unittest discover -s skills/apex -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-do-issue -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-api -p 'test_*.py'
python3 -m unittest discover -s skills/peaklab.plane-create-issue/scripts -p 'test_*.py'
python3 -m py_compile skills/peaklab.coolify-api/scripts/coolify.py skills/peaklab.plane-api/*.py
```

### Skill instructions, native agents, or workflow changes

Run the any-catalogue checks and review the relevant [workflow contract scenarios](contract-scenarios.md).
For behavior changes, add a realistic case where appropriate and use the
[controlled evaluation runner](skill-evaluations.md). Static checks and helper tests do not
prove model behavior; model evaluations require explicit execution and bounded budgets.

For a new or imported skill, start with [local skill intake](skill-intake.md). For generated
project-rule assets, follow the [shared rule-template guidance](rule-templates.md).
Use [skill quality and evaluation](skill-quality.md) for maintenance criteria and evidence
expectations. Publishing the native-agent CLI is a separate release step.
