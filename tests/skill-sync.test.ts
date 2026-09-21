import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { applySyncPlan, candidateReport, createSyncPlan, restoreBackup } from "../scripts/skill-sync.ts";

class Fixture {
  readonly root = mkdtempSync(join(tmpdir(), "skill-sync-source-"));
  readonly target = join(this.root, "consumer", "skills");

  constructor() {
    mkdirSync(join(this.root, "skills"), { recursive: true });
    writeFileSync(join(this.root, "skill-dependencies.json"), JSON.stringify({ alpha: ["beta"] }));
    writeFileSync(join(this.root, "skill-profiles.json"), JSON.stringify({ version: 1, profiles: { core: ["alpha"] } }));
  }

  skill(name: string, body: string): void {
    const directory = join(this.root, "skills", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} description\n---\n\n${body}\n`);
  }

  local(name: string, body: string): void {
    const directory = join(this.target, name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} description\n---\n\n${body}\n`);
  }

  dispose(): void { rmSync(this.root, { recursive: true, force: true }); }
}

const fixtures: Fixture[] = [];
function fixture(): Fixture { const value = new Fixture(); fixtures.push(value); return value; }
afterEach(() => { while (fixtures.length) fixtures.pop()!.dispose(); });

describe("skill synchronization", () => {
  test("expands a profile through internal dependencies for a fresh install", () => {
    const value = fixture();
    value.skill("alpha", "source alpha");
    value.skill("beta", "source beta");

    const plan = createSyncPlan(value.root, value.target, { profiles: ["core"] });

    expect(plan.items.map(item => [item.name, item.action])).toEqual([["alpha", "install"], ["beta", "install"]]);
    const backup = applySyncPlan(value.root, plan, { profiles: ["core"] });
    expect(backup).toBeUndefined();
    expect(readFileSync(join(value.target, "alpha", "SKILL.md"), "utf8")).toContain("source alpha");
    expect(existsSync(join(value.target, ".peaklab-skill-state.json"))).toBe(true);
  });

  test("refuses an unmanaged divergent installation until repository adoption is explicit", () => {
    const value = fixture();
    value.skill("alpha", "source alpha");
    value.skill("beta", "source beta");
    value.local("alpha", "personal alpha");

    const blocked = createSyncPlan(value.root, value.target, { skills: ["alpha"] });
    expect(blocked.items.find(item => item.name === "alpha")?.action).toBe("conflict");

    const adopted = createSyncPlan(value.root, value.target, { skills: ["alpha"], adoptRepository: true });
    expect(adopted.items.find(item => item.name === "alpha")?.action).toBe("replace-unmanaged");
    const backup = applySyncPlan(value.root, adopted);
    expect(backup).toBeDefined();
    expect(readFileSync(join(value.target, "alpha", "SKILL.md"), "utf8")).toContain("source alpha");
    expect(readFileSync(join(backup!, "alpha", "SKILL.md"), "utf8")).toContain("personal alpha");
  });

  test("updates an unchanged baseline and restores its backup", () => {
    const value = fixture();
    value.skill("alpha", "version one");
    value.skill("beta", "beta");
    const installed = createSyncPlan(value.root, value.target, { skills: ["alpha"] });
    applySyncPlan(value.root, installed);
    writeFileSync(join(value.root, "skills", "alpha", "SKILL.md"), "---\nname: alpha\ndescription: alpha description\n---\n\nversion two\n");

    const update = createSyncPlan(value.root, value.target, { skills: ["alpha"] });
    expect(update.items.find(item => item.name === "alpha")?.action).toBe("update");
    const backup = applySyncPlan(value.root, update);
    expect(readFileSync(join(value.target, "alpha", "SKILL.md"), "utf8")).toContain("version two");
    restoreBackup(value.target, backup!);
    expect(readFileSync(join(value.target, "alpha", "SKILL.md"), "utf8")).toContain("version one");
  });

  test("does not overwrite a local edit after a recorded baseline", () => {
    const value = fixture();
    value.skill("alpha", "source alpha");
    value.skill("beta", "source beta");
    applySyncPlan(value.root, createSyncPlan(value.root, value.target, { skills: ["alpha"] }));
    writeFileSync(join(value.target, "alpha", "SKILL.md"), "---\nname: alpha\ndescription: alpha description\n---\n\nlocal edit\n");

    const plan = createSyncPlan(value.root, value.target, { skills: ["alpha"] });

    expect(plan.items.find(item => item.name === "alpha")?.action).toBe("conflict");
    expect(() => applySyncPlan(value.root, plan)).toThrow("unresolved conflicts");
  });

  test("reports local-only and divergent candidates without writing", () => {
    const value = fixture();
    value.skill("alpha", "source alpha");
    value.skill("beta", "source beta");
    value.local("alpha", "different alpha");
    value.local("private-tool", "private");

    const report = candidateReport(value.root, value.target);

    expect(report).toContain("alpha | divergent");
    expect(report).toContain("private-tool | local-only");
    expect(existsSync(join(value.target, ".peaklab-skill-state.json"))).toBe(false);
  });

  test("runs under plain Node with no installed packages, as the agent-qa deploy hook does", () => {
    const value = fixture();
    value.skill("alpha", "source alpha");
    value.skill("beta", "source beta");
    mkdirSync(join(value.root, "scripts"));
    for (const script of ["skill-sync.ts", "skill-dependencies.ts"]) copyFileSync(resolve(import.meta.dir, "..", "scripts", script), join(value.root, "scripts", script));

    const run = spawnSync("node", [join(value.root, "scripts", "skill-sync.ts"), "apply", "--target", value.target, "--profile", "core"], { encoding: "utf8" });

    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(readFileSync(join(value.target, "beta", "SKILL.md"), "utf8")).toContain("source beta");
  });

  test("every published profile resolves to bundled skills and dependencies", () => {
    const root = resolve(import.meta.dir, "..");
    const target = join(fixture().root, "consumer", "skills");
    const profiles = ["core", "development", "peaklab", "service-adapters", "optional"];

    for (const profile of profiles) {
      const plan = createSyncPlan(root, target, { profiles: [profile] });
      expect(plan.items.length).toBeGreaterThan(0);
      expect(plan.items.every(item => item.action === "install")).toBe(true);
    }
  });
});
