import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { validateSkillMetadata } from "../skill-metadata.ts";
import type { Catalogue } from "./types.ts";

export function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function safePath(path: string): boolean {
  return path.length > 0 && path.length <= 240 && !/[\\\x00-\x1f:]/.test(path)
    && path.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

export function loadCatalogue(root: string): Catalogue {
  const files: Record<string, string> = Object.create(null);
  const skills: Catalogue["skills"] = [];
  let bytes = 0;
  function walk(relative: string): void {
    const path = join(root, relative);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`symlink in evaluation catalogue: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(`${relative}/${name}`);
    } else if (stat.isFile() && /\.(md|py|ts|sh|json|toml|yaml|yml)$/.test(relative)) {
      if (!safePath(relative)) throw new Error(`unsafe catalogue path: ${relative}`);
      if (stat.size > 512_000 || (bytes += stat.size) > 4_000_000) throw new Error("catalogue exceeds evaluation size limit");
      files[relative] = readFileSync(path, "utf8");
    }
  }
  walk("skills");
  for (const path of Object.keys(files).filter(path => /^skills\/[^/]+\/SKILL.md$/.test(path))) {
    const metadata = validateSkillMetadata(files[path]);
    if (!metadata.name || metadata.errors.length || path !== `skills/${metadata.name}/SKILL.md`) throw new Error(`invalid skill metadata: ${path}`);
    const frontmatter = files[path].match(/^---[^\r\n]*\r?\n([\s\S]*?)\r?\n---/)?.[1];
    const description = (parse(frontmatter!) as { description: string }).description;
    skills.push({ name: metadata.name, description });
  }
  if (!skills.length) throw new Error("empty evaluation catalogue");
  return { files, skills, hash: hash(files) };
}

export function emptyCatalogue(): Catalogue {
  return { files: {}, skills: [], hash: hash({}) };
}
