import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import { parseOptions } from "../scripts/eval-skills.ts";

const source = readFileSync(new URL("../.github/workflows/evaluate-skills.yml", import.meta.url), "utf8");
const workflow = parse(source);
const job = workflow.jobs.evaluate;
const steps = job.steps as Array<{ name?: string; uses?: string; run?: string; env?: Record<string, string>; if?: string; with?: Record<string, unknown> }>;

test("paid workflow is manual, trusted-branch-only and read-only", () => {
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(job.if).toBe("github.ref == format('refs/heads/{0}', github.event.repository.default_branch)");
  expect(job.environment).toBe("skill-evaluations");
  expect(job["timeout-minutes"]).toBe(20);
  expect(workflow.concurrency).toEqual({ group: "skill-evaluations", "cancel-in-progress": false });
  expect(workflow.env).toBeUndefined();
  expect(job.env).toBeUndefined();
  for (const step of steps) {
    if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    expect(step).not.toHaveProperty("continue-on-error");
    if (step.run) {
      expect(step.run).not.toContain("${{");
      expect(spawnSync("bash", ["-n"], { input: step.run }).status).toBe(0);
    }
  }
  expect(steps[0]?.with?.["persist-credentials"]).toBe(false);
});

test("only evaluation receives selected-provider credentials and artifacts survive failure", () => {
  const credentialSteps = steps.filter(step => JSON.stringify(step).includes("secrets."));
  expect(credentialSteps).toHaveLength(1);
  expect(credentialSteps[0]?.name).toBe("Run controlled evaluations");
  expect(credentialSteps[0]?.env?.ANTHROPIC_API_KEY).toBe("${{ inputs.host == 'claude' && secrets.ANTHROPIC_API_KEY || '' }}");
  expect(credentialSteps[0]?.env?.CODEX_API_KEY).toBe("${{ inputs.host == 'codex' && secrets.CODEX_API_KEY || '' }}");
  const artifact = steps.at(-1)!;
  expect(artifact.if).toBe("always()");
  expect(artifact.with?.["include-hidden-files"]).toBe(true);
  expect(artifact.with?.["retention-days"]).toBe(7);
  expect(artifact.with?.path).toBe(".eval-results/run-*/*.json\n.eval-results/run-*/report.md\n");
});

test("workflow defaults resolve to a valid, bounded evaluator invocation", () => {
  const inputs = workflow.on.workflow_dispatch.inputs;
  const script = steps.find(step => step.name === "Run controlled evaluations")!.run!;
  const env = { PATH: process.env.PATH, EVAL_HOST: inputs.host.default, EVAL_MODEL: "model;$(exit 42)", EVAL_SUITE: inputs.suite.default,
    EVAL_CASE: inputs.case.default, EVAL_REPEATS: String(inputs.repeats.default), EVAL_MAX_RUNS: String(inputs["max-runs"].default),
    EVAL_MAX_CALLS: String(inputs["max-calls"].default), EVAL_BUDGET: String(inputs["budget-seconds"].default) };
  const result = spawnSync("bash", ["-eu", "-o", "pipefail", "-c", 'bun() { printf "%s\\0" "$@"; };\n' + script], { env, encoding: "utf8" });
  expect(result.status).toBe(0);
  const args = result.stdout.split("\0").filter(Boolean);
  expect(args.slice(0, 2)).toEqual(["run", "eval:skills"]);
  const options = parseOptions(args.slice(2));
  expect(options).toMatchObject({ execute: true, auth: "api-key", host: "claude", model: "model;$(exit 42)", maxRuns: 4, maxCalls: 30, budgetSeconds: 300 });
});
