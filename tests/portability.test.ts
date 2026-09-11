import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { validate, type ValidationError } from "../scripts/check-portability.ts";

class PortabilityFixture {
  dependencies: Record<string, string[]> = {};
  skills: string[] = [];
  readmeExtra = "";

  constructor(readonly root: string) {}

  addSkill(name: string, body = "", resources: Record<string, string> = {}): void {
    const skillDir = join(this.root, "skills", name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: Fixture skill for validation.\n---\n\n${body}\n`);
    for (const [resourcePath, content] of Object.entries(resources)) {
      const resource = join(skillDir, resourcePath);
      mkdirSync(dirname(resource), { recursive: true });
      writeFileSync(resource, content);
    }
    this.skills.push(name);
  }

  validate(): ValidationError[] {
    writeFileSync(join(this.root, "skill-dependencies.json"), JSON.stringify(this.dependencies));
    writeFileSync(join(this.root, "README.md"), [...this.skills.map(name => `\`${name}\``), this.readmeExtra].join("\n"));
    return validate(this.root);
  }

  codes(): Set<string> {
    return new Set(this.validate().map(error => error.code));
  }
}

describe("portability validation", () => {
  let root: string;
  let fixture: PortabilityFixture;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "portability-"));
    fixture = new PortabilityFixture(root);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("detects a missing link from a nested resource", () => {
    fixture.addSkill("caller", "Read [the guide](references/guide.md).", {
      "references/guide.md": "Continue with [details](missing.md).",
    });
    expect(fixture.codes()).toContain("local-link-missing");
  });

  test("detects an undeclared cross-skill link from a nested resource", () => {
    fixture.addSkill("caller", "Read [the guide](references/guide.md).", {
      "references/guide.md": "Use [the shared contract](../../dependency/references/shared.md).",
    });
    fixture.addSkill("dependency", "", { "references/shared.md": "Shared contract." });
    expect(fixture.codes()).toContain("cross-skill-dependency-missing");
  });

  test("accepts a valid composed bundle with a direct dependency", () => {
    fixture.addSkill("caller", "Read [the guide](references/guide.md).", {
      "references/guide.md": "Use [the shared contract](../../dependency/references/shared.md).",
    });
    fixture.addSkill("dependency", "", { "references/shared.md": "Shared contract." });
    fixture.dependencies.caller = ["dependency"];
    expect(fixture.validate()).toEqual([]);
  });

  test("detects an undeclared installed-skill path", () => {
    fixture.addSkill("caller", "Read `~/.agents/skills/dependency/references/shared.md`.");
    fixture.addSkill("dependency");
    expect(fixture.codes()).toContain("installed-skill-dependency-missing");
  });

  test("accepts a declared installed-skill path", () => {
    fixture.addSkill("caller", "Read `~/.agents/skills/dependency/references/shared.md`.");
    fixture.addSkill("dependency");
    fixture.dependencies.caller = ["dependency"];
    expect(fixture.validate()).toEqual([]);
  });

  test("rejects executing a skill URI as a path", () => {
    fixture.addSkill("caller", 'Run `rtk python3 "skill://caller/scripts/helper.py" --check`.');
    expect(fixture.codes()).toContain("executable-skill-uri");
  });

  test("accepts resolved and non-executable skill URI mentions", () => {
    fixture.addSkill("caller", 'Resolve first, then run `python3 "$SKILL_DIR/scripts/helper.py"`. The URI `skill://caller/scripts/helper.py` identifies a resource.');
    expect(fixture.validate()).toEqual([]);
  });

  test("accepts same-skill resource links", () => {
    fixture.addSkill("caller", "Read [the guide](references/guide.md).", {
      "references/guide.md": "Read [more](nested/more.md#section).",
      "references/nested/more.md": "## Section",
    });
    expect(fixture.validate()).toEqual([]);
  });

  test("ignores external, anchor, placeholder, and fenced-example links", () => {
    fixture.addSkill("caller", ["[External](https://example.com/docs)", "[Anchor](#section)", "![Runtime image]($IMAGE_URL)", "[Placeholder](<path>)", "```markdown", "[Example only](references/not-a-real-file.md)", "```"].join("\n"));
    expect(fixture.validate()).toEqual([]);
  });

  test("detects machine paths in nested resources and helpers", () => {
    fixture.addSkill("caller", "", {
      "references/guide.md": "Open `/Users/alice/private/config.json`.",
      "scripts/helper.py": "ROOT = '/Users/alice/private'",
    });
    const errors = fixture.validate();
    expect(errors.map(error => error.code)).toContain("machine-specific-home");
    expect(errors.map(error => error.path)).toEqual(expect.arrayContaining([
      "skills/caller/references/guide.md", "skills/caller/scripts/helper.py",
    ]));
  });

  test("detects a missing link from the README", () => {
    fixture.addSkill("caller");
    fixture.readmeExtra = "[Missing guide](docs/missing.md)";
    expect(fixture.codes()).toContain("local-link-missing");
  });

  test.each([
    "/Users/alice", "/home/alice", "/root", "/root/.config",
    "'/Users/alice'", '"/home/alice"', "`/root`",
    "C:\\Users\\alice", "D:/Users/alice/config", "c:\\users\\Alice Smith\\config",
    String.raw`"C:\\Users\\alice\\config"`,
  ])("detects a machine home path: %s", path => {
    fixture.addSkill("caller", "", { "scripts/helper.ts": `const location = ${path};` });
    expect(fixture.codes()).toContain("machine-specific-home");
  });

  test.each([
    "docs/Users/alice", "./home/alice", "../root", "/rooted/config",
    "https://example.com/home/alice", "~/projects", "$HOME/config", "/users/me/",
    "C:\\projects\\Users\\alice", "Users/alice", "/home/${USER}/config", "<root>content</root>",
  ])("accepts non-machine-home references: %s", path => {
    fixture.addSkill("caller", "", { "scripts/helper.ts": path });
    expect(fixture.validate()).toEqual([]);
  });

  test("reports a missing README instead of crashing", () => {
    fixture.addSkill("caller");
    writeFileSync(join(root, "skill-dependencies.json"), "{}");
    expect(validate(root).map(error => error.code)).toContain("readme-missing");
  });

  test("checks rule links from project instruction entrypoints", () => {
    fixture.addSkill("caller");
    writeFileSync(join(root, "AGENTS.md"), "Read [the rule](.agents/rules/missing.md).");
    expect(fixture.codes()).toContain("local-link-missing");
  });

  test("checks links within generated project rules", () => {
    fixture.addSkill("caller");
    mkdirSync(join(root, ".agents/rules"), { recursive: true });
    writeFileSync(join(root, ".agents/rules/test.md"), "Read [detail](absent.md).");
    expect(fixture.codes()).toContain("local-link-missing");
  });

  test("accepts documentation links to bundled repository files", () => {
    fixture.addSkill("caller");
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "docs", "guide.md"), "Read [the package](../skills/caller/SKILL.md).");
    fixture.readmeExtra = "[Team guide](docs/guide.md)";
    expect(fixture.validate()).toEqual([]);
  });

  test("rejects a link that escapes the distribution", () => {
    const outside = join(dirname(root), `${relative(tmpdir(), root)}-outside.md`);
    writeFileSync(outside, "Outside.");
    fixture.addSkill("caller", `[Outside](../../${outside.split("/").at(-1)})`);
    expect(fixture.codes()).toContain("local-link-outside-distribution");
    rmSync(outside, { force: true });
  });

  test("requires a bounded frontmatter name", () => {
    mkdirSync(join(root, "skills", "caller"), { recursive: true });
    writeFileSync(join(root, "skills", "caller", "SKILL.md"), "# Invalid skill\n\nname: caller\n");
    fixture.skills.push("caller");
    expect(fixture.codes()).toContain("skill-name-missing");
  });

  test("rejects invalid skill metadata through the catalogue validator", () => {
    fixture.addSkill("caller");
    writeFileSync(join(root, "skills/caller/SKILL.md"), "---\nname: caller\ndescription: []\n---\n");
    expect(fixture.codes()).toContain("skill-metadata-invalid");
  });

  test("reports missing and invalid dependency manifests", () => {
    fixture.addSkill("caller");
    writeFileSync(join(root, "README.md"), "`caller`");
    expect(validate(root).map(error => error.code)).toContain("manifest-missing");
    writeFileSync(join(root, "skill-dependencies.json"), "{");
    expect(validate(root).map(error => error.code)).toContain("manifest-invalid");
  });

  test("reports an empty catalogue", () => {
    writeFileSync(join(root, "skill-dependencies.json"), "{}");
    writeFileSync(join(root, "README.md"), "# Empty");
    expect(validate(root).map(error => error.code)).toEqual(["catalogue-empty"]);
  });

  test("rejects a symlinked Markdown link that escapes the distribution", () => {
    fixture.addSkill("caller", "Read [guide](references/guide.md).");
    const outside = join(dirname(root), `${relative(tmpdir(), root)}-guide.md`);
    writeFileSync(outside, "Outside.");
    mkdirSync(join(root, "skills", "caller", "references"));
    symlinkSync(outside, join(root, "skills", "caller", "references", "guide.md"));
    expect(fixture.codes()).toContain("local-link-outside-distribution");
    rmSync(outside, { force: true });
  });

  test("recognizes reference links and percent-encoded local files", () => {
    fixture.addSkill("caller", "Read [guide][guide].\n\n[guide]: references/guide%20file.md", {
      "references/guide file.md": "Ready.",
    });
    expect(fixture.validate()).toEqual([]);
  });

  test("reports manifest callers and dependencies that are not bundled", () => {
    fixture.addSkill("caller");
    fixture.dependencies = { missingCaller: ["caller"], caller: ["missingDependency"] };
    expect(fixture.codes()).toEqual(new Set(["manifest-caller-missing", "manifest-dependency-missing"]));
  });

  test("reports mismatched and duplicate skill names", () => {
    fixture.addSkill("caller");
    for (const directory of ["mismatch", "duplicate"]) {
      mkdirSync(join(root, "skills", directory), { recursive: true });
      writeFileSync(join(root, "skills", directory, "SKILL.md"), "---\nname: caller\ndescription: Fixture for naming validation.\n---\n");
    }
    fixture.skills.push("mismatch", "duplicate");
    expect(fixture.codes()).toContain("skill-name-directory-mismatch");
    expect(fixture.codes()).toContain("skill-name-duplicate");
  });

  test("reports missing and undeclared Skill() dependencies", () => {
    fixture.addSkill("caller", "Skill(\"missing\")\nSkill(\"dependency\")");
    fixture.addSkill("dependency");
    expect(fixture.codes()).toContain("skill-call-target-missing");
    expect(fixture.codes()).toContain("skill-call-dependency-missing");
  });

  test("rejects stale Plane and colon-namespaced PeakLab skill names in prose", () => {
    fixture.addSkill("caller", [
      "plane:create-issue plane:do-issue plane:ship-watch plane:status plane:archive plane:api plane:init",
      "peaklab:sync-ai-docs peaklab:improve-skill",
      "peaklab:apex and peaklab:custom-plugin remain valid plugin namespaces.",
    ].join("\n"));
    const stale = fixture.validate().filter(error => error.code === "legacy-skill-name");
    expect(stale).toHaveLength(9);
  });
});

test("the repository is a valid composed bundle", () => {
  expect(validate(import.meta.dir + "/..")).toEqual([]);
});
