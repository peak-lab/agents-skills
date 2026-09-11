# Distribution

The catalogue has one skill source tree, `skills/`, and paired native agent definitions under
`agents/claude/` and `agents/codex/`. Repository scripts validate and install these artifacts;
this is not a replacement for the `skills` CLI or either coding agent.

`.agents/skills/` is a shared skill installation location, not a universal agent-definition
registry. A personal `.agents/agents/` directory can be a source of truth with explicitly configured
links, but these packages target the documented native `.claude/agents/` and `.codex/agents/` paths.

## Editable installation: all supported hosts

From a reviewed checkout of this repository, install the skills with:

```bash
npx skills add . --skill '*' --agent codex claude-code
```

This example installs into the current project. For another project, run the command there and
replace `.` with the absolute path of the catalogue checkout. Add `-g` only when you deliberately
want user-wide skills. The skill installer does not install custom agent definitions.

For optional native agents, follow [the agent installation guide](agents.md). Their installer
requires an explicit target project and refuses conflicting files. Neither installation path
should overwrite personal changes without a deliberate decision.
After first installation, its `update` command uses recorded baselines to update unchanged agents
without overwriting local customizations. The TypeScript CLI is built with Bun for Node 24 and
copies definitions from its checkout or npm package; it does not fetch Git or install skills.

## Managed Claude Code plugin

After these manifests are published to the repository, add the repository marketplace and install
the plugin from a Claude Code session:

```text
/plugin marketplace add peak-lab/agents-skills
/plugin install peaklab@peaklab-skills
```

For a local development session, pass the absolute catalogue checkout path:

```bash
claude --plugin-dir /absolute/path/to/agents-skills
```

The plugin loads the same `skills/` packages and the explicit Claude agent files listed in
`.claude-plugin/plugin.json`. It does not install Codex agents or change user settings through hooks.

Claude scopes plugin components, for example `peaklab:apex` and `peaklab:code-reviewer`.
When a workflow names a canonical role, select its actual registered name from the host's available
agents, including the plugin prefix. Do not invent an unavailable bare-name agent type. If a
specialist cannot be resolved, use the workflow's documented generic/inline fallback.
Resolve called skills through the installed catalogue and read their resources from that location;
`skill://` references are logical identifiers, not executable filesystem paths.

Choose plugin installation OR editable installation for a given Claude project to avoid duplicate
skills and agents. The native project installation is preferable when exact unprefixed names or
local customization are required. Plugin validation checks packaging, not end-to-end agent behavior.

## Maintenance

Keep public names stable across both channels. Update `.claude-plugin/plugin.json` when adding or
removing an agent; increment the plugin version for a published change. Do not imply a repository
change has updated an existing install. Review and reinstall/update explicitly.

References: [skills CLI](https://github.com/vercel-labs/skills),
[Claude plugins](https://code.claude.com/docs/en/plugins-reference),
[Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
