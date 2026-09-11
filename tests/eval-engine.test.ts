import { expect, test } from "bun:test";
import { emptyCatalogue, loadCatalogue, safePath } from "../scripts/evals/catalogue.ts";
import { requestPrompt, runScenario } from "../scripts/evals/engine.ts";
import { actionSchema, parseAction, parseScenarios } from "../scripts/evals/schema.ts";
import { summarize } from "../scripts/evals/report.ts";
import { parseOptions } from "../scripts/eval-skills.ts";
import type { Action, ModelAdapter, Scenario } from "../scripts/evals/types.ts";
import suite from "../evals/scenarios.json";

const scenario: Scenario = {
  id: "isolated-task", kind: "behavior", skill: "apex", prompt: "Review source.ts without modifying it.",
  files: { "source.ts": "broken code" }, services: [],
  assertions: [{ kind: "files_unchanged" }, { kind: "status", values: ["complete"] }, { kind: "action_count", type: "read_file", min: 1, match: { path: "source.ts" } }],
};
const options = { variant: "current", repeat: 1, maxSteps: 4, timeoutMs: 1000 };
function fake(actions: Action[]): ModelAdapter {
  let index = 0;
  return { host: "fake", model: "test", version: "test", complete: async () => ({ text: JSON.stringify(actions[index++]), inputTokens: 2, outputTokens: 3 }) };
}
const finish: Action = { type: "finish", status: "complete", message: "Done" };

test("suite has 12 behavior cases and balanced routing for five workflows", () => {
  const cases = parseScenarios(suite);
  expect(cases.filter(s => s.kind === "behavior")).toHaveLength(12);
  const routing = cases.filter(s => s.kind === "routing");
  expect(routing).toHaveLength(20);
  expect(new Set(routing.map(s => s.skill)).size).toBe(5);
  for (const skill of new Set(routing.map(s => s.skill))) {
    expect(routing.filter(s => s.skill === skill && s.assertions.some(a => a.kind === "first_skill"))).toHaveLength(2);
    expect(routing.filter(s => s.skill === skill && s.assertions.some(a => a.kind === "first_skill_not"))).toHaveLength(2);
  }
  expect(cases.filter(s => s.kind === "behavior").every(s => s.assertions.every(a => a.kind !== "first_skill"))).toBe(true);
});

test("a baseline without a skill can genuinely pass the same behavioral oracle", async () => {
  const result = await runScenario(scenario, emptyCatalogue(), fake([{ type: "read_file", path: "source.ts" }, finish]), options);
  expect(result.outcome).toBe("pass");
  expect(result.inputTokens).toBe(4);
  expect(result.outputTokens).toBe(6);
});

test("expected assertions and fixture responses are hidden from model requests", () => {
  const hidden: Scenario = { ...scenario, assertions: [{ kind: "message_matches", pattern: "SECRET_ORACLE" }], services: [{ service: "github", operation: "get", target: "7", response: "SECRET_RESPONSE" }] };
  const prompt = requestPrompt(hidden, emptyCatalogue(), []);
  expect(prompt).not.toContain("SECRET_ORACLE");
  expect(prompt).not.toContain("SECRET_RESPONSE");
  expect(prompt).not.toContain("broken code");
  expect(prompt).not.toContain("assertions");
});

test("an optimistic final answer cannot replace a required observed read", async () => {
  const result = await runScenario(scenario, emptyCatalogue(), fake([finish]), options);
  expect(result.outcome).toBe("fail");
});

test("writes change only isolated artifacts and are graded against original input", async () => {
  const result = await runScenario(scenario, emptyCatalogue(), fake([{ type: "write_file", path: "source.ts", content: "fixed" }, finish]), options);
  expect(result.outcome).toBe("fail");
  expect(result.files["source.ts"]).toBe("fixed");
  expect(scenario.files["source.ts"]).toBe("broken code");
});

test("forbidden service attempts count even when the mock endpoint does not exist", async () => {
  const input: Scenario = { ...scenario, assertions: [{ kind: "action_count", type: "service_call", max: 0, match: { service: "glitchtip" } }] };
  const result = await runScenario(input, emptyCatalogue(), fake([{ type: "service_call", service: "glitchtip", operation: "resolve", target: "901" }, finish]), options);
  expect(result.outcome).toBe("fail");
  expect(result.trace[0].result).toEqual({ error: "service endpoint unavailable" });
});

test("successful simulated service responses are evidence, never real calls", async () => {
  const input: Scenario = { ...scenario, services: [{ service: "test", operation: "run", target: "fixture", response: { exitCode: 1 } }], assertions: [{ kind: "status", values: ["complete"] }] };
  const result = await runScenario(input, emptyCatalogue(), fake([{ type: "service_call", service: "test", operation: "run", target: "fixture" }, finish]), options);
  expect(result.trace[0].result).toEqual({ exitCode: 1 });
});

test.each(["../secret", "/tmp/secret", "C:\\secret", "a/../b", "a//b", "a\nsecret"])("rejects unsafe path %s", path => {
  expect(safePath(path)).toBe(false);
  expect(() => parseAction(JSON.stringify({ type: "read_file", path }))).toThrow();
});

test("malformed actions and exhausted steps fail closed", async () => {
  expect(() => parseAction('{"type":"finish","status":"complete","message":"ok","extra":true}')).toThrow();
  expect(() => parseAction('{"type":"shell","command":"ls"}')).toThrow();
  const result = await runScenario(scenario, emptyCatalogue(), fake([{ type: "read_file", path: "source.ts" }]), { ...options, maxSteps: 1 });
  expect(result.outcome).toBe("error");
  expect(result.final).toBeNull();
});

test("global call budget prevents the next adapter invocation", async () => {
  let calls = 0;
  const result = await runScenario(scenario, emptyCatalogue(), fake([{ type: "read_file", path: "source.ts" }, finish]), { ...options, beforeCall() { if (calls++ >= 1) throw new Error("budget exhausted"); } });
  expect(result.calls).toBe(1);
  expect(result.outcome).toBe("error");
  expect(result.inputTokens).toBe(2);
});

test("adapter errors are not reported as passing refusals", async () => {
  const adapter: ModelAdapter = { ...fake([]), complete: async () => { throw new Error("timeout"); } };
  const result = await runScenario({ ...scenario, assertions: [{ kind: "files_unchanged" }] }, emptyCatalogue(), adapter, options);
  expect(result.checks[0].passed).toBe(true);
  expect(result.outcome).toBe("error");
  expect(result.inputTokens).toBeNull();
  expect(result.outputTokens).toBeNull();
});

test("service allowlists reject alternative mutation spellings", async () => {
  const input: Scenario = { ...scenario, assertions: [{ kind: "service_calls_only" }] };
  const result = await runScenario(input, emptyCatalogue(), fake([{ type: "service_call", service: "glitchtip", operation: "close-error", target: "901" }, finish]), options);
  expect(result.outcome).toBe("fail");
});

test("skill snapshots cannot be overwritten through simulated actions", async () => {
  const result = await runScenario(scenario, emptyCatalogue(), fake([{ type: "write_file", path: "skills/apex/SKILL.md", content: "replaced" }]), options);
  expect(result.outcome).toBe("error");
  expect(result.error).toContain("read-only");
});

test("routing checks the first selection rather than a later correction", async () => {
  const input: Scenario = { ...scenario, kind: "routing", assertions: [{ kind: "first_skill", name: "apex" }] };
  const result = await runScenario(input, emptyCatalogue(), fake([{ type: "load_skill", name: "review-code" }, { type: "load_skill", name: "apex" }, finish]), options);
  expect(result.outcome).toBe("fail");
});

test("JSON artifact assertions ignore whitespace but not incorrect values", async () => {
  const input: Scenario = { ...scenario, assertions: [{ kind: "file_json_value", path: "config.json", keys: ["percent"], value: 20 }] };
  for (const value of [20, 80]) {
    const result = await runScenario(input, emptyCatalogue(), fake([{ type: "write_file", path: "config.json", content: JSON.stringify({ percent: value }, null, 2) }, finish]), options);
    expect(result.outcome).toBe(value === 20 ? "pass" : "fail");
  }
});

test("catalogue contains only skill resources and no eval answers", () => {
  const catalogue = loadCatalogue(import.meta.dir + "/..");
  expect(catalogue.skills).toHaveLength(29);
  expect(Object.keys(catalogue.files).every(path => path.startsWith("skills/"))).toBe(true);
  expect(catalogue.files).not.toHaveProperty("evals/scenarios.json");
  expect(catalogue.hash).toMatch(/^[0-9a-f]{64}$/);
});

test("unsafe, ambiguous or unbounded CLI requests are rejected", () => {
  expect(parseOptions([]).execute).toBe(false);
  for (const args of [["--execute"], ["--max-calls", "201"], ["--repeats", "0"], ["--host", "unknown"], ["--execute", "--check"], ["--suite", "routing", "--baseline", "none"], ["--max-steps", "3", "--max-steps", "4"]]) expect(() => parseOptions(args)).toThrow();
});

test("report keeps errors in denominator and unknown token totals unknown", async () => {
  const run = await runScenario(scenario, emptyCatalogue(), fake([finish]), options);
  const report = summarize([run, { ...run, variant: "without-skill", outcome: "error", inputTokens: null }]);
  expect(report).toContain("unknown");
  expect(report).toContain("Errors remain in the denominator");
});

test("invalid scenarios fail validation before model invocation", () => {
  expect(() => parseScenarios([])).toThrow();
  expect(() => parseScenarios([scenario, scenario])).toThrow();
  expect(() => parseScenarios([{ ...scenario, files: { "../private": "oops" } }])).toThrow();
  expect(() => parseScenarios([{ ...scenario, assertions: [{ kind: "message_matches", pattern: "(?i)invalid" }] }])).toThrow();
});

test("native output schema has root properties while action validation stays discriminated", () => {
  expect(actionSchema.type).toBe("object");
  expect(actionSchema.properties).toHaveProperty("type");
  expect(actionSchema).not.toHaveProperty("oneOf");
  expect(() => parseAction('{"type":"read_file","path":"source.ts","message":"unused"}')).toThrow();
  expect(() => parseAction('{"type":"write_file","path":"source.ts"}')).toThrow();
});
