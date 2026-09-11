import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { listTemplates, parseTemplate, renderRule, run } from "../skills/peaklab.sync-ai-docs/scripts/render-rule.ts";

const skillRoot = resolve(import.meta.dir, "../skills/peaklab.sync-ai-docs");
const unscoped = ["patterns/multi-tenant", "patterns/server-actions", "validation-auth/better-auth"];

describe("bundled rule rendering", () => {
  test("repository rules match their declared template inputs", () => {
    for (const language of ["typescript", "python"]) {
      const output = readFileSync(resolve(import.meta.dir, `../.agents/rules/${language}.md`), "utf8");
      expect(output).toBe(renderRule(`languages/${language}`));
    }
  });
  test("every catalogue asset has valid metadata and renders deterministically", () => {
    const ids = listTemplates();
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const output = renderRule(id);
      const parsed = parseTemplate(output);
      expect(renderRule(id)).toBe(output);
      expect(parsed.paths === undefined).toBe(unscoped.includes(id));
      expect(output).not.toMatch(/\/Users\/|\/home\/|~\/\.agents\/templates/);
    }
  });

  test("scope override updates YAML and body without changing rules", () => {
    const original = parseTemplate(renderRule("languages/typescript"));
    const output = parseTemplate(renderRule("languages/typescript", ["src/**/*.ts", "tests/**/*.ts", "src/**/*.ts"]));
    expect(output.paths).toEqual(["src/**/*.ts", "tests/**/*.ts"]);
    expect(output.body).toBe(original.body.replace(/^Scope: .+$/m, "Scope: src/**/*.ts, tests/**/*.ts"));
  });

  test("security templates cannot accidentally become path-scoped", () => {
    for (const id of unscoped) expect(() => renderRule(id, ["src/**"])).toThrow("unscoped");
  });

  test("rejects traversal and unknown templates", () => {
    for (const id of ["../SKILL", "/etc/passwd", "languages/../../secret", "languages/missing", "languages/typescript.md"]) {
      expect(() => renderRule(id)).toThrow("Unknown template");
    }
  });

  test("rejects invalid scope values and safely quotes YAML", () => {
    for (const path of ["", "../src/**", "/tmp/**", "~/src/**", "src/../../**", "src\npaths: x", "!src/**", "C:\\src"]) {
      expect(() => renderRule("languages/typescript", [path])).toThrow("project-relative");
    }
    const quoted = 'src/"quoted"/**/*.ts';
    expect(parseTemplate(renderRule("languages/typescript", [quoted])).paths).toEqual([quoted]);
  });

  test("malformed template metadata fails instead of silently losing scope", () => {
    for (const text of ["---\npaths: [\n---\n# Rule\nScope: all\n", "---\npaths: []\n---\n# Rule\nScope: all\n", "---\nother: x\n---\n# Rule\nScope: all\n", "# Rule\n", "---\npaths: x"]) {
      expect(() => parseTemplate(text)).toThrow();
    }
  });

  test("CLI rejects ambiguous modes and unsupported write flags", () => {
    for (const args of [[], ["--apply"], ["--list", "--template", "languages/python"], ["--template", "languages/python", "--template", "languages/php"], ["--path", "src/**"]]) {
      expect(() => run(args)).toThrow();
    }
    expect(JSON.parse(run(["--list"]))).toEqual(listTemplates());
  });

  test("copied skill runs outside the repository without a build or dependencies", () => {
    const temp = mkdtempSync(join(tmpdir(), "rule-skill-test-"));
    try {
      const installed = join(temp, "installed-skill");
      cpSync(skillRoot, installed, { recursive: true });
      const before = readdirSync(temp);
      const result = Bun.spawnSync([process.execPath, join(installed, "scripts/render-rule.ts"), "--template", "languages/typescript"], { cwd: temp });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toBe(renderRule("languages/typescript"));
      expect(readdirSync(temp)).toEqual(before);
      const failed = Bun.spawnSync([process.execPath, join(installed, "scripts/render-rule.ts"), "--apply"], { cwd: temp });
      expect(failed.exitCode).toBe(1);
      expect(failed.stdout.toString()).toBe("");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
