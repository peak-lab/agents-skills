import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import type { SkillContextMeasurement } from "./skill-context.ts";
import { resolveDependencyClosure } from "./skill-dependencies.ts";

type Command = "check" | "apply" | "restore" | "candidate";
type Action = "current" | "install" | "update" | "adopt-current" | "replace-unmanaged" | "conflict";
type Profiles = { version: number; profiles: Record<string, string[]> };
type State = { version: 1; source: string; profiles: string[]; skills: Record<string, string> };
type BackupManifest = { version: 1; target: string; state?: State; skills: string[] };

export interface SyncPlanItem { name: string; action: Action; sourceHash: string; targetHash?: string; reason: string; }
export interface SyncPlan { target: string; skills: string[]; items: SyncPlanItem[]; }

const stateFile = ".peaklab-skill-state.json";
const manifestFile = "backup-manifest.json";

function fail(message: string): never { throw new Error(message); }

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function directoryHash(path: string): string {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
      else fail(`unsupported filesystem entry in skill: ${child}`);
    }
  };
  walk(path);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(path, file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function readJson(path: string): unknown {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { fail(`invalid JSON: ${path}`); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function profiles(root: string): Profiles {
  const value = readJson(join(root, "skill-profiles.json"));
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.profiles) || Object.values(value.profiles).some(names => !Array.isArray(names) || names.some(name => typeof name !== "string"))) {
    fail("skill-profiles.json must contain version 1 and named string-array profiles");
  }
  return value as Profiles;
}

function dependencies(root: string): Record<string, string[]> {
  const value = readJson(join(root, "skill-dependencies.json"));
  if (!isRecord(value) || Object.values(value).some(names => !Array.isArray(names) || names.some(name => typeof name !== "string"))) fail("invalid skill-dependencies.json");
  return value as Record<string, string[]>;
}

function sourceSkills(root: string): Map<string, SkillContextMeasurement> {
  const result = new Map<string, SkillContextMeasurement>();
  const directory = join(root, "skills");
  if (!existsSync(directory)) fail(`missing source skills directory: ${directory}`);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skill = join(directory, entry.name);
    if (!existsSync(join(skill, "SKILL.md"))) continue;
    result.set(entry.name, { name: entry.name, skillBytes: 0, nameAndDescriptionCharacters: 0 });
  }
  return result;
}

function safeTarget(path: string): string {
  if (!isAbsolute(path)) fail("--target must be an absolute path");
  const target = resolve(path);
  if (target === "/" || basename(target) !== "skills") fail("--target must name a specific skills directory");
  return target;
}

function readState(target: string): State | undefined {
  const path = join(target, stateFile);
  if (!existsSync(path)) return undefined;
  const value = readJson(path);
  if (!isRecord(value) || value.version !== 1 || typeof value.source !== "string" || !Array.isArray(value.profiles) || value.profiles.some(profile => typeof profile !== "string") || !isRecord(value.skills) || Object.values(value.skills).some(hash => typeof hash !== "string")) {
    fail(`invalid sync state: ${path}`);
  }
  return value as State;
}

function selectedSkills(root: string, target: string, options: { profiles: string[]; skills: string[]; allExisting: boolean }): string[] {
  const source = sourceSkills(root);
  const requested = new Set<string>(options.skills);
  const profileData = profiles(root);
  for (const profile of options.profiles) {
    const names = profileData.profiles[profile];
    if (!names) fail(`unknown profile: ${profile}`);
    for (const name of names) requested.add(name);
  }
  if (options.allExisting) {
    if (!existsSync(target)) fail("--all-existing requires an existing target directory");
    for (const name of source.keys()) if (existsSync(join(target, name, "SKILL.md"))) requested.add(name);
  }
  if (requested.size === 0) fail("select skills with --profile, --skill, or --all-existing");
  return resolveDependencyClosure(source, dependencies(root), [...requested]);
}

export function createSyncPlan(root: string, targetInput: string, options: { profiles?: string[]; skills?: string[]; allExisting?: boolean; adoptRepository?: boolean } = {}): SyncPlan {
  const target = safeTarget(targetInput);
  const selected = selectedSkills(root, target, { profiles: options.profiles ?? [], skills: options.skills ?? [], allExisting: options.allExisting ?? false });
  const state = existsSync(target) ? readState(target) : undefined;
  const items = selected.map(name => {
    const source = join(root, "skills", name);
    const sourceHash = directoryHash(source);
    const destination = join(target, name);
    if (!existsSync(destination)) return { name, action: "install" as const, sourceHash, reason: "not installed" };
    if (!statSync(destination).isDirectory()) fail(`target skill is not a directory: ${destination}`);
    const targetHash = directoryHash(destination);
    if (targetHash === sourceHash) return { name, action: "current" as const, sourceHash, targetHash, reason: "matches source" };
    const baseline = state?.skills[name];
    if (baseline === undefined) return options.adoptRepository
      ? { name, action: "replace-unmanaged" as const, sourceHash, targetHash, reason: "explicit repository adoption" }
      : { name, action: "conflict" as const, sourceHash, targetHash, reason: "unmanaged local divergence" };
    if (targetHash !== baseline) return { name, action: "conflict" as const, sourceHash, targetHash, reason: "local modification since last sync" };
    return { name, action: "update" as const, sourceHash, targetHash, reason: "unchanged local baseline differs from source" };
  });
  return { target, skills: selected, items };
}

function writeState(target: string, root: string, profileNames: string[], items: readonly SyncPlanItem[]): void {
  const existing = readState(target);
  const next: State = { version: 1, source: root, profiles: [...new Set([...existing?.profiles ?? [], ...profileNames])].sort(), skills: { ...existing?.skills } };
  for (const item of items) next.skills[item.name] = item.sourceHash;
  writeFileSync(join(target, stateFile), `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

function backupDirectory(target: string): string {
  return mkdtempSync(join(dirname(target), ".peaklab-skill-backup-"));
}

function replaceDirectory(source: string, destination: string): void {
  const stage = mkdtempSync(join(dirname(destination), ".peaklab-skill-stage-"));
  const stagedSkill = join(stage, basename(destination));
  cpSync(source, stagedSkill, { recursive: true, errorOnExist: true });
  const old = `${destination}.peaklab-skill-old`;
  if (existsSync(old)) fail(`recovery directory already exists: ${old}`);
  if (existsSync(destination)) renameSync(destination, old);
  try { renameSync(stagedSkill, destination); }
  catch (error) {
    if (existsSync(old)) renameSync(old, destination);
    throw error;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  if (existsSync(old)) rmSync(old, { recursive: true, force: true });
}

export function applySyncPlan(root: string, plan: SyncPlan, options: { profiles?: string[] } = {}): string | undefined {
  const conflicts = plan.items.filter(item => item.action === "conflict");
  if (conflicts.length > 0) fail(`refusing unresolved conflicts: ${conflicts.map(item => item.name).join(", ")}`);
  mkdirSync(plan.target, { recursive: true, mode: 0o700 });
  const changes = plan.items.filter(item => !["current", "adopt-current"].includes(item.action));
  const replacements = changes.filter(item => existsSync(join(plan.target, item.name)));
  let backup: string | undefined;
  if (replacements.length > 0) {
    backup = backupDirectory(plan.target);
    const manifest: BackupManifest = { version: 1, target: plan.target, ...(readState(plan.target) === undefined ? {} : { state: readState(plan.target) }), skills: [] };
    for (const item of replacements) {
      const destination = join(plan.target, item.name);
      if (existsSync(destination)) {
        cpSync(destination, join(backup, item.name), { recursive: true, errorOnExist: true });
        manifest.skills.push(item.name);
      }
    }
    writeFileSync(join(backup, manifestFile), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  }
  for (const item of changes) replaceDirectory(join(root, "skills", item.name), join(plan.target, item.name));
  writeState(plan.target, root, options.profiles ?? [], plan.items);
  return backup;
}

export function restoreBackup(targetInput: string, backupInput: string): void {
  const target = safeTarget(targetInput);
  const backup = resolve(backupInput);
  const value = readJson(join(backup, manifestFile));
  if (!isRecord(value) || value.version !== 1 || value.target !== target || !Array.isArray(value.skills) || value.skills.some(name => typeof name !== "string")) fail("invalid backup manifest or mismatched target");
  const manifest = value as BackupManifest;
  for (const name of manifest.skills) {
    const source = join(backup, name);
    if (!existsSync(source)) fail(`backup is missing ${name}`);
  }
  for (const name of manifest.skills) replaceDirectory(join(backup, name), join(target, name));
  if (manifest.state) writeFileSync(join(target, stateFile), `${JSON.stringify(manifest.state, null, 2)}\n`, { mode: 0o600 });
  else if (existsSync(join(target, stateFile))) rmSync(join(target, stateFile));
}

export function candidateReport(root: string, targetInput: string): string {
  const target = safeTarget(targetInput);
  if (!existsSync(target)) fail("candidate report requires an existing target directory");
  const source = sourceSkills(root);
  const local = readdirSync(target, { withFileTypes: true }).filter(entry => entry.isDirectory() && existsSync(join(target, entry.name, "SKILL.md"))).map(entry => entry.name).sort();
  const rows = local.map(name => {
    if (!source.has(name)) return `${name} | local-only | requires provenance, portability and licensing review`;
    const sourceHash = directoryHash(join(root, "skills", name));
    const localHash = directoryHash(join(target, name));
    return `${name} | ${sourceHash === localHash ? "current" : "divergent"} | ${sourceHash === localHash ? "no action" : "review or sync from repository"}`;
  });
  return ["Local-to-catalogue candidate report (read-only)", "Skill | State | Next action", "--- | --- | ---", ...rows].join("\n");
}

function formatPlan(plan: SyncPlan, heading = "Skill synchronization plan (read-only)"): string {
  return [heading, "Skill | Action | Reason", "--- | --- | ---", ...plan.items.map(item => `${item.name} | ${item.action} | ${item.reason}`)].join("\n");
}

function parse(args: string[]): { command: Command; target?: string; backup?: string; profiles: string[]; skills: string[]; allExisting: boolean; adoptRepository: boolean } {
  const [command, ...rest] = args;
  if (!(["check", "apply", "restore", "candidate"] as const).includes(command as Command)) fail("usage: skill-sync <check|apply|restore|candidate> --target /absolute/path/skills [options]");
  const result: { command: Command; target?: string; backup?: string; profiles: string[]; skills: string[]; allExisting: boolean; adoptRepository: boolean } = { command: command as Command, profiles: [], skills: [], allExisting: false, adoptRepository: false };
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (option === "--target" || option === "--backup" || option === "--profile" || option === "--skill") {
      const value = rest[++index];
      if (!value || value.startsWith("--")) fail(`${option} requires a value`);
      if (option === "--target") result.target = value;
      else if (option === "--backup") result.backup = value;
      else if (option === "--profile") result.profiles.push(value);
      else result.skills.push(value);
    } else if (option === "--all-existing") result.allExisting = true;
    else if (option === "--adopt-repository") result.adoptRepository = true;
    else fail(`unknown option: ${option}`);
  }
  return result;
}

export function main(args = process.argv.slice(2), root = resolve(import.meta.dirname, ".."), write = console.log, writeError = console.error): number {
  try {
    const options = parse(args);
    if (!options.target) fail("--target is required");
    if (options.command === "restore") {
      if (!options.backup) fail("restore requires --backup");
      restoreBackup(options.target, options.backup);
      write("Backup restored.");
      return 0;
    }
    if (options.command === "candidate") {
      write(candidateReport(root, options.target));
      return 0;
    }
    const plan = createSyncPlan(root, options.target, options);
    if (options.command === "check") {
      write(formatPlan(plan));
      return plan.items.some(item => item.action === "conflict") ? 2 : 0;
    }
    const backup = applySyncPlan(root, plan, options);
    write(`${formatPlan(plan, "Skill synchronization result")}${backup ? `\nBackup: ${backup}` : "\nNo content changes."}`);
    return 0;
  } catch (error) {
    writeError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main();
