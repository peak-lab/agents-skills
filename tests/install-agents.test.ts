import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, parse } from "node:path";
import { installAgents, RECOVERY_FILE, STATE_FILE, writeChecked } from "../src/install-agents";

describe("native agent installation and updates", () => {
  let root: string;
  let target: string;
  let sourceRoot: string;
  let source: string;
  let installed: string;
  let destination: string;
  let state: string;
  let recovery: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "peaklab-agents-test-")));
    target = join(root, "project with spaces");
    sourceRoot = join(root, "catalogue");
    source = join(sourceRoot, "agents", "codex");
    mkdirSync(source, { recursive: true });
    mkdirSync(target);
    writeFileSync(join(source, "reviewer.toml"), "original");
    destination = join(target, ".codex", "agents");
    installed = join(destination, "reviewer.toml");
    state = join(destination, STATE_FILE);
    recovery = join(destination, RECOVERY_FILE);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const run = (update = false, apply = true) => installAgents({ target, sourceRoot, agent: "codex", update, apply });
  const text = (path: string) => readFileSync(path, "utf8");

  test("preview never creates a directory or state", () => {
    expect(run(false, false)).toEqual([installed]);
    expect(existsSync(join(target, ".codex"))).toBe(false);
  });
  test("first install records a Python-compatible v1 baseline", () => {
    expect(run()).toEqual([installed]);
    expect(text(installed)).toBe("original");
    expect(JSON.parse(text(state))).toEqual({
      version: 1, catalogue: "peak-lab/agents-skills", agent: "codex",
      files: { "reviewer.toml": createHash("sha256").update("original").digest("hex") },
    });
  });
  test("Claude installs only Markdown to its native directory", () => {
    const dir = join(sourceRoot, "agents", "claude");
    mkdirSync(dir);
    writeFileSync(join(dir, "reviewer.md"), "Claude");
    writeFileSync(join(dir, "ignored.txt"), "not an agent");
    const paths = installAgents({ target, sourceRoot, agent: "claude-code", apply: true });
    expect(paths).toEqual([join(target, ".claude", "agents", "reviewer.md")]);
  });
  test("updates an unchanged tracked file and skips identical updates", () => {
    run();
    writeFileSync(join(source, "reviewer.toml"), "updated");
    expect(run(true)).toEqual([installed]);
    expect(text(installed)).toBe("updated");
    expect(run(true)).toEqual([]);
  });
  test("reads a baseline emitted by the old Python installer", () => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(installed, "original");
    writeFileSync(state, '{\n  "agent": "codex",\n  "catalogue": "peak-lab/agents-skills",\n  "files": {\n    "reviewer.toml": "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5"\n  },\n  "version": 1\n}\n');
    writeFileSync(join(source, "reviewer.toml"), "updated");
    expect(run(true)).toEqual([installed]);
  });
  test("update preview preserves definitions and state", () => {
    run();
    const before = text(state);
    writeFileSync(join(source, "reviewer.toml"), "updated");
    expect(run(true, false)).toEqual([installed]);
    expect(text(installed)).toBe("original");
    expect(text(state)).toBe(before);
  });
  test.each([false, true])("resumes an interrupted first installation and keeps preview read-only (update=%s)", update => {
    writeFileSync(join(source, "second.toml"), "second");
    let writes = 0;
    expect(() => installAgents({
      target, sourceRoot, agent: "codex", apply: true, update,
      checkedWrite(path, content, expected) {
        writeChecked(path, content, expected);
        writes += 1;
        if (writes === 1) throw new Error("simulated interruption");
      },
    })).toThrow(/interruption/);
    expect(existsSync(recovery)).toBe(true);
    expect(existsSync(state)).toBe(false);
    const journal = text(recovery);
    expect(installAgents({ target, sourceRoot, agent: "codex", update })).toEqual([join(destination, "second.toml")]);
    expect(text(recovery)).toBe(journal);
    expect(existsSync(state)).toBe(false);

    expect(run(update)).toEqual([join(destination, "second.toml")]);
    expect(text(installed)).toBe("original");
    expect(text(join(destination, "second.toml"))).toBe("second");
    expect(existsSync(recovery)).toBe(false);
    expect(JSON.parse(text(state)).files).toEqual({
      "reviewer.toml": createHash("sha256").update("original").digest("hex"),
      "second.toml": createHash("sha256").update("second").digest("hex"),
    });
  });
  test("recovery refuses modified definitions and journals", () => {
    writeFileSync(join(source, "second.toml"), "second");
    expect(() => installAgents({
      target, sourceRoot, agent: "codex", apply: true,
      checkedWrite(path, content, expected) {
        writeChecked(path, content, expected);
        throw new Error("simulated interruption");
      },
    })).toThrow(/interruption/);
    writeFileSync(installed, "user edit");
    expect(() => run()).toThrow(/recovery blocked by changed agent/);
    expect(text(installed)).toBe("user edit");
    writeFileSync(recovery, "untrusted");
    expect(() => run()).toThrow(/recovery journal/);
  });
  test("resumes an interrupted update without changing unrelated user files", () => {
    run();
    writeFileSync(join(source, "reviewer.toml"), "updated");
    writeFileSync(join(source, "second.toml"), "second");
    writeFileSync(join(destination, "personal.toml"), "user-owned");
    let writes = 0;
    expect(() => installAgents({
      target, sourceRoot, agent: "codex", update: true, apply: true,
      checkedWrite(path, content, expected) {
        writeChecked(path, content, expected);
        writes += 1;
        if (writes === 1) throw new Error("simulated interruption");
      },
    })).toThrow(/interruption/);

    expect(installAgents({ target, sourceRoot, agent: "codex", update: true, apply: true })).toEqual([join(destination, "second.toml")]);
    expect(text(installed)).toBe("updated");
    expect(text(join(destination, "second.toml"))).toBe("second");
    expect(text(join(destination, "personal.toml"))).toBe("user-owned");
    expect(existsSync(recovery)).toBe(false);
  });
  test("recovery refuses a catalogue change after interruption", () => {
    writeFileSync(join(source, "second.toml"), "second");
    expect(() => installAgents({
      target, sourceRoot, agent: "codex", apply: true,
      checkedWrite(path, content, expected) {
        writeChecked(path, content, expected);
        throw new Error("simulated interruption");
      },
    })).toThrow(/interruption/);
    writeFileSync(join(source, "second.toml"), "different catalogue version");
    expect(() => run()).toThrow(/recovery journal/);
    expect(existsSync(join(destination, "second.toml"))).toBe(false);
    expect(existsSync(state)).toBe(false);
  });
  test("cleans up a journal left after the state write", () => {
    run();
    writeFileSync(join(source, "reviewer.toml"), "updated");
    expect(() => installAgents({
      target, sourceRoot, agent: "codex", update: true, apply: true,
      checkedWrite(path, content, expected) {
        writeChecked(path, content, expected);
        if (path === state) throw new Error("simulated interruption");
      },
    })).toThrow(/interruption/);
    expect(text(installed)).toBe("updated");
    expect(existsSync(recovery)).toBe(true);

    expect(installAgents({ target, sourceRoot, agent: "codex", update: true, apply: true })).toEqual([]);
    expect(existsSync(recovery)).toBe(false);
  });
  test("recovery does not overwrite state changed during resumed definition writes", () => {
    run();
    writeFileSync(join(source, "reviewer.toml"), "updated");
    writeFileSync(join(source, "second.toml"), "second");
    let writes = 0;
    expect(() => installAgents({
      target, sourceRoot, agent: "codex", update: true, apply: true,
      checkedWrite(path, content, expected) {
        writeChecked(path, content, expected);
        writes += 1;
        if (writes === 1) throw new Error("simulated interruption");
      },
    })).toThrow(/interruption/);

    expect(() => installAgents({
      target, sourceRoot, agent: "codex", update: true, apply: true,
      checkedWrite(path, content, expected) {
        writeChecked(path, content, expected);
        if (path.endsWith("second.toml")) writeFileSync(state, "user state");
      },
    })).toThrow(/changed during installation/);
    expect(text(state)).toBe("user state");
    expect(existsSync(recovery)).toBe(true);
  });
  test("local edit blocks every planned write including a new agent", () => {
    run();
    const before = text(state);
    writeFileSync(installed, "personalized");
    writeFileSync(join(source, "another.toml"), "new");
    expect(() => run(true)).toThrow(/locally modified/);
    expect(text(installed)).toBe("personalized");
    expect(text(state)).toBe(before);
    expect(existsSync(join(destination, "another.toml"))).toBe(false);
  });
  test("legacy files are not adopted even when identical", () => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(installed, "original");
    expect(() => run(true)).toThrow(/untracked/);
    expect(existsSync(state)).toBe(false);
  });
  test("first installation refuses an existing user file", () => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(installed, "user-owned");
    expect(() => run()).toThrow(/existing/);
    expect(text(installed)).toBe("user-owned");
  });
  test("first installation refuses an existing state", () => {
    run();
    expect(() => run()).toThrow(/update/);
  });
  test("new agents install and removed catalogue agents remain", () => {
    run();
    unlinkSync(join(source, "reviewer.toml"));
    writeFileSync(join(source, "new.toml"), "new");
    run(true);
    expect(text(installed)).toBe("original");
    expect(text(join(destination, "new.toml"))).toBe("new");
    expect(JSON.parse(text(state)).files["reviewer.toml"]).toBeDefined();
  });
  test("local deletion is not silently undone", () => {
    run();
    unlinkSync(installed);
    expect(() => run(true)).toThrow(/missing tracked/);
  });
  test.each([".codex", ".codex/agents"])("rejects a broken directory symlink: %s", (part) => {
    if (part.includes("/")) mkdirSync(join(target, ".codex"));
    symlinkSync(join(root, "missing"), join(target, part));
    expect(() => run()).toThrow(/symlink/);
    expect(existsSync(join(root, "missing"))).toBe(false);
  });
  test("rejects a linked target", () => {
    const link = join(root, "linked-project");
    symlinkSync(target, link);
    expect(() => installAgents({ target: link, sourceRoot, agent: "codex" })).toThrow(/symlink/);
  });
  test("rejects existing and broken destination file links", () => {
    mkdirSync(destination, { recursive: true });
    const external = join(root, "external");
    symlinkSync(external, installed);
    expect(() => run()).toThrow(/symlink/);
    expect(existsSync(external)).toBe(false);
    writeFileSync(external, "private");
    expect(() => run(true)).toThrow(/symlink/);
    expect(text(external)).toBe("private");
  });
  test("rejects missing, root, and home targets", () => {
    for (const forbidden of [join(root, "missing"), parse(root).root, homedir()]) {
      expect(() => installAgents({ target: forbidden, sourceRoot, agent: "codex" })).toThrow();
    }
  });
  test("rejects a state symlink without touching its target", () => {
    mkdirSync(destination, { recursive: true });
    symlinkSync(join(root, "missing"), state);
    expect(() => run(true)).toThrow(/symlink/);
    expect(existsSync(join(root, "missing"))).toBe(false);
  });
  test("rejects a recovery journal symlink without touching its target", () => {
    mkdirSync(destination, { recursive: true });
    symlinkSync(join(root, "missing"), recovery);
    expect(() => run(true)).toThrow(/symlink/);
    expect(existsSync(join(root, "missing"))).toBe(false);
  });
  test.each(["not json", "null", "[]", '{"version":999}'])("rejects corrupt state: %s", (invalid) => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(state, invalid);
    expect(() => run(true)).toThrow(/state/i);
    expect(existsSync(installed)).toBe(false);
  });
  test("rejects wrong-host state and traversal entries", () => {
    run();
    const baseline = JSON.parse(text(state));
    writeFileSync(state, JSON.stringify({ ...baseline, agent: "claude-code" }));
    expect(() => run(true)).toThrow(/state/i);
    baseline.files["../external"] = "0".repeat(64);
    writeFileSync(state, JSON.stringify(baseline));
    expect(() => run(true)).toThrow(/state/i);
  });
  test("rejects empty source and linked source definitions", () => {
    unlinkSync(join(source, "reviewer.toml"));
    expect(() => run()).toThrow();
    symlinkSync(join(root, "missing"), join(source, "reviewer.toml"));
    expect(() => run()).toThrow(/symlink/);
  });
  test("checked replacement preserves edits made since planning", () => {
    run();
    writeFileSync(installed, "edited during install");
    expect(() => writeChecked(installed, Buffer.from("updated"), Buffer.from("original"))).toThrow(/changed during/);
    expect(text(installed)).toBe("edited during install");
  });
});
