import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
let target: string;
beforeEach(() => { target = realpathSync(mkdtempSync(join(tmpdir(), "peaklab-cli-test-"))); });
afterEach(() => rmSync(target, { recursive: true, force: true }));
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: target, encoding: "utf8" });

test("help exits without writing", () => {
  const result = run("--help");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("--apply");
  expect(existsSync(join(target, ".codex"))).toBe(false);
});
test.each([
  ["install"],
  ["install", "--target", "x", "--agent", "unknown"],
  ["delete", "--target", "x", "--agent", "codex"],
  ["install", "--target", "x", "--agent", "codex", "--force"],
].map((args) => [args] as const))("invalid arguments fail safely: %j", (args) => {
  expect(run(...args).status).not.toBe(0);
  expect(existsSync(join(target, ".codex"))).toBe(false);
});
test("install previews, applies, then update is idempotent from another cwd", () => {
  const args = ["--target", target, "--agent", "codex"];
  expect(run("install", ...args).status).toBe(0);
  expect(existsSync(join(target, ".codex"))).toBe(false);
  const apply = run("install", ...args, "--apply");
  expect(apply.status).toBe(0);
  expect(existsSync(join(target, ".codex", "agents", "issue-resolver.toml"))).toBe(true);
  expect(run("update", ...args, "--apply").status).toBe(0);
  expect(run(...args, "--update").status).toBe(0);
});
