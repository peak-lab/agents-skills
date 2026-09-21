# Advanced: skill synchronization and backups

For a first installation or a normal update, use the [installation guide](installation.md).
Use this page when maintaining a personal mirror with recorded baselines and backups.

The repository is the reviewed source for distributable skill packages. A personal installation is
a consumer copy, never an upstream. Plugins, system skills, agent definitions, secrets, hooks and
harness configuration are outside this process.

## Choose a profile

[`skill-profiles.json`](../skill-profiles.json) defines additive profiles:

| Profile | Purpose |
|---|---|
| `core` | Implementation, review, handoff and planning fundamentals. |
| `development` | Debugging, refactoring, clean-code and documentation lookup. |
| `peaklab` | GitHub, Plane, GlitchTip and QA delivery workflows. |
| `service-adapters` | Coolify, infrastructure discovery and Uptime Kuma; configure each service locally. |
| `optional` | Design, writing, Orca, QA runtime and scaffolding tools. |

Profiles are entry points. The sync tool adds the transitive internal dependencies declared in
[`skill-dependencies.json`](../skill-dependencies.json).

The `core` profile includes eight entry skills, including planning tools. It is broader than the
four-skill starter set. Profiles are inputs to this sync tool, not flags for `npx skills add`.
For a colleague's first setup, use the [starter installation](installation.md#install-the-starter-set).

## Synchronize a personal mirror

The repository-local tool is deliberately explicit and requires an absolute `skills` directory:

```bash
# Read-only: inspect every catalogue skill already installed locally.
bun run sync:skills -- check --target "$HOME/.agents/skills" --all-existing

# First canonical adoption: replace only same-named, divergent skills after creating a backup.
# Local-only and archived skills are never selected or deleted.
bun run sync:skills -- apply --target "$HOME/.agents/skills" --all-existing --adopt-repository

# Later: update an unchanged local baseline from selected profiles.
bun run sync:skills -- check --target "$HOME/.agents/skills" --profile core --profile peaklab
bun run sync:skills -- apply --target "$HOME/.agents/skills" --profile core --profile peaklab
```

The initial adoption flag is intentionally required for an installation with no recorded baseline.
Every replacement is copied to a sibling `.peaklab-skill-backup-*` directory first. The tool refuses
to overwrite a skill changed locally after its recorded baseline. Inspect that divergence and either
promote it through Git review or keep the local copy; it never guesses a winner.

Restore one sync backup only after checking its manifest and target:

```bash
bun run sync:skills -- restore --target "$HOME/.agents/skills" --backup /absolute/path/.peaklab-skill-backup-<id>
```

The tool does not delete local-only packages, install plugins, touch `~/.codex/config.toml`, alter
Claude settings, or change agent definitions. Open a new harness session if it has cached skill
discovery.

## Propose a local change upstream

Generate a read-only inventory before copying any local skill into the repository:

```bash
bun run sync:skills -- candidate --target "$HOME/.agents/skills"
```

For each candidate, create a branch and bring over one package only. Record its origin and pinned
revision or its ownership, include its applicable license, remove machine paths and private service
details, declare dependencies, then run the repository's discovery, portability and test commands.
Never use the sync tool to publish local changes automatically.

See [skill intake](skill-intake.md) for the current local inventory and its disposition.
