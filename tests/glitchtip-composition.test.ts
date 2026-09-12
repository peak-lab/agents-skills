import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalogue } from "../scripts/evals/catalogue.ts";

const root = join(import.meta.dir, "..");
const canonical = "peaklab.glitchtip-do-issue";
const retired = "peaklab.fix-glitchtip";

test("GlitchTip repair has one discoverable entrypoint and no retired dependency", () => {
  const catalogue = loadCatalogue(root);
  expect(catalogue.skills.filter(skill => skill.name === canonical)).toHaveLength(1);
  expect(catalogue.skills.some(skill => skill.name === retired)).toBe(false);
  expect(existsSync(join(root, "skills", retired, "SKILL.md"))).toBe(false);
  for (const content of Object.values(catalogue.files)) expect(content).not.toContain(retired);
  for (const path of ["README.md", "docs/team-workflows.md", "skill-dependencies.json"]) {
    expect(readFileSync(join(root, path), "utf8")).not.toContain(retired);
  }
});

test("static contract: inline remains explicit, bounded and uses shared review and resolution gates", () => {
  const text = readFileSync(join(root, "skills", canonical, "SKILL.md"), "utf8");
  expect(text).toContain("Isolation is the\ndefault");
  expect(text).toContain("`--inline` conflicts with `--swarm` and `--async-merge`");
  expect(text).toContain("Never stack it on the previous unmerged PR");
  expect(text).toContain("single official QA/delivery owner");
  expect(text).toContain("Do not refetch the inbox");
  expect(text).toContain("references/glitchtip-contract.md");
  expect(text).toContain("../peaklab.gh-do-issue/references/execution.md");
});
