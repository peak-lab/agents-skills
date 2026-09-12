---
name: orchestration
description: "Coordinate multiple agents through Orca: task dispatch, dependencies, supervision and result collection. Use orca-cli for full handoffs or terminal control."
---

# Orca Orchestration

This is a discovery stub. The version-matched Orca orchestration guide is served by the Orca CLI so its commands cannot drift from the runtime that executes them.

Use Orca orchestration for structured multi-agent coordination: task dispatch, threaded messages, blocking ask/reply flows, worker completion or escalation waits, task DAGs, decision gates, coordinator loops, and supervision. Use `orca-cli` for a full ownership handoff, ordinary terminal control, worktree management, or the embedded browser when the user did not request coordination.

<constraints>
- Coordinate only through real Orca runtime state. Do not substitute an unrelated subagent mechanism.
- Preserve task ownership, dependencies, and explicit decision gates supplied by the runtime guide.
- Do not guess Orca commands or flags from this stub or memory.
</constraints>

## Resolve the CLI

Choose one executable and use it throughout the session:

- Use `ORCA_CLI_COMMAND` when that environment variable is set.
- Otherwise, use `orca-dev` in a development checkout when `ORCA_DEV_REPO_ROOT` is set.
- Otherwise, on Linux outside an Orca-managed terminal, use `orca-ide`. Never run bare `orca` there because it can resolve to the GNOME screen reader.
- Otherwise, use `orca`.

Substitute the resolved executable for `ORCA` below. Do not create a shell variable named `ORCA` or invoke the placeholder literally. If the selected executable fails, report its exact error and stop. Do not silently choose another executable.

## Load the runtime guide

Before any Orca command, run:

```text
ORCA skills get orchestration
```

Read the complete output, then use the exact command surface it documents. Confirm the runtime with `ORCA status --json`, starting it with `ORCA open --json` if needed. Prefer `--json` for agent-facing calls.

If and only if `skills get` reports an unknown command, treat the runtime as an older version and use this bounded, read-only bootstrap:

```text
ORCA status --json
ORCA orchestration task-list --json
ORCA terminal list --json
```

Then report that upgrading Orca restores the version-matched guide. For any further action, ask the user rather than guessing an older command surface.
