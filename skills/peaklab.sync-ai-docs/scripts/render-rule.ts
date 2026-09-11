import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const templateRoot = fileURLToPath(new URL("../assets/templates/", import.meta.url));
const validId = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;

export function listTemplates(root = templateRoot): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(category => {
    if (!category.isDirectory()) return [];
    return readdirSync(join(root, category.name), { withFileTypes: true })
      .filter(file => file.isFile() && file.name.endsWith(".md"))
      .map(file => `${category.name}/${file.name.slice(0, -3)}`);
  }).filter(id => validId.test(id)).sort();
}

function validatePaths(paths: unknown): asserts paths is string[] {
  if (!Array.isArray(paths) || paths.length === 0 || paths.some(path =>
    typeof path !== "string" || !path.trim() || path !== path.trim() ||
    /[\x00-\x1f\x7f\\:]/.test(path) || path.startsWith("/") ||
    path.startsWith("~") || path.startsWith("!") || path.split("/").includes("..")
  )) throw new Error("Paths must be nonempty project-relative globs without traversal or control characters");
}

export function parseTemplate(text: string): { body: string; paths?: string[] } {
  const normalized = text.replace(/\r\n/g, "\n");
  let body = normalized;
  let paths: string[] | undefined;
  if (normalized.startsWith("---\n")) {
    const end = normalized.indexOf("\n---\n", 4);
    if (end < 0) throw new Error("Unclosed template frontmatter");
    const metadata = Bun.YAML.parse(normalized.slice(4, end));
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) ||
      Object.keys(metadata).some(key => key !== "paths")) {
      throw new Error("Template frontmatter supports only paths");
    }
    paths = (metadata as { paths?: string[] }).paths;
    if (paths !== undefined) validatePaths(paths);
    body = normalized.slice(end + 5).trimStart();
  }
  if ((body.match(/^Scope: .+$/gm) ?? []).length !== 1 || !/^# .+/m.test(body)) {
    throw new Error("Template must have a title and one Scope line");
  }
  return { body: body.trimEnd() + "\n", paths };
}

export function renderRule(id: string, paths?: string[], root = templateRoot): string {
  if (!validId.test(id) || !listTemplates(root).includes(id)) {
    throw new Error(`Unknown template: ${id}`);
  }
  const source = join(root, `${id}.md`);
  const resolved = relative(realpathSync(root), realpathSync(source));
  if (resolved.startsWith(`..${sep}`) || resolved === "..") {
    throw new Error("Template escapes its package");
  }
  const parsed = parseTemplate(readFileSync(source, "utf8"));
  if (paths !== undefined) {
    if (!parsed.paths) throw new Error("Cannot scope an unscoped security template");
    validatePaths(paths);
    parsed.paths = [...new Set(paths)];
    parsed.body = parsed.body.replace(/^Scope: .+$/m, () => `Scope: ${parsed.paths!.join(", ")}`);
  }
  const frontmatter = parsed.paths
    ? `---\npaths:\n${parsed.paths.map(path => `  - ${JSON.stringify(path)}`).join("\n")}\n---\n\n`
    : "";
  return frontmatter + parsed.body;
}

export function run(args: string[]): string {
  if (args.length === 1 && args[0] === "--list") return JSON.stringify(listTemplates(), null, 2) + "\n";
  if (args.length === 1 && args[0] === "--help") {
    return "render-rule.ts --list | --template category/name [--path 'relative/glob' ...]\nPrints to stdout only; does not write or install rules.\n";
  }
  let id: string | undefined;
  const paths: string[] = [];
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--template" && id === undefined) id = value;
    else if (flag === "--path") paths.push(value);
    else throw new Error(`Unknown or duplicate option: ${flag}`);
  }
  if (!id) throw new Error("Provide --template category/name or --list");
  return renderRule(id, paths.length ? paths : undefined);
}

if (import.meta.main) {
  try {
    process.stdout.write(run(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
