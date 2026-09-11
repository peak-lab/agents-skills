# Catalogue maintenance

This repository distributes reusable skills and optional native agent definitions, not a coding-agent runtime.

- Keep selectable packages in `skills/<name>/SKILL.md`; preserve public names unless a migration is explicitly approved.
- Bundle runtime resources inside their owning skill. Declare cross-skill dependencies in `skill-dependencies.json` and link required resources with relative Markdown links.
- Keep repository-only validation in `scripts/` and contributor documentation in `docs/`.
- Native agent definitions belong in `agents/claude/` and `agents/codex/`. Keep paired roles behaviorally equivalent while using each host's supported metadata.
- Do not copy personal configuration, credentials, private service URLs or company-specific agent instructions into the catalogue.
- Packaging changes must preserve workflow behavior, review gates and explicit authorization boundaries.
- Do not modify installed user skills or agent configuration as a side effect of repository development.
- Run the discovery, portability and test commands in `README.md` before claiming a migration complete. Native runtime execution and static validation are different evidence; report which was tested.

## Applicable implementation rules

Before changing TypeScript files, read [.agents/rules/typescript.md](.agents/rules/typescript.md).
Before changing Python files, read [.agents/rules/python.md](.agents/rules/python.md).
These are explicit read instructions, not automatic Markdown imports. Do not load unrelated
framework templates when maintaining this catalogue.

Repository tooling uses TypeScript/Bun; the packaged native-agent CLI targets Node 24.
Keep bundled Python service helpers compatible with the declared Python 3.13+ baseline.
Rules are regenerated from the bundled sync-ai-docs templates; see
[regeneration instructions](docs/rule-templates.md) before updating them.
