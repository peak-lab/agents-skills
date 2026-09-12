import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseDocument } from "yaml";
import { validateSkillMetadata } from "./skill-metadata.ts";

export interface SkillContextMeasurement {
  name: string;
  skillBytes: number;
  nameAndDescriptionCharacters: number;
}

export interface SkillContextReport {
  measurements: SkillContextMeasurement[];
  installCommand?: string;
}

type Dependencies = Record<string, string[]>;

const frontmatterPattern = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function characterCount(value: string): number {
  return Array.from(value).length;
}

function readSkillMeasurement(skillPath: string): SkillContextMeasurement {
  const text = readFileSync(skillPath, "utf8");
  const validation = validateSkillMetadata(text);
  if (validation.errors.length > 0 || validation.name === undefined) {
    throw new Error(`invalid skill metadata: ${skillPath}`);
  }
  const frontmatter = text.match(frontmatterPattern)?.[1];
  if (frontmatter === undefined) throw new Error(`missing frontmatter: ${skillPath}`);

  const document = parseDocument(frontmatter, { uniqueKeys: true });
  if (document.errors.length > 0 || !isRecord(document.toJS())) throw new Error(`invalid frontmatter: ${skillPath}`);
  const metadata = document.toJS() as Record<string, unknown>;
  if (typeof metadata.name !== "string" || typeof metadata.description !== "string" || metadata.name !== validation.name) throw new Error(`invalid skill metadata: ${skillPath}`);

  return {
    name: metadata.name,
    skillBytes: Buffer.byteLength(text, "utf8"),
    nameAndDescriptionCharacters: characterCount(metadata.name) + characterCount(metadata.description),
  };
}

function readDependencies(root: string): Dependencies {
  const manifestPath = join(root, "skill-dependencies.json");
  if (!existsSync(manifestPath)) throw new Error("skill-dependencies.json is missing");

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    throw new Error("skill-dependencies.json is invalid");
  }
  if (!isRecord(parsed) || Object.values(parsed).some(value => !Array.isArray(value) || value.some(item => typeof item !== "string"))) {
    throw new Error("skill-dependencies.json must map skill names to string arrays");
  }
  return parsed as Dependencies;
}

function loadSkills(root: string): Map<string, SkillContextMeasurement> {
  const skillsPath = join(root, "skills");
  if (!existsSync(skillsPath)) throw new Error("skills directory is missing");

  const skills = new Map<string, SkillContextMeasurement>();
  for (const entry of readdirSync(skillsPath, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    const skillPath = join(skillsPath, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    const measurement = readSkillMeasurement(skillPath);
    if (measurement.name !== entry.name) throw new Error(`skill name does not match its directory: ${basename(dirname(skillPath))}`);
    skills.set(measurement.name, measurement);
  }
  return skills;
}

export function resolveDependencyClosure(skills: ReadonlyMap<string, SkillContextMeasurement>, dependencies: Dependencies, requested: readonly string[]): string[] {
  const resolved = new Set<string>();
  const visit = (name: string): void => {
    if (!skills.has(name)) throw new Error(`unknown skill: ${name}`);
    if (resolved.has(name)) return;
    resolved.add(name);
    for (const dependency of [...(dependencies[name] ?? [])].sort((left, right) => left.localeCompare(right))) visit(dependency);
  };

  for (const name of [...requested].sort((left, right) => left.localeCompare(right))) visit(name);
  return [...resolved].sort((left, right) => left.localeCompare(right));
}

export function createSkillContextReport(root: string, requested: readonly string[] = []): SkillContextReport {
  const skills = loadSkills(root);
  const dependencies = readDependencies(root);
  const names = requested.length === 0
    ? [...skills.keys()].sort((left, right) => left.localeCompare(right))
    : resolveDependencyClosure(skills, dependencies, requested);

  return {
    measurements: names.map(name => skills.get(name)!),
    ...(requested.length === 0 ? {} : { installCommand: `npx skills add . --skill ${names.join(" ")} --agent codex claude-code` }),
  };
}

export function formatSkillContextReport(report: SkillContextReport): string {
  const lines = [
    "Catalogue context measurements (bytes and characters, not tokens)",
    "Skill | SKILL.md bytes | Name + description characters",
    "--- | ---: | ---:",
    ...report.measurements.map(measurement => `${measurement.name} | ${measurement.skillBytes} | ${measurement.nameAndDescriptionCharacters}`),
  ];
  if (report.installCommand !== undefined) lines.push("", "Portable install command (not executed):", report.installCommand);
  return lines.join("\n");
}

export function main(args = process.argv.slice(2), root = resolve(import.meta.dir, ".."), write = console.log, writeError = console.error): number {
  const requested: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--skill") {
      writeError(`Error: unknown argument: ${args[index]}`);
      return 1;
    }
    const name = args[index + 1];
    if (name === undefined || name.startsWith("--")) {
      writeError("Error: --skill requires a skill name");
      return 1;
    }
    requested.push(name);
    index += 1;
  }

  try {
    write(formatSkillContextReport(createSkillContextReport(root, requested)));
    return 0;
  } catch (error) {
    writeError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main();
