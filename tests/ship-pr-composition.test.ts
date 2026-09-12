import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const skill = readFileSync("skills/peaklab.ship-pr/SKILL.md", "utf8");
const caller = readFileSync("skills/peaklab.gh-do-issue/references/execution.md", "utf8");

test("static shipping contract keeps one persisted correction loop across the handoff", () => {
  for (const field of ["repair_budget", "repair_attempts", "ci_wait_seconds"]) {
    expect(skill).toContain(field);
    expect(caller).toContain(field);
  }
  expect(skill).toContain("BEFORE editing");
  expect(skill).toContain("blocked: repair_budget_exhausted");
  expect(skill).toContain("blocked: no_progress");
  expect(skill).toContain("blocked: ci_wait_exhausted");
  expect(skill).not.toContain("--watch");
  expect(skill).toContain("last allowed repair");
});

test("static shipping contract preserves review, merge identity and sync boundaries", () => {
  expect(skill).toContain("do not launch another full review");
  expect(skill).toContain("Do not reopen a closed finding without new evidence");
  expect(skill).toContain("--match-head-commit");
  expect(skill).toContain("state=MERGED");
  expect(skill).toContain("ci_not_configured_no_remote_checks");
  expect(skill).toContain("not_checked_pr_only");
  expect(skill).toContain("plane_sync=failed");
  expect(skill).toContain("Unknown protection settings are not evidence of absence");
});
