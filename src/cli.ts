#!/usr/bin/env node
import { installAgents, type Agent } from "./install-agents.js";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = "Usage: peaklab-agents <install|update> --target <directory> --agent <codex|claude-code> [--apply]";

export function main(argv = process.argv.slice(2)): number {
  try {
    if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
      console.log(usage);
      return 0;
    }
    const { command, target, agent, apply, update } = parseArguments(argv);
    const planned = installAgents({ target, agent, apply, update: command === "update" || update });
    const action = apply ? "applied" : "dry run; would install/update";
    console.log(`${action} ${planned.length} ${agent} agent definitions:`);
    console.log(planned.join("\n"));
    return 0;
  } catch (error: unknown) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

function parseArguments(argv: string[]): { command: "install" | "update"; target: string; agent: Agent; apply: boolean; update: boolean } {
  let command: "install" | "update" | undefined;
  let target: string | undefined;
  let agent: Agent | undefined;
  let apply = false;
  let update = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "install" || argument === "update") {
      if (command) throw new Error(`conflicting commands: ${command} and ${argument}`);
      command = argument;
    } else if (argument === "--target") {
      target = argv[++index];
      if (!target) throw new Error("--target requires a directory");
    } else if (argument === "--agent") {
      const value = argv[++index];
      if (value !== "codex" && value !== "claude-code") throw new Error("--agent must be codex or claude-code");
      agent = value;
    } else if (argument === "--apply") apply = true;
    else if (argument === "--update") update = true;
    else throw new Error(`${usage}\nunknown argument: ${argument}`);
  }
  if (command === "install" && update) throw new Error("--update conflicts with the install command; use update");
  if (!command) command = update ? "update" : "install";
  if (!target || !agent) throw new Error(usage);
  return { command, target, agent, apply, update };
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
