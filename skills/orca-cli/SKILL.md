---
name: orca-cli
description: "Manage Orca worktrees, terminals, handoffs, artifacts and its embedded browser. Use computer-use for native windows and Playwright/CDP for external web pages."
---

# Orca CLI

This is a discovery stub. The version-matched Orca CLI guide is served by the Orca CLI so its commands cannot drift from the runtime that executes them.

Use Orca when its running editor or runtime is the source of truth: Orca-managed worktrees, folder contexts, terminals, repositories, automations, worktree comments, artifacts, and the browser embedded in Orca. It also handles a full handoff or transfer of ownership. Use shell tools when Orca state does not matter. For a visible native application or an external browser window, use `computer-use`; for page-only external browser automation, use Playwright or CDP.

<constraints>
- Do not guess Orca commands or flags from this stub or memory.
- Preserve ownership and explicit user authorization when handing work to another agent or worktree.
- If the chosen CLI fails, report the exact error and stop. Do not silently use a different executable.
</constraints>

## Resolve the CLI

Choose one executable and use it throughout the session:

- Use `ORCA_CLI_COMMAND` when that environment variable is set.
- Otherwise, use `orca-dev` in a development checkout when `ORCA_DEV_REPO_ROOT` is set.
- Otherwise, on Linux outside an Orca-managed terminal, use `orca-ide`. Never run bare `orca` there because it can resolve to the GNOME screen reader.
- Otherwise, use `orca`.

Substitute the resolved executable for `ORCA` below. Do not create a shell variable named `ORCA` or invoke the placeholder literally.

## Load the runtime guide

Before any Orca command, run:

```text
ORCA skills get orca-cli
```

Read the complete output, then use the exact command surface it documents. Confirm the runtime with `ORCA status --json`, starting it with `ORCA open --json` if needed. Prefer `--json` for agent-facing calls.

If and only if `skills get` reports an unknown command, treat the runtime as an older version and use this bounded, read-only bootstrap:

```text
ORCA status --json
ORCA worktree ps --json
ORCA terminal list --json
```

Then report that upgrading Orca restores the version-matched guide. For any further action, ask the user rather than guessing an older command surface.
