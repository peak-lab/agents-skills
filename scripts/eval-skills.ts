#!/usr/bin/env bun
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createAdapter } from "./evals/adapters.ts";
import { emptyCatalogue, hash, loadCatalogue } from "./evals/catalogue.ts";
import { runScenario } from "./evals/engine.ts";
import { summarize } from "./evals/report.ts";
import { parseScenarios } from "./evals/schema.ts";
import type { ModelAdapter, RunResult } from "./evals/types.ts";

const root = resolve(import.meta.dir, "..");
const help = `Usage: bun run eval:skills [--check | --list] [--suite behavior|routing] [--case ID]
  [--execute --host claude|codex --model NAME] [--auth login|api-key] [--baseline none|CATALOGUE_ROOT]
  [--repeats 1..3] [--max-runs 1..96] [--max-calls 1..200] [--max-steps 1..24]
  [--timeout-seconds 1..60] [--budget-seconds 1..900]
Without --execute: validates and previews only; never invokes a model.
Defaults: behavior suite, one repeat, at most 4 runs / 30 calls / 16 steps per run,
60s per adapter call and 300s run-loop budget. Default auth: existing CLI login.
--auth api-key forwards only ANTHROPIC_API_KEY (Claude) or CODEX_API_KEY (Codex).
Reports go to a new .eval-results/run-* directory. No automatic retries or scheduling.`;

interface Options {
  execute: boolean; check: boolean; list: boolean; suite: "behavior" | "routing"; caseId?: string;
  host?: "claude" | "codex"; model?: string; baseline?: string; auth: "login" | "api-key";
  repeats: number; maxRuns: number; maxCalls: number; maxSteps: number; timeoutSeconds: number; budgetSeconds: number;
}

export function parseOptions(args: string[]): Options {
  const options: Options = { execute: false, check: false, list: false, suite: "behavior", auth: "login", repeats: 1, maxRuns: 4, maxCalls: 30, maxSteps: 16, timeoutSeconds: 60, budgetSeconds: 300 };
  const numbers = { "--repeats": ["repeats", 3], "--max-runs": ["maxRuns", 96], "--max-calls": ["maxCalls", 200], "--max-steps": ["maxSteps", 24], "--timeout-seconds": ["timeoutSeconds", 60], "--budget-seconds": ["budgetSeconds", 900] } as const;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error(`duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--execute") { options.execute = true; continue; }
    if (flag === "--check") { options.check = true; continue; }
    if (flag === "--list") { options.list = true; continue; }
    if (!["--suite", "--case", "--host", "--model", "--auth", "--baseline", ...Object.keys(numbers)].includes(flag)) throw new Error(`unknown option: ${flag}`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`missing value: ${flag}`);
    if (Object.hasOwn(numbers, flag)) {
      const [key, maximum] = numbers[flag as keyof typeof numbers];
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) throw new Error(`${flag} must be 1..${maximum}`);
      options[key] = Number(value);
    } else if (flag === "--suite") {
      if (value !== "behavior" && value !== "routing") throw new Error("invalid suite");
      options.suite = value;
    } else if (flag === "--host") {
      if (value !== "claude" && value !== "codex") throw new Error("invalid host");
      options.host = value;
    } else if (flag === "--auth") {
      if (value !== "login" && value !== "api-key") throw new Error("invalid auth mode");
      options.auth = value;
    } else if (flag === "--case") options.caseId = value;
    else if (flag === "--model") options.model = value;
    else options.baseline = value;
  }
  if (options.execute && (options.check || options.list)) throw new Error("--execute conflicts with --check/--list");
  if (options.execute && (!options.host || !options.model)) throw new Error("--execute requires explicit --host and --model");
  if (options.suite === "routing" && options.baseline === "none") throw new Error("routing comparison requires an actual catalogue baseline, not none");
  return options;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  if (args.length === 1 && args[0] === "--help") { console.log(help); return 0; }
  const options = parseOptions(args);
  const scenarios = parseScenarios(JSON.parse(readFileSync(join(root, "evals/scenarios.json"), "utf8")));
  const catalogue = loadCatalogue(root);
  for (const scenario of scenarios) if (!catalogue.skills.some(skill => skill.name === scenario.skill)) throw new Error(`scenario skill unavailable: ${scenario.skill}`);
  if (options.check) { console.log(`Validated ${scenarios.filter(s => s.kind === "behavior").length} behavior and ${scenarios.filter(s => s.kind === "routing").length} routing cases.`); return 0; }
  const selected = scenarios.filter(s => s.kind === options.suite && (!options.caseId || s.id === options.caseId));
  if (!selected.length) throw new Error("no matching scenarios");
  if (options.list) { selected.forEach(s => console.log(`${s.id}\t${s.skill}`)); return 0; }
  const variants = [{ name: "current", catalogue }];
  if (options.baseline) variants.push({ name: options.baseline === "none" ? "without-skill" : "previous", catalogue: options.baseline === "none" ? emptyCatalogue() : loadCatalogue(resolve(options.baseline)) });
  const plannedRuns = selected.length * variants.length * options.repeats;
  console.log(`${options.execute ? "Execute" : "Preview"}: ${plannedRuns} runs; <=${options.maxCalls} adapter calls, ${options.budgetSeconds}s run-loop budget; ${options.maxSteps} steps/run. Evidence: controlled simulation.`);
  if (!options.execute) { console.log("No model invoked. Use --list to select a case, then --execute with explicit host/model and sufficient --max-runs."); return 0; }
  if (plannedRuns > options.maxRuns) throw new Error(`${plannedRuns} runs exceed --max-runs ${options.maxRuns}; select --case or explicitly raise the limit`);

  const adapter = await createAdapter(options.host!, options.model!, options.auth);
  mkdirSync(join(root, ".eval-results"), { recursive: true });
  if (lstatSync(join(root, ".eval-results")).isSymbolicLink()) throw new Error("evaluation output directory must not be a symlink");
  const output = mkdtempSync(join(root, ".eval-results/run-"));
  const deadline = Date.now() + options.budgetSeconds * 1000;
  let calls = 0;
  const boundedAdapter: ModelAdapter = { ...adapter, complete: request => adapter.complete({ ...request, timeoutMs: Math.min(request.timeoutMs, Math.max(1, deadline - Date.now())) }) };
  const runs: RunResult[] = [];
  const runnerSources = ["scripts/eval-skills.ts", ...readdirSync(join(root, "scripts/evals")).filter(name => name.endsWith(".ts")).sort().map(name => `scripts/evals/${name}`)];
  const runnerHash = hash(runnerSources.map(path => [path, readFileSync(join(root, path), "utf8")]));
  writeFileSync(join(output, "manifest.json"), JSON.stringify({ evidence: "controlled-simulation", options, startedAt: new Date().toISOString(), runnerHash, bunVersion: Bun.version, hostVersion: adapter.version, plannedRuns, catalogueHashes: variants.map(v => ({ variant: v.name, hash: v.catalogue.hash })) }, null, 2));
  for (let repeat = 1; repeat <= options.repeats; repeat++) {
    for (const scenario of selected) {
      for (const variant of repeat % 2 ? variants : [...variants].reverse()) {
        const run = await runScenario(scenario, variant.catalogue, boundedAdapter, {
          variant: variant.name, repeat, maxSteps: options.maxSteps, timeoutMs: options.timeoutSeconds * 1000,
          beforeCall() {
            if (Date.now() >= deadline) throw new Error("total time budget exhausted");
            if (calls >= options.maxCalls) throw new Error("total model call budget exhausted");
            calls++;
          },
        });
        runs.push(run);
        writeFileSync(join(output, `${scenario.id}-${variant.name}-${repeat}.json`), JSON.stringify(run, null, 2));
        writeFileSync(join(output, "report.md"), summarize(runs));
        console.log(`${scenario.id} / ${variant.name} / ${repeat}: ${run.outcome} (${run.calls} calls)`);
      }
    }
  }
  console.log(`Report: ${join(output, "report.md")}`);
  return runs.every(run => run.outcome === "pass") ? 0 : 1;
}

if (import.meta.main) {
  try { process.exitCode = await main(); }
  catch (error: unknown) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
}
