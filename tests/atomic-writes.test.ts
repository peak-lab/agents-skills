import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { installAgents, RECOVERY_FILE, writeChecked } from "../src/install-agents.ts";

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "agent-atomic-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

function interruptWrite(operation: string): void {
  const moduleUrl = pathToFileURL(join(import.meta.dir, "../src/install-agents.ts")).href;
  const result = spawnSync("node", ["--input-type=module", "-e", `
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    const original = fs.writeFileSync;
    fs.writeFileSync = (target, content, ...options) => {
      original(target, Buffer.from(content).subarray(0, 3), ...options);
      process.exit(23);
    };
    syncBuiltinESMExports();
    const { installAgents, writeChecked } = await import(${JSON.stringify(moduleUrl)});
    ${operation}
  `], { encoding: "utf8" });
  expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 23, stderr: "" });
}

test.each([false, true])("interrupted file writes never publish partial content (existing=%s)", existing => {
  const target = join(root, "reviewer.toml");
  if (existing) writeFileSync(target, "original");
  interruptWrite(`writeChecked(${JSON.stringify(target)}, Buffer.from("replacement"), ${existing ? 'Buffer.from("original")' : "null"});`);
  if (existing) expect(readFileSync(target, "utf8")).toBe("original");
  else expect(existsSync(target)).toBe(false);
  writeChecked(target, Buffer.from("replacement"), existing ? Buffer.from("original") : null);
  expect(readFileSync(target, "utf8")).toBe("replacement");
});

test("interruption while writing a journal leaves installation safely retryable", () => {
  const target = join(root, "project");
  const sourceRoot = join(root, "catalogue");
  mkdirSync(target);
  mkdirSync(join(sourceRoot, "agents/codex"), { recursive: true });
  writeFileSync(join(sourceRoot, "agents/codex/reviewer.toml"), "original");
  const options = { target, sourceRoot, agent: "codex" as const, apply: true };
  interruptWrite(`installAgents(${JSON.stringify(options)});`);
  expect(existsSync(join(target, ".codex/agents", RECOVERY_FILE))).toBe(false);
  expect(existsSync(join(target, ".codex/agents/reviewer.toml"))).toBe(false);
  installAgents(options);
  expect(readFileSync(join(target, ".codex/agents/reviewer.toml"), "utf8")).toBe("original");
});
