import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const catalogue = fileURLToPath(new URL("../", import.meta.url));
const temporary = realpathSync(mkdtempSync(join(tmpdir(), "peaklab-package-smoke-")));
function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8",
    env: { ...process.env, npm_config_cache: join(temporary, "cache"), npm_config_ignore_scripts: "true" },
  });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error ?? result.stderr}`);
  return result.stdout;
}
try {
  const [packed] = JSON.parse(run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temporary], catalogue));
  const files: string[] = packed.files.map((file: { path: string }) => file.path);
  if (!files.includes("dist/cli.js") || files.filter((file) => /^agents\/(claude|codex)\//.test(file)).length !== 20) {
    throw new Error("Package must contain the built CLI and exactly 20 native agent definitions");
  }
  if (files.some((file) => /(^|\/)(\.env|node_modules|src|tests)(\/|$)/.test(file) || file.endsWith(".py"))) {
    throw new Error("Unexpected development/private content in package");
  }
  const project = join(temporary, "consumer project");
  mkdirSync(project);
  const inferred = run("npm", ["exec", "--yes", "--offline", "--", `file:${join(temporary, packed.filename)}`, "--help"], project);
  if (!inferred.includes("peaklab-agents")) throw new Error("npm could not infer the package's CLI binary");
  const invoke = (args: string[]) => run("npm", ["exec", "--yes", "--offline", "--package", join(temporary, packed.filename), "--", "peaklab-agents", ...args], project);
  invoke(["--help"]);
  for (const agent of ["codex", "claude-code"]) {
    const args = ["--target", project, "--agent", agent];
    invoke(["install", ...args]);
    const directory = join(project, agent === "codex" ? ".codex" : ".claude", "agents");
    if (existsSync(directory)) throw new Error("Preview wrote to disk");
    invoke(["install", ...args, "--apply"]);
    if (readdirSync(directory).filter((file) => /\.(md|toml)$/.test(file)).length !== 10) throw new Error("Incomplete native install");
    invoke(["update", ...args, "--apply"]);
  }
  console.log("Packed npm CLI: offline npm exec, preview, install and update passed for both hosts.");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
