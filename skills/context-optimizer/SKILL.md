---
name: context-optimizer
description: "Measure and trim the per-call context of local Claude Code and Codex setups: token floor, skill and command usage, unused command archiving, memory index audit, per-project MCP servers, and the agentburn profiler. Read-only unless --apply is passed."
argument-hint: "[floor|usage|commands|memory|mcp|agentburn|all] [--project DIR]"
disable-model-invocation: true
---

# Context optimizer

Resolve `SKILL_DIR` to the directory containing this `SKILL.md` and run
`bun "$SKILL_DIR/scripts/context-optimizer.ts" <subcommand>` (Bun, or `node` 24+; no dependency).
The `agentburn` subcommand also needs `git` and `python3`.
Every subcommand is an audit. Only `commands --apply` and `mcp --disable ... --apply` write, after a backup.

## Order

1. `floor --cwd <project> --runs 3 --record` — median tokens sent by a trivial `claude -p` call.
   This is the only number to report as a gain; byte estimates overstate it.
2. `all --project <project>` — every audit at once, no writes.
3. Act on one lever, then rerun `floor --record`: the delta against the previous run is the real gain.

## Subcommands

| Subcommand | Reads | Writes with `--apply` |
|---|---|---|
| `floor [--cwd DIR] [--runs N] [--claude-arg=--strict-mcp-config]` | `claude -p` usage of the first message | history only with `--record` |
| `usage [--days 90] [--project DIR]` | Claude slash commands and `Skill` calls; Codex `SKILL.md` opened by tool calls and user skill tags | nothing |
| `commands [--days 90] [--only NAME...]` | `~/.agents/commands`, references in skills, agents, rules, `AGENTS.md` and this catalogue | moves candidates to `~/.agents/skill-archive/commands/` and writes a manifest in `~/.agents/tasks/command-pruning-<date>/` |
| `restore NAME` | the manifests | moves one command back, never over an existing file |
| `memory [--project DIR]` | `MEMORY.md` index, memory files, transcripts, `~/.agents/memory` | nothing |
| `mcp [--project DIR] [--disable NAME...]` | `claude mcp list`, names and status only | appends to the project's `disabledMcpServers` in `~/.claude.json` |
| `agentburn report\|limits\|why\|context\|save-baseline\|compare [-- ARGS]` | agentburn pinned to a reviewed commit, cached under `~/.cache/context-optimizer` | agentburn's own baseline file |

## Rules

- Never print MCP targets, headers, env or `~/.claude.json` content; the script redacts URLs and keys.
- `commands --apply` refuses to run without this catalogue: its skills and `skill-dependencies.json` are protected.
- Server names for `--disable` are exactly as listed, such as `claude.ai Gmail`. Restart open sessions afterwards.
- `memory` is a report. Zero transcript mentions is a weak signal: shorten or merge with the user, never auto-delete.
- A memory index is loaded on every call; a memory file costs only when recalled. Trim the index first.
- agentburn diagnosis (`limits`, `why`, compactions, cost per commit) is useful; its `fix` and re-read-loop advice is unreliable.
  `drift`, `explain`, `rank`, `--submit`, `--llm` and `--trends` reach the network and need `--allow-network`.
