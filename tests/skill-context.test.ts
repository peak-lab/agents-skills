import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSkillContextReport, formatSkillContextReport, main } from "../scripts/skill-context.ts";

class Fixture {
  readonly root = mkdtempSync(join(tmpdir(), "skill-context-"));

  skill(name: string, description = `${name} description`): void {
    const directory = join(this.root, "skills", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  }

  dependencies(value: Record<string, string[]>): void {
    writeFileSync(join(this.root, "skill-dependencies.json"), JSON.stringify(value));
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

const fixtures: Fixture[] = [];

function fixture(): Fixture {
  const value = new Fixture();
  fixtures.push(value);
  return value;
}

afterEach(() => {
  while (fixtures.length > 0) fixtures.pop()!.dispose();
});

describe("skill context", () => {
  test("reports a sorted transitive closure and portable install command", () => {
    const catalogue = fixture();
    catalogue.skill("alpha");
    catalogue.skill("beta");
    catalogue.skill("gamma");
    catalogue.dependencies({ alpha: ["beta"], beta: ["gamma"] });

    const report = createSkillContextReport(catalogue.root, ["alpha"]);

    expect(report.measurements.map(measurement => measurement.name)).toEqual(["alpha", "beta", "gamma"]);
    expect(report.installCommand).toBe("npx skills add . --skill alpha beta gamma --agent codex claude-code");
  });

  test("terminates deterministic closure traversal at cycles", () => {
    const catalogue = fixture();
    catalogue.skill("alpha");
    catalogue.skill("beta");
    catalogue.dependencies({ alpha: ["beta"], beta: ["alpha"] });

    const report = createSkillContextReport(catalogue.root, ["beta"]);

    expect(report.measurements.map(measurement => measurement.name)).toEqual(["alpha", "beta"]);
  });

  test("rejects a missing transitive dependency", () => {
    const catalogue = fixture();
    catalogue.skill("alpha");
    catalogue.dependencies({ alpha: ["missing"] });

    expect(() => createSkillContextReport(catalogue.root, ["alpha"])).toThrow("unknown skill: missing");
  });

  test("rejects an unknown requested skill without printing a report", () => {
    const catalogue = fixture();
    catalogue.skill("alpha");
    catalogue.dependencies({});
    const output: string[] = [];
    const errors: string[] = [];

    expect(main(["--skill", "missing"], catalogue.root, line => output.push(line), line => errors.push(line))).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual(["Error: unknown skill: missing"]);
  });

  test("reports character measurements and labels them as non-token values", () => {
    const catalogue = fixture();
    catalogue.skill("alpha", "one 🧭");
    catalogue.dependencies({});

    const report = createSkillContextReport(catalogue.root);
    expect(report.measurements[0]?.nameAndDescriptionCharacters).toBe(Array.from("alphaone 🧭").length);
    expect(formatSkillContextReport(report)).toContain("Name + description characters");
    expect(formatSkillContextReport(report)).toContain("not tokens");
  });
});
