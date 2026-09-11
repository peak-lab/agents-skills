import { spawn as nodeSpawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelAdapter, ModelRequest, ModelResponse } from "./types.ts";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_TIMEOUT_MS = 60_000;
const toolEventTypes = new Set([
  "tool_use",
  "tool_call",
  "function_call",
  "web_search_call",
  "mcp_call",
  "CommandExecution",
  "command_execution",
  "mcp_tool_call",
]);
const allowedCodexItemTypes = new Set(["reasoning", "agent_message"]);

interface Child {
  pid?: number;
  stdin: { end(input?: string): void; on(event: "error", listener: (error: Error) => void): void };
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  on(event: "error", listener: (error: Error) => void): Child;
  on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): Child;
  kill(signal?: NodeJS.Signals): boolean;
}

export interface SpawnOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  detached: true;
  stdio: ["pipe", "pipe", "pipe"];
}

export type Spawn = (command: string, args: string[], options: SpawnOptions) => Child;

let spawn: Spawn = (command, args, options) => nodeSpawn(command, args, options) as unknown as Child;

export function setAdapterSpawnForTest(next: Spawn | undefined): void {
  spawn = next ?? ((command, args, options) => nodeSpawn(command, args, options) as unknown as Child);
}

function environment(): NodeJS.ProcessEnv {
  const allowed = ["HOME", "PATH", "TMPDIR", "LANG", "LC_ALL", "TERM"] as const;
  return Object.fromEntries(allowed.flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
}

function killProcessGroup(child: Child): void {
  if (child.pid !== undefined) {
    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch {}
  }
  child.kill("SIGKILL");
}

async function temporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), "peaklab-eval-"));
}

async function execute(command: string, args: string[], input: string, timeoutMs: number, credentials: NodeJS.ProcessEnv = {}): Promise<{ stdout: string; stderr: string }> {
  const cwd = await temporaryDirectory();
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, env: { ...environment(), ...credentials }, detached: true, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      const interrupt = (): never => {
        killProcessGroup(child);
        process.exit(130);
      };
      const terminate = (): never => {
        killProcessGroup(child);
        process.exit(143);
      };
      process.once("SIGINT", interrupt);
      process.once("SIGTERM", terminate);
      let settled = false;
      const timeout = setTimeout(() => fail(new Error(`model command timed out after ${timeoutMs}ms`)), timeoutMs);
      const finish = (result: { stdout: string; stderr: string } | Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        process.off("SIGINT", interrupt);
        process.off("SIGTERM", terminate);
        result instanceof Error ? reject(result) : resolve(result);
      };
      const fail = (error: Error): void => {
        killProcessGroup(child);
        finish(error);
      };
      const append = (stream: "stdout" | "stderr", chunk: unknown): void => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        outputBytes += Buffer.byteLength(text);
        if (outputBytes > MAX_OUTPUT_BYTES) {
          fail(new Error(`model command output exceeded ${MAX_OUTPUT_BYTES} bytes`));
          return;
        }
        if (stream === "stdout") stdout += text;
        else stderr += text;
      };

      child.stdout.on("data", chunk => append("stdout", chunk));
      child.stderr.on("data", chunk => append("stderr", chunk));
      child.stdin.on("error", error => fail(error));
      child.on("error", error => finish(error));
      child.on("close", (code, signal) => {
        if (code !== 0) {
          finish(new Error(`model command failed (${signal ?? code})`));
          return;
        }
        finish({ stdout, stderr });
      });
      child.stdin.end(input);
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numberAt(record: Record<string, unknown>, key: string): number | null {
  return typeof record[key] === "number" ? record[key] : null;
}

function totalInputTokens(usage: Record<string, unknown>): number | null {
  const input = numberAt(usage, "input_tokens");
  if (input === null) return null;
  return input + (numberAt(usage, "cache_read_input_tokens") ?? 0) + (numberAt(usage, "cache_creation_input_tokens") ?? 0);
}

function containsToolCall(value: unknown, allowStructuredOutput: boolean): boolean {
  if (Array.isArray(value)) return value.some(entry => containsToolCall(entry, allowStructuredOutput));
  const record = asRecord(value);
  if (record === undefined) return false;
  if (typeof record.type === "string" && toolEventTypes.has(record.type)) {
    if (!(allowStructuredOutput && record.type === "tool_use" && record.name === "StructuredOutput")) return true;
  }
  return Object.values(record).some(entry => containsToolCall(entry, allowStructuredOutput));
}

function parseClaude(stdout: string, structuredOutputRequested: boolean): ModelResponse {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error("Claude returned invalid JSON");
  }
  if (containsToolCall(value, structuredOutputRequested)) throw new Error("Claude attempted a tool call");
  const responses = Array.isArray(value)
    ? value.filter(entry => asRecord(entry)?.type === "result").map(asRecord)
    : [asRecord(value)];
  if (responses.length !== 1 || responses[0] === undefined) throw new Error("Claude returned no result envelope");
  const response = responses[0];
  if (response.is_error === true || (response.subtype !== undefined && response.subtype !== "success")) throw new Error("Claude returned an error response");
  const structuredOutput = asRecord(response.structured_output) === undefined ? undefined : JSON.stringify(response.structured_output);
  const result = typeof response.result === "string" ? response.result : undefined;
  const text = structuredOutput ?? result;
  if (text === undefined) throw new Error("Claude returned no text result");
  const usage = asRecord(response.usage) ?? {};
  return {
    text,
    inputTokens: totalInputTokens(usage),
    outputTokens: numberAt(usage, "output_tokens"),
    ...(typeof response.total_cost_usd === "number" ? { costUsd: response.total_cost_usd } : {}),
  };
}

function parseCodex(stdout: string): ModelResponse {
  const events = stdout.trim().split("\n").filter(Boolean).map(line => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      throw new Error("Codex returned invalid JSONL");
    }
  });
  if (events.some(event => containsToolCall(event, false))) throw new Error("Codex attempted a tool call");
  let text: string | undefined;
  let usage: Record<string, unknown> | undefined;
  let completed = false;
  for (const event of events) {
    const record = asRecord(event);
    if (record === undefined) continue;
    const payload = asRecord(record.payload);
    const eventType = record.type ?? payload?.type;
    if (eventType === "turn.failed" || eventType === "error") throw new Error("Codex returned an error event");
    if (eventType === "turn.completed") completed = true;
    const item = asRecord(record.item) ?? asRecord(payload?.item);
    if (item !== undefined && (typeof item.type !== "string" || !allowedCodexItemTypes.has(item.type))) throw new Error("Codex emitted a non-text item");
    if (item?.type === "agent_message" && typeof item.text === "string") text = item.text;
    const eventUsage = asRecord(record.usage) ?? asRecord(payload?.usage);
    if (eventUsage !== undefined) usage = eventUsage;
  }
  if (!completed) throw new Error("Codex did not complete its turn");
  if (text === undefined) throw new Error("Codex returned no text result");
  return { text, inputTokens: numberAt(usage ?? {}, "input_tokens"), outputTokens: numberAt(usage ?? {}, "output_tokens") };
}

function claudeArgs(model: string, jsonSchema: Record<string, unknown> | undefined): string[] {
  return ["--safe-mode", "--restricted", "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence", "--output-format", "json", "--model", model, ...(jsonSchema === undefined ? [] : ["--json-schema", JSON.stringify(jsonSchema)]), "-p"];
}

function codexArgs(model: string): string[] {
  return [
    "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "--json", "--strict-config",
    "-c", "features.enable_mcp_apps=false", "-c", "features.memories=false", "-c", "features.multi_agent=false", "-c", "features.multi_agent_v2=false",
    "-c", "features.plugins=false", "-c", "features.shell_tool=false", "-c", "features.standalone_web_search=false", "-c", "features.unified_exec=false",
    "-c", "features.view_image=false", "-c", "orchestrator.mcp.enabled=false", "-c", "orchestrator.skills.enabled=false", "-c", "skills.include_instructions=false",
    "-c", "project_doc_max_bytes=0", "-c", "tools.experimental_request_user_input.enabled=false", "-c", "tools.update_plan.enabled=false", "-c", "web_search='disabled'", "--model", model, "-",
  ];
}

export async function createAdapter(host: "claude" | "codex", model: string, auth: "login" | "api-key" = "login"): Promise<ModelAdapter> {
  const credentials: NodeJS.ProcessEnv = {};
  if (auth === "api-key") {
    const key = host === "claude" ? "ANTHROPIC_API_KEY" : "CODEX_API_KEY";
    if (!process.env[key]?.trim()) throw new Error(`--auth api-key requires ${key}`);
    credentials[key] = process.env[key];
  }
  const version = (await execute(host, ["--version"], "", 10_000)).stdout.trim();
  if (!version) throw new Error(`${host} returned no version`);
  return {
    host,
    model,
    version,
    async complete(request: ModelRequest): Promise<ModelResponse> {
      if (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) throw new Error("timeoutMs must be positive");
      const timeoutMs = Math.min(request.timeoutMs, MAX_TIMEOUT_MS);
      const jsonSchema = "jsonSchema" in request && asRecord(request.jsonSchema) !== undefined ? request.jsonSchema : undefined;
      const result = await execute(host, host === "claude" ? claudeArgs(model, jsonSchema) : codexArgs(model), request.prompt, timeoutMs, credentials);
      return host === "claude" ? parseClaude(result.stdout, jsonSchema !== undefined) : parseCodex(result.stdout);
    },
  };
}
