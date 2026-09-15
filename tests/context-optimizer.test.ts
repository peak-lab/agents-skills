import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  agentburnCommand, atomicWriteJson, auditMemory, claudeInvocations, cmdAgentburn, cmdRestore, codexInvocations, collectUsage,
  disableServers, ExitError, floorTokens, parseMcpList, projectSlug, redact, referencePattern, setWriter, sha256, unreadFiles,
} from "../skills/context-optimizer/scripts/context-optimizer.ts";

const script = resolve(import.meta.dir, "../skills/context-optimizer/scripts/context-optimizer.ts");
let root: string;
let lines: string[];
let restoreWriter: () => void;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "context-optimizer-"));
  lines = [];
  restoreWriter = setWriter(line => lines.push(line));
});

afterEach(() => {
  restoreWriter();
  rmSync(root, { recursive: true, force: true });
});

function writeJsonl(path: string, events: object[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, events.map(event => JSON.stringify(event) + "\n").join(""));
}

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

const mode = (path: string): number => statSync(path).mode & 0o777;

describe("redaction", () => {
  test("redacts query strings, bearer tokens and keys", () => {
    const line = "exa: https://mcp.example.test/mcp?exaApiKey=abc123secret - Connected "
      + "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig api_key=supersecretvalue "
      + "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv";
    const redacted = redact(line);
    for (const secret of ["abc123secret", "eyJhbGciOiJIUzI1NiJ9", "supersecretvalue", "AbCdEfGhIjKlMnOp"]) {
      expect(redacted).not.toContain(secret);
    }
    expect(redacted).toContain("https://mcp.example.test/mcp?<redacted>");
  });

  test("redacts credentials in connection strings and command arguments", () => {
    const cases: [string, string][] = [
      ["3× Bash(psql postgres://app:S3cret@54.37.8.254:5432/db)", "3× Bash(psql postgres://app:<redacted>@54.37.8.254:5432/db)"],
      ["redis://default:hunter2@cache:6379", "redis://default:<redacted>@cache:6379"],
      ["mysql -h db -u app -pS3cret shop", "mysql -h db -u app -p<redacted> shop"],
      ["curl -u user:pass https://api.test/x", "curl -u user:<redacted> https://api.test/x"],
      ["curl --user=ci:tok3n https://api.test/x", "curl --user=ci:<redacted> https://api.test/x"],
    ];
    for (const [input, expected] of cases) expect(redact(input)).toBe(expected);
    for (const text of ["git push -u origin main", "find . -perm 644 -print", "mysql -p shop", "https://example.test/a@b"]) {
      expect(redact(text)).toBe(text);
    }
  });

  test("keeps long readable names, including a memory name with a digit", () => {
    const text = "feedback_guard_negative_case_must_be_executed.md feedback_b2_video_stalls_in_chrome_profile.md skills/context-optimizer";
    expect(redact(text)).toBe(text);
  });

  test("redacts long mixed tokens", () => {
    expect(redact("path/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7")).toBe("path/<redacted>");
  });
});

describe("floor", () => {
  test("sums the first message usage", () => {
    const events = [
      { type: "system" },
      { type: "assistant", message: { usage: { input_tokens: 3, cache_read_input_tokens: 40000, cache_creation_input_tokens: 1815 } } },
      { type: "assistant", message: { usage: { input_tokens: 999 } } },
    ];
    expect(floorTokens(events)).toBe(41818);
  });

  test("falls back to the result usage", () => {
    expect(floorTokens({ type: "result", usage: { input_tokens: 5, cache_read_input_tokens: 7 } })).toBe(12);
    expect(floorTokens([{ type: "system" }])).toBeNull();
  });
});

describe("usage parsing", () => {
  test("Claude slash commands and Skill tool", () => {
    const user = { message: { role: "user", content: "<command-name>/pushrank:code-review</command-name>" } };
    const assistant = { message: { role: "assistant", content: [{ type: "tool_use", name: "Skill", input: { skill: "apex" } }] } };
    const other = { message: { role: "assistant", content: [{ type: "tool_use", name: "Read", input: { skill: "nope" } }] } };
    expect(claudeInvocations(user)).toEqual(["pushrank:code-review"]);
    expect(claudeInvocations(assistant)).toEqual(["apex"]);
    expect(claudeInvocations(other)).toEqual([]);
  });

  test("Codex ignores the skill listing", () => {
    const listing = {
      type: "response_item",
      payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "- apex: (file: ~/.agents/skills/apex/SKILL.md)" }] },
    };
    const assistant = {
      type: "response_item",
      payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "read skills/apex/SKILL.md" }] },
    };
    expect(codexInvocations(listing)).toEqual([[], []]);
    expect(codexInvocations(assistant)).toEqual([[], []]);
  });

  test("Codex counts tool arguments and user tags", () => {
    const call = { type: "response_item", payload: { type: "function_call", arguments: JSON.stringify({ cmd: "sed -n 1,80p ~/.agents/skills/review-code/SKILL.md" }) } };
    const custom = { type: "response_item", payload: { type: "custom_tool_call", input: "cat skills/tdd/SKILL.md" } };
    const shell = { type: "response_item", payload: { type: "local_shell_call", action: { command: ["cat", "skills/apex/SKILL.md"] } } };
    const tag = { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<skill>\n<name>handoff</name>" }] } };
    expect(codexInvocations(call)).toEqual([["review-code"], []]);
    expect(codexInvocations(custom)).toEqual([["tdd"], []]);
    expect(codexInvocations(shell)).toEqual([["apex"], []]);
    expect(codexInvocations(tag)).toEqual([[], ["handoff"]]);
  });

  test("collectUsage dedupes Codex reads per session", () => {
    const stamp = new Date().toISOString().slice(0, 19);
    const read = { timestamp: stamp, type: "response_item", payload: { type: "function_call", arguments: "cat skills/apex/SKILL.md" } };
    writeJsonl(join(root, "codex", "sessions", "a.jsonl"), [read, read]);
    writeJsonl(join(root, "claude", "projects", "p", "s.jsonl"), [{ timestamp: stamp, message: { role: "user", content: "<command-name>/apex</command-name>" } }]);
    const usage = collectUsage(7, join(root, "claude"), join(root, "codex"));
    expect([usage.claude.get("apex"), usage.codex.get("apex")]).toEqual([1, 1]);
  });
});

describe("mcp", () => {
  test("parse keeps name and status only", () => {
    const output = "Checking MCP server health...\n\nclaude.ai Gmail: https://gmail.example.test/mcp - ✓ Connected\nexa: https://x.test/mcp?key=s3cret - ! Needs authentication\n";
    const servers = parseMcpList(output);
    expect(servers).toEqual([["claude.ai Gmail", "✓ Connected"], ["exa", "! Needs authentication"]]);
    expect(JSON.stringify(servers)).not.toContain("s3cret");
  });

  test("disable writes atomically with a private backup", () => {
    const config = join(root, "claude.json");
    const project = join(root, "project");
    writeFileSync(config, JSON.stringify({ mcpServers: { x: { env: { KEY: "v" } } }, projects: { [project]: { disabledMcpServers: ["a"] } } }));
    chmodSync(config, 0o640);
    const [disabled, backup] = disableServers(config, project, ["a", "claude.ai Gmail"], join(root, "state"));
    const data = JSON.parse(readFileSync(config, "utf8"));
    expect(disabled).toEqual(["a", "claude.ai Gmail"]);
    expect(data.projects[project].disabledMcpServers).toEqual(["a", "claude.ai Gmail"]);
    expect(data.mcpServers).toEqual({ x: { env: { KEY: "v" } } });
    expect(mode(config)).toBe(0o640);
    expect(mode(backup)).toBe(0o600);
    expect(JSON.parse(readFileSync(backup, "utf8")).projects[project].disabledMcpServers).toEqual(["a"]);
    expect(readdirSync(root).filter(name => name.startsWith(".claude.json."))).toEqual([]);
  });

  test("disable refuses an unknown project", () => {
    const config = join(root, "claude.json");
    writeFileSync(config, JSON.stringify({ projects: {} }));
    expect(() => disableServers(config, join(root, "missing"), ["a"], join(root, "state"))).toThrow(ExitError);
    expect(JSON.parse(readFileSync(config, "utf8"))).toEqual({ projects: {} });
    expect(readdirSync(root)).toEqual(["claude.json"]);
  });

  test("atomic write keeps the original on failure", () => {
    const target = join(root, "c.json");
    writeFileSync(target, '{"ok": true}');
    expect(() => atomicWriteJson(target, { bad: 1n })).toThrow(TypeError);
    expect(readFileSync(target, "utf8")).toBe('{"ok": true}');
    expect(readdirSync(root)).toEqual(["c.json"]);
  });
});

describe("commands", () => {
  test("reference pattern", () => {
    const pattern = referencePattern("git:commit");
    expect(pattern.test("run /git:commit now")).toBe(true);
    expect(pattern.test("see commands/git/commit.md")).toBe(true);
    expect(pattern.test("run /git:commit-all")).toBe(false);
    expect(pattern.test("path/to/git:commit")).toBe(false);
  });

  test("restore moves back without overwrite", () => {
    const source = join(root, "commands", "git", "commit.md");
    const archive = join(root, "archive", "git", "commit.md");
    write(archive, "body");
    const entry = { name: "git:commit", source, archive, sha256: sha256(archive) };
    write(join(root, "tasks", "command-pruning-2026-09-15", "manifest.json"), JSON.stringify({ commands: [entry] }));
    const args = { name: "git:commit", tasksDir: join(root, "tasks") };
    write(source, "newer");
    expect(cmdRestore(args)).toBe(2);
    expect(readFileSync(source, "utf8")).toBe("newer");
    unlinkSync(source);
    expect(cmdRestore(args)).toBe(0);
    expect(readFileSync(source, "utf8")).toBe("body");
    expect(() => statSync(archive)).toThrow();
    expect(lines.at(-1)).toBe(`restored git:commit -> ${source}`);
  });
});

describe("memory", () => {
  test("audits the index and files", () => {
    const memory = join(root, "memory");
    write(join(memory, "MEMORY.md"), "# Index\n- [A](feedback_a.md) — short\n- [Gone](project_gone.md) — dangling\n- [B](feedback_b.md) — " + "x".repeat(200) + "\n");
    write(join(memory, "feedback_a.md"), "a");
    write(join(memory, "feedback_b.md"), "b".repeat(4000));
    write(join(memory, "user_c.md"), "c");
    const transcript = join(root, "t.jsonl");
    write(transcript, '{"input": {"file_path": "/x/memory/feedback_b.md"}}\n');
    const report = auditMemory(memory, [transcript], 120, 3000);
    expect(report.entries).toBe(3);
    expect(report.dangling).toEqual(["project_gone.md"]);
    expect(report.unindexed).toEqual(["user_c.md"]);
    expect(report.longLines.map(([name]) => name)).toEqual(["feedback_b.md"]);
    expect(report.largeFiles).toEqual([["feedback_b.md", 4000]]);
    expect(report.neverMentioned).toEqual(["feedback_a.md", "user_c.md"]);
  });

  test("detects write-only files", () => {
    const lessons = join(root, "memory", "feedback_lessons.md");
    write(lessons, "lessons");
    write(join(root, "AGENTS.md"), "Record lessons in memory/feedback_lessons.md");
    expect(unreadFiles([lessons], [join(root, "AGENTS.md")])).toEqual([[lessons, ["AGENTS.md"]]]);
    write(join(root, "skills", "recall", "SKILL.md"), "Read feedback_lessons.md before acting");
    expect(unreadFiles([lessons], [join(root, "AGENTS.md"), join(root, "skills")])).toEqual([]);
  });

  test("project slug", () => {
    expect(projectSlug("/srv/work/github.com/peak-lab/pushrank")).toBe("-srv-work-github-com-peak-lab-pushrank");
  });
});

describe("agentburn", () => {
  test("refuses network options", () => {
    const args = { extra: ["--llm=http://x"], allowNetwork: false, cacheDir: "/nonexistent", action: "report", agent: "codex" };
    expect(cmdAgentburn(args)).toBe(2);
    expect(lines).toEqual(["refusing network-capable agentburn options without --allow-network"]);
  });

  test("command mapping", () => {
    expect(agentburnCommand("save-baseline", "codex", ["--days", "30"]).slice(1)).toEqual(["-m", "agentburn.cli", "--agent", "codex", "--save-baseline", "--days", "30"]);
  });
});

describe("command line", () => {
  const run = (...args: string[]) => Bun.spawnSync([process.execPath, script, ...args], { env: { ...process.env, CONTEXT_OPTIMIZER_AGENTS_HOME: root } });

  test("passes arguments after -- to agentburn and keeps the network guard", () => {
    const refused = run("agentburn", "report", "--agent", "codex", "--", "--llm", "x");
    expect(refused.exitCode).toBe(2);
    expect(refused.stdout.toString()).toContain("refusing network-capable agentburn options");
  });

  test("rejects unknown options and missing arguments like argparse", () => {
    const unknown = run("floor", "--nope");
    expect(unknown.exitCode).toBe(2);
    expect(unknown.stderr.toString()).toContain("unrecognized arguments: --nope");
    const missing = run("restore");
    expect(missing.exitCode).toBe(2);
    expect(missing.stderr.toString()).toContain("the following arguments are required: name");
    expect(run("--help").stdout.toString()).toContain("{floor,usage,commands,restore,memory,mcp,agentburn,all}");
  });
});

describe("command line mutations", () => {
  const isolated = (extra: Record<string, string> = {}) => {
    const environment: Record<string, string> = {
      ...process.env as Record<string, string>,
      CONTEXT_OPTIMIZER_AGENTS_HOME: join(root, "agents"),
      CLAUDE_CONFIG_DIR: join(root, "claude"),
      CODEX_HOME: join(root, "codex"),
      CONTEXT_OPTIMIZER_STATE_DIR: join(root, "state"),
      CONTEXT_OPTIMIZER_CLAUDE_JSON: join(root, "claude.json"),
      PATH: "/usr/bin:/bin",
      ...extra,
    };
    delete environment.AGENTS_SKILLS_CATALOG;
    return environment;
  };
  const standalone = () => {
    const copy = join(root, "pkg", "skills", "context-optimizer", "scripts", "context-optimizer.ts");
    write(copy, readFileSync(script, "utf8"));
    return copy;
  };
  const run = (path: string, args: string[]) => {
    const result = Bun.spawnSync([process.execPath, path, ...args], { env: isolated() });
    return { code: result.exitCode, stdout: result.stdout.toString() };
  };

  test("commands archives only stale, unused, unreferenced, unprotected files", () => {
    const commands = join(root, "agents", "commands");
    const archive = join(root, "agents", "skill-archive", "commands");
    const catalogue = join(root, "catalogue");
    write(join(catalogue, "skill-profiles.json"), "{}");
    write(join(catalogue, "skills", "apex", "SKILL.md"), "apex");
    write(join(catalogue, "skill-dependencies.json"), JSON.stringify({ caller: ["dep-target"] }));
    const old = new Date(Date.now() - 60 * 86_400_000);
    const names = ["apex", "dep-target", "used", "referenced", "stale", "blocked/target", "young"];
    for (const name of names) {
      const path = join(commands, `${name}.md`);
      write(path, name);
      if (name !== "young") utimesSync(path, old, old);
    }
    write(join(archive, "blocked", "target.md"), "earlier archive");
    write(join(root, "agents", "rules", "routing.md"), "Run /referenced before shipping.");
    writeJsonl(join(root, "claude", "projects", "p", "s.jsonl"), [
      { timestamp: new Date().toISOString(), message: { role: "user", content: "<command-name>/used</command-name>" } },
    ]);
    const present = () => names.filter(name => existsSync(join(commands, `${name}.md`)));
    const copy = standalone();

    const dryRun = run(copy, ["commands", "--catalog", catalogue]);
    expect(dryRun.code).toBe(0);
    expect(dryRun.stdout.split("\n").filter(line => line.startsWith("  prune")).sort()).toEqual(["  prune blocked:target", "  prune stale"]);
    expect(present()).toEqual(names);
    expect(readFileSync(join(archive, "blocked", "target.md"), "utf8")).toBe("earlier archive");

    const unprotected = run(copy, ["commands", "--apply"]);
    expect(unprotected.code).toBe(2);
    expect(unprotected.stdout).toContain("refusing --apply without catalogue protection");
    expect(present()).toEqual(names);

    const applied = run(copy, ["commands", "--apply", "--catalog", catalogue]);
    expect(applied.code).toBe(0);
    expect(applied.stdout).toContain("skip blocked:target: archive target exists");
    expect(present()).toEqual(names.filter(name => name !== "stale"));
    expect(readFileSync(join(archive, "stale.md"), "utf8")).toBe("stale");
    expect(readFileSync(join(archive, "blocked", "target.md"), "utf8")).toBe("earlier archive");
    const [pruning] = readdirSync(join(root, "agents", "tasks")).filter(name => name.startsWith("command-pruning-"));
    const manifest = JSON.parse(readFileSync(join(root, "agents", "tasks", pruning, "manifest.json"), "utf8"));
    expect(manifest.commands.map((entry: { name: string }) => entry.name)).toEqual(["stale"]);
  });

  test("mcp without --apply leaves the Claude config untouched", () => {
    const project = join(root, "project");
    mkdirSync(project);
    const config = join(root, "claude.json");
    const original = JSON.stringify({ projects: { [project]: { disabledMcpServers: ["mobbin"] }, "/other": { x: 1 } } });
    writeFileSync(config, original);
    const result = run(script, ["mcp", "--project", project, "--disable", "claude.ai Gmail", "--force"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("would disable ['claude.ai Gmail']; rerun with --apply");
    expect(readFileSync(config, "utf8")).toBe(original);
    expect(existsSync(join(root, "state"))).toBe(false);
  });
});
