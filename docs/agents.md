# Agents

This catalogue also publishes a deliberately small set of native subagent adapters. They cover
the generic issue, review, and Plane workflows bundled here; they do not reproduce private
company or service-specialist agents.

Each adapter is only a role boundary. It resolves its owning installed skill by canonical name via
the harness registry, then reads `<resolved skill directory>/SKILL.md` before doing work. This
avoids treating a `skill://` identifier as an executable path and keeps the installed skill
contract authoritative.

## Install directly into a project

The installer never writes to a global harness directory. Choose a project explicitly; preview is
the default, and `--apply` is required to write:

```bash
bun run src/cli.ts install --target /path/to/project --agent codex
bun run src/cli.ts install --target /path/to/project --agent claude-code --apply
```

It writes to `.codex/agents/` for Codex and `.claude/agents/` for Claude Code. It refuses missing
targets, symlinked destination components, non-directory destination components, and any existing
agent filename on a first install; there is intentionally no force option. Direct installation preserves bare names
such as `code-reviewer` and `plane-issue-worker`.

## Update installed agents

Use a reviewed, up-to-date checkout or packaged release as the source. The CLI does not fetch Git
or update skills; it copies native definitions bundled alongside that CLI version.

```bash
# Preview changes; writes nothing.
bun run src/cli.ts update --target /path/to/project --agent codex
# Apply the same update after checking the preview.
bun run src/cli.ts update --target /path/to/project --agent codex --apply
```

Use `--agent claude-code` for native Claude agents. Managed plugin installations use Claude's
plugin update mechanism instead; do not combine the two installation channels.

The CLI is TypeScript developed, tested and built with Bun. The distributed JavaScript executable
runs on Node 24+, so consumers do not need Bun or Python. After the package has actually been
published under the proposed `@peak-lab/agents` name, these commands will be available:

```bash
npx @peak-lab/agents@latest install --target /path/to/project --agent codex --apply
npx @peak-lab/agents@latest update --target /path/to/project --agent codex
npx @peak-lab/agents@latest update --target /path/to/project --agent codex --apply
```

Publication is a separate release step, not performed by building this repository. The package is
currently marked `private: true` to prevent accidental publishing; choose the release name/version
and remove that guard only as part of an explicitly authorized release. Pin a reviewed
package version instead of `@latest` for reproducible team rollouts. The old `--update` argument is
also accepted by the new CLI; the retired Python entrypoint is not retained.

The first installation records SHA-256 baselines in `.peaklab-agent-state.json` inside the native
agent directory. Keep this file with the installed definitions (including in version control if
the project tracks its agents). Do not edit hashes to bypass a conflict.
Existing version-1 state files written by the former Python installer remain compatible.

- A tracked, locally unchanged definition can be updated; identical versions are skipped.
- New catalogue agents are installed, but unknown existing files are never adopted or overwritten.
- A local edit or deletion blocks the entire planned update before writes. Back up your changes
  and reconcile them explicitly; the script does not merge prompts.
- Agents removed from the catalogue and unrelated project agents remain untouched.
- Older installations without the state file cannot be updated automatically, even if their files
  currently match. Back up the old definitions, compare them with a fresh installation in a separate
  project, then deliberately migrate the selected definitions and their matching state together.

Do not run installers concurrently or edit their targets while applying. Before any definitions are
changed, the installer records a durable `.peaklab-agent-recovery.json` journal beside the state
file. If the process is interrupted, rerun the same preview or apply command against the same
catalogue version: preview reports the remaining work without modifying anything, and `--apply`
safely completes it before removing the journal. The installer refuses recovery if the journal,
state, definitions, source definitions, or any destination path has changed or is symlinked; in
that case, preserve the files and resolve the conflict manually rather than deleting or editing the
journal to force an overwrite.

## Claude plugin scope

When shipped in this catalogue's Claude plugin, Claude Code scopes agent names to the plugin:
`peaklab:code-reviewer`, `peaklab:plane-issue-worker`, and so on. Use direct installation when
an existing workflow requires bare names. This is a Claude Code plugin behavior, not an aliasing
feature supplied by this repository.

## Role and model map

| Role | Intent | Claude Code | Codex |
| --- | --- | --- | --- |
| `code-reviewer`, `issue-resolver`, `issue-resolver-deep`, `issue-qa-reviewer`, `plane-epic-planner`, `plane-story-planner` | deep | opus / high | gpt-5.6-sol / high |
| All other bundled roles | standard | sonnet / medium | gpt-5.6-terra / medium |

Claude's `effort` accepts its native `high` and `medium` values. The shared intent is retained in
each adapter's instruction body and tested against Codex routing; it is not presented as a Claude
frontmatter value. Codex uses standalone TOML files with `name`, `description`,
`developer_instructions`, `model`, and `model_reasoning_effort`.

## Limits

The adapters do not grant tools, credentials, or permission overrides. The spawned agent inherits
the harness and project runtime policy. Shipping or merging remains explicit user authorization;
the watcher roles do not create cron jobs or deferred monitoring.
