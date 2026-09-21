# Install, update, and troubleshoot

Start with four skills in one project. Add a service workflow when you need it.
For usage examples, see the [task guide](catalogue.md).

## Install the starter set

You need Node 24+ with `npx`, an installed coding agent, and your project's usual development
tools. You do not need to clone this catalogue, install Bun, or configure service credentials
for the starter set. Individual workflows may use additional tools listed below.

Run **one** command from the project where you want to use the skills:

```bash
# Codex
npx skills add peak-lab/agents-skills --skill apex review-code tdd handoff --agent codex
```

```bash
# Claude Code
npx skills add peak-lab/agents-skills --skill apex review-code tdd handoff --agent claude-code
```

Keep the project scope for your first installation. Add `-g` only to install for all your projects.
Native agents are optional; the starter works without them.

## Verify the installation

Open a new coding-agent session in that project. Ask:

> Locate the installed apex skill, read its SKILL.md, and tell me its path and purpose. Do not change files or execute its workflow.

The result should identify an installed `apex/SKILL.md`. Merely recognizing the name is not
enough. Then try the [first task](team-workflows.md#first-task).

## Add a workflow

The commands below include the current dependency closure from
[`skill-dependencies.json`](../skill-dependencies.json). Run them from your project; replace
`codex` with `claude-code` if needed. They install packages, not service credentials.

The manifest includes optional cross-workflow references. For example, GitHub delivery installs
Plane packages because PR shipping can optionally synchronize Plane. Installing those packages
does not enable Plane synchronization or require Plane credentials for a GitHub-only task.

### GitHub issues

Requires Git, authenticated `gh`, the project's test tools, and Python 3.13+ for bundled Python
helpers. This also installs `peaklab.ship-pr` for explicitly requested PR finalization.

```bash
npx skills add peak-lab/agents-skills --skill apex peaklab.gh-create-issue peaklab.gh-do-issue peaklab.plane-api peaklab.plane-create-issue peaklab.plane-do-issue peaklab.plane-ship-watch peaklab.ship-pr --agent codex
```

### Plane issues

Requires Python 3.13+, Plane configuration, Git, authenticated `gh` for GitHub PRs, and your
project's test tools. Follow the [Plane configuration instructions](../skills/peaklab.plane-api/SKILL.md)
for credentials and project selection.

```bash
npx skills add peak-lab/agents-skills --skill apex peaklab.plane-api peaklab.plane-create-issue peaklab.plane-do-issue peaklab.plane-ship-watch --agent codex
```

### GlitchTip errors

Requires the GitHub workflow prerequisites and access to the affected GlitchTip project.
Follow the [GlitchTip workflow](../skills/peaklab.glitchtip-do-issue/SKILL.md) and its linked
configuration contract. Resolving an error also requires deployment and regression evidence
from the affected environment.

```bash
npx skills add peak-lab/agents-skills --skill apex peaklab.gh-create-issue peaklab.gh-do-issue peaklab.glitchtip-do-issue peaklab.plane-api peaklab.plane-create-issue peaklab.plane-do-issue peaklab.plane-ship-watch peaklab.ship-pr --agent codex
```

### Other selections

Browse the [catalogue](catalogue.md) first. For a custom selection, use the
[dependency inspection helper](context-budget.md) from a local checkout with Bun installed.
It prints the complete selection and an install command without changing anything.
Selective installation with `npx skills add` does not resolve this repository's dependencies automatically.

## Update

Preserve local customizations, then rerun the installation command you used, from the same
project and with the same agent and scope. Open a new session to refresh skill discovery.
Updating a catalogue checkout alone does not update installed copies.

For local customizations that need backups and conflict detection, use
[canonical synchronization](skill-sync.md). For repeatable team installations, use a
[reviewed local checkout](distribution.md#editable-installation-all-supported-hosts) at an agreed
commit. Claude plugin installations and native agents have their own update paths; see
[distribution](distribution.md) and [agents](agents.md#update-installed-agents).

## Troubleshoot

| Symptom | Check |
|---|---|
| The agent cannot find a skill | Confirm the installer succeeded for the correct agent and project, then open a new session there. Check that the skill is not disabled in host settings. |
| A workflow cannot find another skill or helper | Reinstall its complete selection above, including bundled scripts and references. For custom selections, inspect the dependency closure. |
| The same skill appears twice | Compare its source and resolved path using the checks below before removing anything. |
| A service request fails | Check the selected skill's prerequisites and credentials. Installing a package does not configure its service. |
| An update reports local changes | Keep the local copy or reconcile it with the catalogue; use the sync guide for backups. Do not overwrite it blindly. |
| The agent cannot spawn a named specialist | Native agents are optional. Use the workflow's documented fallback or follow the native-agent guide. |

### Understand duplicate skills

Check the skills actually listed in the affected session, then locate each definition. Compare
its name, source (system, plugin, shared user directory, or project), and resolved filesystem path.
An installed plugin cache alone does not prove that a plugin is enabled in that session.

- **Same resolved path:** two directory entries may be symlinks to a shared source. They are not
  independent copies. If the host lists both, check its discovery configuration before deleting files.
- **Same name, different paths:** a system skill, plugin, and manual installation can overlap.
  Keep one active source for that name in each host where possible. Preserve local customizations
  and manage a plugin through its host; do not delete system skills or plugin cache files by hand.
- **Different names, similar purposes:** compare the workflows before treating them as duplicates.
  For example, `apex` implements a change, while `tdd` provides an explicit test-first workflow.
  Install only the entry points you use, together with their declared dependencies.
- **Old slash-command alias:** inspect user and project command directories too, including
  `~/.claude/commands/` and `.claude/commands/` and their symlink targets. A command may simply
  forward to a skill under another name. Archive an unwanted alias outside discovery directories,
  preserve the underlying skill, and start a new session to check the command list.

A shared user directory can serve both Codex and Claude Code intentionally. The goal is one
unambiguous source per skill in each session, not a separate physical copy for every host.
Changing this repository does not clean up existing personal installations.

## Advanced setup

- [Claude plugin and distribution channels](distribution.md)
- [Optional native agents](agents.md)
- [Profiles, synchronization, and backups](skill-sync.md)
- [agent-qa skill deployment](agent-qa-deploy.md)
- [Dependencies and context measurements](context-budget.md)
- [Team ownership and workflow options](team-workflows.md)
