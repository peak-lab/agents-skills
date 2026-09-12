# Skill context measurements

Use the repository-only, read-only helper to inspect the source size of the
catalogue before selecting skills:

```bash
bun scripts/skill-context.ts
bun scripts/skill-context.ts --skill peaklab.plane-do-issue
```

The first command reports every `SKILL.md`; the second reports the named skill
and every dependency reachable through `skill-dependencies.json`. Output shows
UTF-8 bytes for each `SKILL.md` and the number of Unicode characters in its
frontmatter `name` plus `description`. These are measurements, not token
counts. A selected report also prints a portable `npx skills add` command for
the complete closure. It only prints the command; it does not run an install or
modify any host configuration.

Run the printed command from the catalogue checkout root, where `.` identifies
the catalogue. To install into another project, run the equivalent command in
that project and replace `.` with the absolute path to the catalogue checkout.

Install every printed package together, including its bundled `scripts/` and
`references/`. The dependency manifest describes required composition, so a
smaller selection that omits a transitive dependency is incomplete.

Host behavior differs:

- In Claude Code, `disable-model-invocation: true` removes a skill description
  from the automatic listing and prevents Claude from invoking the skill. A
  user can still invoke it explicitly, so use this setting only when automatic
  calls must be disabled.
- In Codex, `agents/openai.yaml` policy
  `allow_implicit_invocation: false` prevents only implicit invocation; an
  explicit `$skill` invocation remains available. This policy does not promise
  to remove the skill description from Codex's discovery context.
- A skill disabled in its host configuration is not automatically available,
  regardless of whether its package appears in the selected dependency closure.

See [Build skills](https://learn.chatgpt.com/docs/build-skills) for Codex skill
discovery and invocation policy, and [Claude Code skills](https://code.claude.com/docs/en/skills)
for Claude Code frontmatter behavior.
