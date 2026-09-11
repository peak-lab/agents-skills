#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSkillMetadata } from "./skill-metadata.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDirectory = "skills";
const skillCallPattern = /Skill\(\s*["']([^"']+)["']/g;
const installedSkillPattern = /~\/.agents\/skills\/([A-Za-z0-9_.-]+)/g;
const executableSkillUriPattern = /(?<![\w.-])(?:rtk[ \t]+(?:proxy[ \t]+)?)?(?:python(?:3(?:\.\d+)?)?|bash|sh|node|bun|deno|ruby|php|perl|source)[ \t]+(?:-[^\s`"']+[ \t]+)*["']?skill:\/\/[A-Za-z0-9_.-]+(?:\/[^\s`"']*)?/;
const inlineLinkPattern = /!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+[^)]*)?\)/g;
const referenceLinkPattern = /^[ \t]{0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm;
const inlineCodePattern = /`[^`\n]*`/g;
const legacyNamePatterns = [
  /\bpeaklab\.do-issue\b/,
  /\bpeaklab\.create-issue\b/,
  /(?<!peaklab\.)\bglitchtip-do-issue\b/,
  /(?<![\w.-])plane:(?:create-issue|do-issue|ship-watch|status|archive|api|init)\b/,
  /(?<![\w.-])peaklab:(?:sync-ai-docs|improve-skill)\b/,
];
const machinePathPattern = /(?<![\w./\\<-])(?:\/(?:Users|home)\/[\w.@-]+|\/root|[a-zA-Z]:[/\\]+[Uu][Ss][Ee][Rr][Ss][/\\]+[\w.@-]+)(?=$|[/\\\s`"'<>)\],;])/;
const textResourceSuffixes = new Set([".cfg", ".ini", ".js", ".json", ".jsx", ".md", ".mjs", ".py", ".sh", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

function addError(errors: ValidationError[], code: string, message: string, path?: string): void {
  errors.push({ code, message, ...(path === undefined ? {} : { path }) });
}

function relativePath(rootPath: string, path: string): string {
  return relative(rootPath, path);
}

function withoutFencedCode(text: string): string {
  const lines: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  for (const line of text.split(/\r?\n/)) {
    const marker = line.trimStart().match(/^(`{3,}|~{3,})/)?.[1];
    if (fence) {
      if (marker && marker[0] === fence.marker && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (marker) {
      fence = { marker: marker[0], length: marker.length };
      continue;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function markdownLinkTargets(text: string): string[] {
  const prose = withoutFencedCode(text).replace(inlineCodePattern, "");
  return [...prose.matchAll(inlineLinkPattern), ...prose.matchAll(referenceLinkPattern)].map(match => match[1]);
}

function isPlaceholder(target: string): boolean {
  return target.startsWith("#") || target.includes("$") || target.includes("{") || target.includes("}") || ["...", "<path>", "<url>"].includes(target);
}

function filesRecursively(directory: string, predicate: (path: string) => boolean): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesRecursively(path, predicate));
    else if ((entry.isFile() || (entry.isSymbolicLink() && existsSync(path) && statSync(path).isFile())) && predicate(path)) files.push(path);
  }
  return files.sort();
}

function resolvePotentialPath(path: string): string {
  const tail: string[] = [];
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    tail.unshift(basename(current));
    current = parent;
  }
  return join(realpathSync(current), ...tail);
}

function localLinkPath(target: string): string | undefined {
  const unwrapped = target.startsWith("<") && target.endsWith(">") ? target.slice(1, -1) : target;
  if (isPlaceholder(unwrapped) || unwrapped.startsWith("//")) return undefined;
  const noFragment = unwrapped.split(/[?#]/, 1)[0];
  const scheme = noFragment.match(/^([A-Za-z][A-Za-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && scheme !== "file") return undefined;
  if (scheme === "file" && /^file:\/\//i.test(noFragment) && new URL(noFragment).host) return undefined;
  const rawPath = scheme === "file" ? noFragment.slice(5).replace(/^\/\//, "/") : noFragment;
  if (!rawPath) return undefined;
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

function skillNameForPath(path: string, skills: Map<string, string>): string | undefined {
  const parts = path.split(sep);
  return parts.length >= 2 && parts[0] === skillsDirectory && skills.has(parts[1]) ? parts[1] : undefined;
}

function validateLocalLink(options: {
  root: string; source: string; owner?: string; target: string; skills: Map<string, string>;
  declaredPairs: Set<string>; errors: ValidationError[];
}): void {
  const { root: rootPath, source, owner, target, skills, declaredPairs, errors } = options;
  if (isPlaceholder(target)) return;
  const linkPath = localLinkPath(target);
  if (!linkPath) return;
  const candidate = resolvePotentialPath(isAbsolute(linkPath) ? linkPath : join(dirname(source), linkPath));
  const sourcePath = relativePath(rootPath, source);
  const rootResolved = realpathSync(rootPath);
  const candidateRelative = relative(rootResolved, candidate);
  if (candidateRelative === ".." || candidateRelative.startsWith(`..${sep}`) || isAbsolute(candidateRelative)) {
    addError(errors, "local-link-outside-distribution", `local Markdown link escapes the distribution: ${target}`, sourcePath);
    return;
  }
  if (owner) {
    const targetOwner = skillNameForPath(candidateRelative, skills);
    if (!targetOwner) {
      addError(errors, "local-link-outside-distribution", `local Markdown link targets an unbundled path: ${target}`, sourcePath);
      return;
    }
    if (targetOwner !== owner && !declaredPairs.has(`${owner}\0${targetOwner}`)) {
      addError(errors, "cross-skill-dependency-missing", `link to ${targetOwner} requires a direct dependency declaration`, sourcePath);
    }
  }
  if (!existsSync(candidate)) addError(errors, "local-link-missing", `local Markdown link target does not exist: ${target}`, sourcePath);
}

export function validate(inputRoot: string): ValidationError[] {
  const rootPath = realpathSync(inputRoot);
  const errors: ValidationError[] = [];
  const skills = new Map<string, string>();
  const skillsPath = join(rootPath, skillsDirectory);
  const skillFiles = existsSync(skillsPath)
    ? readdirSync(skillsPath, { withFileTypes: true }).filter(entry => entry.isDirectory() && existsSync(join(skillsPath, entry.name, "SKILL.md"))).map(entry => join(skillsPath, entry.name, "SKILL.md")).sort()
    : [];
  if (skillFiles.length === 0) addError(errors, "catalogue-empty", "no bundled skills found");

  for (const skillFile of skillFiles) {
    const text = readFileSync(skillFile, "utf8");
    const skillPath = relativePath(rootPath, skillFile);
    const metadata = validateSkillMetadata(text);
    const name = metadata.name;
    for (const error of metadata.errors) addError(errors, error.code, error.message, skillPath);
    if (!name) {
      continue;
    }
    if (name !== basename(dirname(skillFile))) addError(errors, "skill-name-directory-mismatch", `name '${name}' must match its directory`, skillPath);
    if (skills.has(name)) addError(errors, "skill-name-duplicate", `duplicate skill name: ${name}`);
    skills.set(name, skillFile);
  }

  let dependencies: Record<string, string[]> = {};
  const manifestPath = join(rootPath, "skill-dependencies.json");
  if (!existsSync(manifestPath)) {
    addError(errors, "manifest-missing", "skill-dependencies.json is missing");
  } else {
    try {
      const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some(value => !Array.isArray(value) || value.some(item => typeof item !== "string"))) {
        throw new TypeError("dependency manifest must map callers to string arrays");
      }
      dependencies = parsed as Record<string, string[]>;
    } catch {
      addError(errors, "manifest-invalid", "skill-dependencies.json is invalid");
    }
  }
  for (const [caller, required] of Object.entries(dependencies)) {
    if (!skills.has(caller)) addError(errors, "manifest-caller-missing", `dependency manifest references missing caller: ${caller}`);
    for (const dependency of required) if (!skills.has(dependency)) addError(errors, "manifest-dependency-missing", `${caller}: missing bundled dependency ${dependency}`);
  }
  const declaredPairs = new Set(Object.entries(dependencies).flatMap(([caller, required]) => required.map(dependency => `${caller}\0${dependency}`)));

  for (const [owner, skillFile] of skills) {
    for (const markdownFile of filesRecursively(dirname(skillFile), path => extname(path) === ".md")) {
      const text = readFileSync(markdownFile, "utf8");
      const markdownPath = relativePath(rootPath, markdownFile);
      for (const dependency of [...text.matchAll(skillCallPattern)].map(match => match[1])) {
        if (dependency === "name") continue;
        if (!skills.has(dependency)) addError(errors, "skill-call-target-missing", `Skill() invokes missing dependency ${dependency}`, markdownPath);
        else if (!declaredPairs.has(`${owner}\0${dependency}`)) addError(errors, "skill-call-dependency-missing", `Skill() dependency ${dependency} is absent from the manifest`, markdownPath);
      }
      for (const dependency of [...text.matchAll(installedSkillPattern)].map(match => match[1])) {
        if (!skills.has(dependency)) addError(errors, "installed-skill-target-missing", `installed-skill path references missing dependency ${dependency}`, markdownPath);
        else if (dependency !== owner && !declaredPairs.has(`${owner}\0${dependency}`)) addError(errors, "installed-skill-dependency-missing", `installed-skill dependency ${dependency} is absent from the manifest`, markdownPath);
      }
      if (executableSkillUriPattern.test(text)) addError(errors, "executable-skill-uri", "skill:// URI is passed directly to a command instead of a resolved path", markdownPath);
      for (const pattern of legacyNamePatterns) {
        for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
          addError(errors, "legacy-skill-name", `stale legacy name ${match[0]}`, markdownPath);
        }
      }
      for (const target of markdownLinkTargets(text)) validateLocalLink({ root: rootPath, source: markdownFile, owner, target, skills, declaredPairs, errors });
    }
    for (const resource of filesRecursively(dirname(skillFile), path => textResourceSuffixes.has(extname(path).toLowerCase()))) {
      if (machinePathPattern.test(readFileSync(resource, "utf8"))) addError(errors, "machine-specific-home", "machine-specific home path found", relativePath(rootPath, resource));
    }
  }

  const readmePath = join(rootPath, "README.md");
  if (!existsSync(readmePath)) {
    addError(errors, "readme-missing", "README.md is missing", "README.md");
  } else {
    const readme = readFileSync(readmePath, "utf8");
    for (const name of skills.keys()) if (!readme.includes(`\`${name}\``)) addError(errors, "readme-skill-missing", `README does not list ${name}`, "README.md");
  }
  const documentation = [
    ...["README.md", "AGENTS.md", "CLAUDE.md"].map(name => join(rootPath, name)).filter(path => existsSync(path)),
    ...filesRecursively(join(rootPath, "docs"), path => extname(path) === ".md"),
    ...filesRecursively(join(rootPath, ".agents/rules"), path => extname(path) === ".md"),
  ];
  for (const document of documentation) {
    const text = readFileSync(document, "utf8");
    const documentPath = relativePath(rootPath, document);
    if (machinePathPattern.test(text)) addError(errors, "machine-specific-home", "machine-specific home path found", documentPath);
    for (const target of markdownLinkTargets(text)) validateLocalLink({ root: rootPath, source: document, target, skills, declaredPairs, errors });
  }
  return errors;
}

export function main(): number {
  const errors = validate(root);
  if (errors.length) {
    console.error("Portability check failed:");
    for (const error of errors) console.error(`- ${error.path ? `${error.path}: ` : ""}${error.message}`);
    return 1;
  }
  const dependencyCount = Object.values(JSON.parse(readFileSync(join(root, "skill-dependencies.json"), "utf8")) as Record<string, string[]>).reduce((count, dependencies) => count + dependencies.length, 0);
  console.log(`Portability check passed: ${readdirSync(join(root, skillsDirectory), { withFileTypes: true }).filter(entry => entry.isDirectory() && existsSync(join(root, skillsDirectory, entry.name, "SKILL.md"))).length} skills, ${dependencyCount} declared dependencies`);
  return 0;
}

if (import.meta.main) process.exitCode = main();
