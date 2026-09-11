---
paths:
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.ts"
  - "**/*.tsx"
  - "biome.json"
  - "biome.jsonc"
---

# Biome

Scope: JavaScript and TypeScript projects using Biome.

- Use the repository's checked-in Biome configuration and scripts as the source of truth.
- Run formatting, linting, and import organization through the configured command rather than relying on editor defaults.
- Keep ignores narrow and justified; do not exclude generated, vendored, or source files broadly to silence findings.
- Prefer an explicit lint suppression with a reason when an exception is necessary, and keep it as local as possible.
- Do not combine a tool migration or wholesale reformat with an unrelated feature change.
