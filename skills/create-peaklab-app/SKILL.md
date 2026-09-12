---
name: create-peaklab-app
description: "Scaffold a PeakLab app or configure its modules and ports with create-peaklab-app."
---

# create-peaklab-app

Use the installed `create-peaklab-app` CLI to choose a project shape and generate a command or
configuration. Confirm the CLI is available before proposing its flags:

```bash
command -v create-peaklab-app
create-peaklab-app --help
```

## Choose the project shape

- Use `web` for marketing, content, portfolio, and landing sites.
- Use `web-app` for an authenticated product, dashboard, or subscription service. It requires a
  database and Prisma.
- Identify required modules, the output repository, locales, and an unused port base. Ask only
  when those choices affect the generated application.

Use [the CLI reference](references/cli-reference.md) when selecting flags or writing a reusable
`peaklab.config.json`.

## Generate safely

For a simple project, provide a command. For several modules or settings intended for reuse,
provide a configuration file. Always preview the exact selection before creation:

```bash
create-peaklab-app <owner/repository> [options] --dry-run
```

Only run the non-dry command when the user has authorized creating the project. Do not put real
keys, database URLs, OAuth secrets, or production endpoints in a generated config. Configure
those values through the created application's secret-management and environment mechanism.

## Choose ports

Inspect locally occupied published ports before selecting a `--port` base. The generated service
ports are offsets from that base; see the reference for the map. Prefer a base that leaves every
required offset available.

## After creation

Give only the next steps enabled by the selected modules, such as starting Docker services,
initializing Prisma, setting required environment variables, and starting the development server.
Use `create-peaklab-app add <module>` to extend an existing project after confirming the module
fits its architecture.
