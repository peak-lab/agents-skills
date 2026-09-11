import { afterEach, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createAdapter, setAdapterSpawnForTest, type Spawn } from "../scripts/evals/adapters.ts";
import { parseOptions } from "../scripts/eval-skills.ts";

class FakeChild extends EventEmitter {
  stdin = { end: (input?: string) => { this.input = input ?? ""; }, on: () => undefined };
  stdout = new PassThrough();
  stderr = new PassThrough();
  input = "";
  kill(): boolean { return true; }
}

interface Invocation {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  child: FakeChild;
}

function mock(output: string, code = 0): Invocation[] {
  const invocations: Invocation[] = [];
  const spawn: Spawn = (command, args, options) => {
    const child = new FakeChild();
    invocations.push({ command, args, cwd: options.cwd, env: options.env, child });
    queueMicrotask(() => {
      child.stdout.end(output);
      child.stderr.end();
      child.emit("close", code, null);
    });
    return child;
  };
  setAdapterSpawnForTest(spawn);
  return invocations;
}

function mockPending(): void {
  const spawn: Spawn = () => new FakeChild();
  setAdapterSpawnForTest(spawn);
}

afterEach(() => setAdapterSpawnForTest(undefined));

test("API-key authentication is opt-in and strictly provider-scoped", async () => {
  const keys = ["ANTHROPIC_API_KEY", "CODEX_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN"];
  const saved = keys.map(key => process.env[key]);
  try {
    for (const key of keys) process.env[key] = `fake-${key}`;
    for (const host of ["claude", "codex"] as const) {
      for (const auth of ["login", "api-key"] as const) {
        const version = mock("version");
        const adapter = await createAdapter(host, "model", auth);
        for (const key of keys) expect(version[0]?.env).not.toHaveProperty(key);
        const output = host === "claude" ? '{"result":"ok"}' : '{"type":"item.completed","item":{"type":"agent_message","text":"ok"}}\n{"type":"turn.completed"}';
        const calls = mock(output);
        await adapter.complete({ prompt: "test", timeoutMs: 1000 });
        const selected = host === "claude" ? "ANTHROPIC_API_KEY" : "CODEX_API_KEY";
        for (const key of keys) {
          if (auth === "api-key" && key === selected) expect(calls[0]?.env[key]).toBe(`fake-${key}`);
          else expect(calls[0]?.env).not.toHaveProperty(key);
          expect(JSON.stringify(calls[0]?.args)).not.toContain(`fake-${key}`);
        }
      }
    }
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CODEX_API_KEY;
    const calls = mock("version");
    await expect(createAdapter("claude", "model", "api-key")).rejects.toThrow("requires ANTHROPIC_API_KEY");
    await expect(createAdapter("codex", "model", "api-key")).rejects.toThrow("requires CODEX_API_KEY");
    expect(calls).toHaveLength(0);
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
  }
});

test("auth parser preserves local login and rejects unsupported modes", () => {
  expect(parseOptions([]).auth).toBe("login");
  expect(parseOptions(["--auth", "api-key"]).auth).toBe("api-key");
  expect(() => parseOptions(["--auth", "automatic"])).toThrow("invalid auth mode");
});

test("Claude uses its tool-free isolated invocation and parses all input usage", async () => {
  const calls = mock("claude 2.1.268");
  const adapter = await createAdapter("claude", "sonnet");
  const responseCall = mock(JSON.stringify({ result: "simulated", subtype: "success", usage: { input_tokens: 3, cache_read_input_tokens: 2, cache_creation_input_tokens: 1, output_tokens: 5 }, total_cost_usd: 0.01 }));
  const response = await adapter.complete({ prompt: "test", timeoutMs: 1_000 });

  expect(response).toEqual({ text: "simulated", inputTokens: 6, outputTokens: 5, costUsd: 0.01 });
  expect(responseCall[0]?.args).toEqual(["--safe-mode", "--restricted", "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence", "--output-format", "json", "--model", "sonnet", "-p"]);
  expect(responseCall[0]?.child.input).toBe("test");
  expect(responseCall[0]?.env).not.toHaveProperty("ANTHROPIC_API_KEY");
});

test("Claude parses a result envelope from its JSON event array", async () => {
  mock("claude 2.1.268");
  const adapter = await createAdapter("claude", "sonnet");
  mock(JSON.stringify([
    { type: "system", subtype: "init" },
    { type: "assistant", message: { content: [{ type: "text", text: "intermediate" }] } },
    { type: "result", subtype: "success", result: "simulated", usage: { input_tokens: 3, output_tokens: 5 } },
  ]));
  await expect(adapter.complete({ prompt: "test", timeoutMs: 1_000 })).resolves.toEqual({ text: "simulated", inputTokens: 3, outputTokens: 5 });
});

test("Claude forwards a schema and returns its structured output", async () => {
  mock("claude 2.1.268");
  const adapter = await createAdapter("claude", "sonnet");
  const output = { status: "pass" };
  const calls = mock(JSON.stringify([
    { type: "tool_use", name: "StructuredOutput" },
    { type: "result", subtype: "success", structured_output: output },
  ]));
  const request = { prompt: "test", timeoutMs: 1_000, jsonSchema: { type: "object" } };
  await expect(adapter.complete(request)).resolves.toEqual({ text: JSON.stringify(output), inputTokens: null, outputTokens: null });
  expect(calls[0]?.args).toContain("--json-schema");
  expect(calls[0]?.args).toContain(JSON.stringify(request.jsonSchema));
});

test("Codex uses strict tool-free config and parses JSONL events", async () => {
  const calls = mock("codex-cli 0.154.0");
  const adapter = await createAdapter("codex", "gpt-5.6");
  const output = [
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "simulated" } }),
    JSON.stringify({ type: "turn.completed", usage: { input_tokens: 7, output_tokens: 11 } }),
  ].join("\n");
  const responseCall = mock(output);
  await expect(adapter.complete({ prompt: "test", timeoutMs: 1_000 })).resolves.toEqual({ text: "simulated", inputTokens: 7, outputTokens: 11 });
  expect(responseCall[0]?.args).toContain("features.shell_tool=false");
  expect(responseCall[0]?.args).toContain("features.enable_mcp_apps=false");
  expect(responseCall[0]?.args).toContain("features.memories=false");
  expect(responseCall[0]?.args).toContain("features.multi_agent=false");
  expect(responseCall[0]?.args).toContain("features.unified_exec=false");
  expect(responseCall[0]?.args).toContain("features.view_image=false");
  expect(responseCall[0]?.args).toContain("orchestrator.mcp.enabled=false");
  expect(responseCall[0]?.args).toContain("skills.include_instructions=false");
  expect(responseCall[0]?.args).toContain("web_search='disabled'");
  expect(responseCall[0]?.args).toContain("features.plugins=false");
  expect(responseCall[0]?.cwd).not.toBe(process.cwd());
  expect(responseCall[0]?.env).not.toHaveProperty("OPENAI_API_KEY");
});

test("rejects Claude and Codex tool-call events", async () => {
  mock("claude 2.1.268");
  const claude = await createAdapter("claude", "sonnet");
  mock(JSON.stringify({ result: "no", event: { type: "tool_use" } }));
  await expect(claude.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("attempted a tool call");

  mock("codex-cli 0.154.0");
  const codex = await createAdapter("codex", "gpt-5.6");
  mock(JSON.stringify({ type: "item.completed", item: { type: "command_execution" } }));
  await expect(codex.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("attempted a tool call");
});

test("rejects Codex file and unfamiliar item events", async () => {
  mock("codex-cli 0.154.0");
  const codex = await createAdapter("codex", "gpt-5.6");
  mock(JSON.stringify({ type: "item.completed", item: { type: "file_change" } }));
  await expect(codex.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("non-text item");
});

test("rejects native errors and incomplete Codex event streams", async () => {
  mock("claude 2.1.268");
  const claude = await createAdapter("claude", "sonnet");
  mock(JSON.stringify({ result: "error", is_error: true, subtype: "error" }));
  await expect(claude.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("error response");

  mock("codex-cli 0.154.0");
  const failed = await createAdapter("codex", "gpt-5.6");
  mock([JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "partial" } }), JSON.stringify({ type: "turn.failed" })].join("\n"));
  await expect(failed.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("error event");

  mock("codex-cli 0.154.0");
  const incomplete = await createAdapter("codex", "gpt-5.6");
  mock(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "partial" } }));
  await expect(incomplete.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("did not complete");
});

test("uses null usage when native output does not report it", async () => {
  mock("claude 2.1.268");
  const claude = await createAdapter("claude", "sonnet");
  mock(JSON.stringify({ result: "simulated", subtype: "success" }));
  await expect(claude.complete({ prompt: "test", timeoutMs: 1_000 })).resolves.toEqual({ text: "simulated", inputTokens: null, outputTokens: null });
});

test("fails safely for timeout, bounded output, nonzero exit, and malformed native output", async () => {
  mock("claude 2.1.268");
  const timeout = await createAdapter("claude", "sonnet");
  mockPending();
  await expect(timeout.complete({ prompt: "test", timeoutMs: 1 })).rejects.toThrow("timed out");

  mock("claude 2.1.268");
  const overflow = await createAdapter("claude", "sonnet");
  mock("x".repeat(1024 * 1024 + 1));
  await expect(overflow.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("output exceeded");

  mock("claude 2.1.268");
  const failed = await createAdapter("claude", "sonnet");
  mock("credential-like stderr must not appear", 1);
  await expect(failed.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("model command failed (1)");

  mock("claude 2.1.268");
  const malformed = await createAdapter("claude", "sonnet");
  mock("not-json");
  await expect(malformed.complete({ prompt: "test", timeoutMs: 1_000 })).rejects.toThrow("invalid JSON");
});
