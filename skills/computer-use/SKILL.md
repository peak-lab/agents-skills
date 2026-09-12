---
name: computer-use
description: "Control visible native apps and desktop windows through Orca. Use orca-cli for its embedded browser, or Playwright/CDP for page-only web automation."
---

# Computer Use

This is a discovery stub. The version-matched computer-use guide is served by the Orca CLI so its commands cannot drift from the runtime that executes them.

Use Orca's computer-use surface for desktop-level access to a visible local application or window, including native applications and external browser windows or webviews. Do not use it for Orca's embedded browser or page-only browser automation. Use `orca-cli` for embedded pages and a page-automation tool such as Playwright or CDP for external pages.

<constraints>
- Do not guess Orca commands or flags from this stub or memory.
- Respect the authorization and confirmation boundaries in the runtime guide, especially before actions that change external state.
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
ORCA skills get computer-use
```

Read the complete output, then use the exact command surface it documents. Confirm the runtime with `ORCA status --json`, starting it with `ORCA open --json` if needed. Prefer `--json` for agent-facing calls.

If and only if `skills get` reports an unknown command, treat the runtime as an older version and use this bounded, read-only bootstrap:

```text
ORCA status --json
ORCA computer capabilities --json
ORCA computer list-apps --json
```

Then report that upgrading Orca restores the version-matched guide. For any further action, ask the user rather than guessing an older command surface.
