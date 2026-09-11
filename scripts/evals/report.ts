import type { RunResult } from "./types.ts";

export function summarize(runs: RunResult[]): string {
  const lines = ["# Controlled skill evaluation", "", "Evidence: simulated actions and fixture artifacts, not native skill discovery or live issue delivery.", "",
    "| Variant | Runs | Pass | Fail | Error | Mean time ± SD | Input / output tokens |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- |"];
  for (const variant of new Set(runs.map(run => run.variant))) {
    const group = runs.filter(run => run.variant === variant);
    const mean = group.reduce((total, run) => total + run.durationMs, 0) / group.length;
    const sd = Math.sqrt(group.reduce((total, run) => total + (run.durationMs - mean) ** 2, 0) / group.length);
    const total = (key: "inputTokens" | "outputTokens") => group.some(run => run[key] === null) ? "unknown" : group.reduce((sum, run) => sum + run[key]!, 0);
    lines.push(`| ${variant} | ${group.length} | ${group.filter(r => r.outcome === "pass").length} | ${group.filter(r => r.outcome === "fail").length} | ${group.filter(r => r.outcome === "error").length} | ${(mean / 1000).toFixed(1)}s ± ${(sd / 1000).toFixed(1)}s | ${total("inputTokens")} / ${total("outputTokens")} |`);
  }
  const current = runs.filter(run => run.variant === "current");
  const baseline = runs.filter(run => run.variant !== "current");
  if (baseline.length && current.length === baseline.length && current.every(a => baseline.some(b => b.scenarioHash === a.scenarioHash && b.repeat === a.repeat && b.host === a.host && b.model === a.model && b.hostVersion === a.hostVersion))) {
    const rate = (group: RunResult[]) => group.filter(run => run.outcome === "pass").length / group.length;
    lines.push("", `Observed paired pass-rate delta: ${((rate(current) - rate(baseline)) * 100).toFixed(1)} percentage points. Errors remain in the denominator; this is not a significance test.`);
  }
  lines.push("", "## Results", "");
  for (const run of runs) {
    lines.push(`- ${run.scenario} / ${run.variant} / repeat ${run.repeat}: **${run.outcome}** (${run.calls} calls).`);
    if (run.error) lines.push(`  Runner error: ${run.error.replaceAll("\n", " ")}`);
    for (const check of run.checks.filter(check => !check.passed)) lines.push(`  Failed ${check.assertion.kind}: ${check.evidence.replaceAll("\n", " ").slice(0, 500)}`);
  }
  return `${lines.join("\n")}\n`;
}
