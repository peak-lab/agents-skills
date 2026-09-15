#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync, chmodSync, closeSync, copyFileSync, existsSync, fchmodSync, mkdirSync, openSync, readdirSync, readFileSync,
  readSync, realpathSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync, writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

const DESCRIPTION = `Audit and trim the per-call context of local Claude Code and Codex installations.

Every subcommand is read-only unless --apply is passed. Mutations take a timestamped
backup first and never print secrets: MCP targets, URLs and credentials are redacted.`;

const HOME = homedir();
const env = process.env;
export const AGENTS_HOME = env.CONTEXT_OPTIMIZER_AGENTS_HOME ?? join(HOME, ".agents");
export const CLAUDE_HOME = env.CLAUDE_CONFIG_DIR ?? join(HOME, ".claude");
export const CLAUDE_JSON = env.CONTEXT_OPTIMIZER_CLAUDE_JSON ?? join(HOME, ".claude.json");
export const CODEX_HOME = env.CODEX_HOME ?? join(HOME, ".codex");
const STATE_DIR = env.CONTEXT_OPTIMIZER_STATE_DIR ?? join(AGENTS_HOME, "tasks", "context-optimizer");
const CACHE_DIR = env.CONTEXT_OPTIMIZER_CACHE_DIR ?? join(HOME, ".cache", "context-optimizer");

const FLOOR_PROMPT = "Réponds uniquement: ok";
const AGENTBURN_REPO = "https://github.com/Socialpranker/agentburn";
export const AGENTBURN_PIN = "96bb947b934bf3621f5e5f6e950f38868528f944";
const AGENTBURN_NETWORK = new Set(["drift", "explain", "rank", "--submit", "--llm", "--trends", "--yes-remote", "--benchmark-file"]);
const AGENTBURN_ACTIONS = ["report", "limits", "why", "context", "save-baseline", "compare"];
const TEXT_SUFFIXES = new Set([".md", ".json", ".sh", ".py", ".ts", ".toml", ".yaml", ".yml", ".txt"]);
const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", "skill-archive", "tasks", "memory", ".cache"]);
const INSTRUCTION_FILES = new Set(["AGENTS.md", "CLAUDE.md"]);

type Json = Record<string, unknown>;

export class ExitError extends Error {}

// --- output and helpers ------------------------------------------------------------------------

const SECRET_PATTERNS: [RegExp, string][] = [
  [/\b([a-z][a-z0-9+.-]*:\/\/[^\s:@\/'"]+):[^\s@\/'"]+@/gi, "$1:<redacted>@"],
  [/(https?:\/\/[^\s?#'"]+)\?[^\s'"]*/g, "$1?<redacted>"],
  [/(\bmysql(?:dump|admin)?\b[^\n]*?\s-p)(?=[^\s-])\S+/g, "$1<redacted>"],
  [/(\s(?:-u|--user)(?:\s+|=)["']?[^\s:"']+):[^\s"']+/g, "$1:<redacted>"],
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 <redacted>"],
  [/((?:api[_-]?key|access[_-]?key|token|secret|password|passwd|authorization)["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1<redacted>"],
  [/\b(?:sk|ghp|gho|ghs|github_pat|xox[abpr])[-_][A-Za-z0-9_-]{16,}/g, "<redacted>"],
  [/\bAKIA[A-Z0-9]{16}\b/g, "<redacted>"],
];
const LONG_TOKEN = /(?<![\p{L}\p{N}_-])[A-Za-z0-9_-]{32,}(?![\p{L}\p{N}_-])/gu;
const WORDS = /(?:[a-z]{2,}[_-]){3}/;

function looksLikeToken(value: string): boolean {
  return (value.match(/\d/g)?.length ?? 0) >= 4 && !WORDS.test(value);
}

export function redact(text: string): string {
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text.replace(LONG_TOKEN, match => looksLikeToken(match) ? "<redacted>" : match);
}

let writer = (line: string): void => { process.stdout.write(line + "\n"); };

export function setWriter(next: (line: string) => void): () => void {
  const previous = writer;
  writer = next;
  return () => { writer = previous; };
}

function out(line = ""): void {
  writer(redact(line));
}

const num = (value: number): string => value.toLocaleString("en-US");
const signed = (value: number): string => (value >= 0 ? "+" : "-") + num(Math.abs(value));
const pyList = (items: string[]): string => `[${items.map(item => `'${item}'`).join(", ")}]`;
const pad = (value: string | number, width: number): string => String(value).padStart(width);
const padEnd = (value: string, width: number): string => value.padEnd(width);

function expandUser(path: string): string {
  return path === "~" ? HOME : path.startsWith("~/") ? join(HOME, path.slice(2)) : path;
}

function resolvePath(path: string): string {
  const absolute = resolve(expandUser(path));
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function listDir(path: string): string[] {
  try {
    return readdirSync(path).sort();
  } catch {
    return [];
  }
}

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

export function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function movePath(source: string, target: string): void {
  try {
    renameSync(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    copyFileSync(source, target);
    unlinkSync(source);
  }
}

export function backupFile(path: string, stateDir = STATE_DIR): string {
  const targetDir = join(stateDir, "backups", nowStamp());
  mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  const target = join(targetDir, basename(path));
  copyFileSync(path, target);
  const stat = statSync(path);
  utimesSync(target, stat.atime, stat.mtime);
  chmodSync(target, 0o600);
  return target;
}

export function atomicWriteJson(path: string, data: unknown): void {
  const mode = existsSync(path) ? statSync(path).mode & 0o777 : 0o600;
  const tmp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}`);
  const fd = openSync(tmp, "wx", 0o600);
  let open = true;
  try {
    fchmodSync(fd, mode);
    writeSync(fd, JSON.stringify(data, null, 2) + "\n");
    closeSync(fd);
    open = false;
    renameSync(tmp, path);
  } catch (error) {
    if (open) closeSync(fd);
    try {
      unlinkSync(tmp);
    } catch {}
    throw error;
  }
}

function* readLines(path: string): Generator<string> {
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return;
  }
  const decoder = new StringDecoder("utf8");
  const buffer = Buffer.alloc(1 << 20);
  let pending = "";
  try {
    for (let read = readSync(fd, buffer); read > 0; read = readSync(fd, buffer)) {
      const lines = (pending + decoder.write(buffer.subarray(0, read))).split("\n");
      pending = lines.pop()!;
      yield* lines;
    }
    pending += decoder.end();
    if (pending) yield pending;
  } finally {
    closeSync(fd);
  }
}

function* iterJsonl(path: string): Generator<Json> {
  for (const line of readLines(path)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (value && typeof value === "object" && !Array.isArray(value)) yield value as Json;
    } catch {}
  }
}

function walkFiles(root: string, accept: (path: string) => boolean, skip: (name: string) => boolean = () => false): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!skip(entry.name)) visit(path);
      } else if ((entry.isFile() || (entry.isSymbolicLink() && isFile(path))) && accept(path)) {
        found.push(path);
      }
    }
  };
  if (isDir(root)) visit(root);
  return found;
}

function recentFiles(roots: string[], suffix: string, days: number): string[] {
  const cutoff = Date.now() - days * 86_400_000;
  return roots.flatMap(root => walkFiles(root, path => path.endsWith(suffix) && statSync(path).mtimeMs >= cutoff));
}

function eventIsRecent(event: Json, cutoff: string): boolean {
  const stamp = event.timestamp;
  return typeof stamp !== "string" || stamp.slice(0, 19) >= cutoff;
}

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19);
}

function asObject(value: unknown): Json | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : undefined;
}

// --- floor -------------------------------------------------------------------------------------

export function floorTokens(payload: unknown): number | null {
  const events = Array.isArray(payload) ? payload : [payload];
  for (const item of events) {
    const event = asObject(item);
    if (!event) continue;
    const message = asObject(event.message);
    let usage: unknown = message ? message.usage : undefined;
    if (usage === undefined && event.type === "result") usage = event.usage;
    const fields = asObject(usage);
    if (fields) {
      return ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]
        .reduce((total, key) => total + Math.trunc(Number(fields[key] || 0)), 0);
    }
  }
  return null;
}

function runFailure(error: NodeJS.ErrnoException): string {
  if (error.code === "ETIMEDOUT") return "TimeoutExpired";
  if (error.code === "ENOENT") return "FileNotFoundError";
  return error.code ?? error.name;
}

function measureFloor(cwd: string, extra: string[], timeout: number): number | null {
  const result = spawnSync("claude", ["-p", FLOOR_PROMPT, "--output-format", "json", ...extra], {
    cwd, encoding: "utf8", timeout: timeout * 1000, maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) {
    out(`  run failed: ${runFailure(result.error)}`);
    return null;
  }
  if (result.status !== 0) {
    out(`  run failed: exit ${result.status ?? result.signal}`);
    return null;
  }
  try {
    return floorTokens(JSON.parse(result.stdout));
  } catch {
    out("  run failed: output is not JSON");
    return null;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.trunc(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

export interface FloorArgs { cwd: string; runs: number; timeout: number; record: boolean; claudeArg: string[]; stateDir: string }

export function cmdFloor(args: FloorArgs): number {
  const cwd = resolvePath(args.cwd);
  const extra = [...args.claudeArg];
  out(`== floor: ${cwd} (${args.runs} run(s)${extra.length ? ", " + extra.join(" ") : ""})`);
  const values: number[] = [];
  for (let run = 0; run < args.runs; run += 1) {
    const value = measureFloor(cwd, extra, args.timeout);
    if (value) values.push(value);
  }
  if (!values.length) {
    out("  no measurement");
    return 1;
  }
  const middle = median(values);
  out(`  median ${num(middle)} tokens/call  runs=[${values.join(", ")}]`);
  const history = join(args.stateDir, "floor-history.jsonl");
  let previous: Json | undefined;
  for (const entry of iterJsonl(history)) {
    if (entry.cwd === cwd && JSON.stringify(entry.extra) === JSON.stringify(extra)) previous = entry;
  }
  if (previous) {
    const before = Math.trunc(Number(previous.median));
    out(`  previous ${num(before)} at ${previous.at} -> delta ${signed(middle - before)}`);
  }
  if (args.record) {
    mkdirSync(dirname(history), { recursive: true });
    appendFileSync(history, JSON.stringify({ at: nowStamp(), cwd, extra, runs: values, median: middle }) + "\n");
    out(`  recorded in ${history}`);
  }
  return 0;
}

// --- usage -------------------------------------------------------------------------------------

const COMMAND_NAME = /<command-name>\/?([^<\s]+)\s*<\/command-name>/g;
const CODEX_SKILL_PATH = /skills\/([\w.:-]+)\/SKILL\.md/g;
const CODEX_SKILL_TAG = /<skill>\s*<name>([\w.:-]+)<\/name>/g;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(item => textOf(asObject(item) ? asObject(item)!.text : item)).join("\n");
  return "";
}

const captures = (pattern: RegExp, text: string): string[] => [...text.matchAll(pattern)].map(match => match[1]);

export function claudeInvocations(event: Json): string[] {
  const message = asObject(event.message);
  if (!message) return [];
  const names: string[] = [];
  const content = message.content;
  if (message.role === "user") names.push(...captures(COMMAND_NAME, textOf(content)));
  if (message.role === "assistant" && Array.isArray(content)) {
    for (const item of content) {
      const block = asObject(item);
      if (block?.type === "tool_use" && block.name === "Skill") {
        const skill = asObject(block.input)?.skill;
        if (typeof skill === "string") names.push(skill.replace(/^\/+/, ""));
      }
    }
  }
  return names;
}

/**
 * Returns [skill files opened by a tool call, skills explicitly invoked by the user].
 * The developer skills_instructions listing is ignored on purpose: it names every installed
 * skill in every session and would inflate every count.
 */
export function codexInvocations(event: Json): [string[], string[]] {
  if (event.type !== "response_item") return [[], []];
  const payload = asObject(event.payload) ?? {};
  const kind = payload.type;
  if (kind === "function_call" || kind === "custom_tool_call" || kind === "local_shell_call") {
    const raw = payload.arguments || payload.input || payload.action || "";
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    return [captures(CODEX_SKILL_PATH, text), []];
  }
  if (kind === "message" && payload.role === "user") return [[], captures(CODEX_SKILL_TAG, textOf(payload.content))];
  return [[], []];
}

export class Usage {
  claude = new Map<string, number>();
  codex = new Map<string, number>();
  last = new Map<string, string>();

  mark(counter: Map<string, number>, rawName: string, stamp: unknown): void {
    const name = rawName.trim();
    counter.set(name, (counter.get(name) ?? 0) + 1);
    if (typeof stamp === "string") {
      const day = stamp.slice(0, 10);
      if (day > (this.last.get(name) ?? "")) this.last.set(name, day);
    }
  }
}

export function collectUsage(days: number, claudeHome = CLAUDE_HOME, codexHome = CODEX_HOME): Usage {
  const usage = new Usage();
  const since = cutoffIso(days);
  for (const path of recentFiles([join(claudeHome, "projects")], ".jsonl", days)) {
    for (const event of iterJsonl(path)) {
      if (!eventIsRecent(event, since)) continue;
      for (const name of claudeInvocations(event)) usage.mark(usage.claude, name, event.timestamp);
    }
  }
  for (const path of recentFiles([join(codexHome, "sessions")], ".jsonl", days)) {
    const opened = new Set<string>();
    for (const event of iterJsonl(path)) {
      if (!eventIsRecent(event, since)) continue;
      const [files, tags] = codexInvocations(event);
      for (const name of files) {
        if (opened.has(name)) continue;
        opened.add(name);
        usage.mark(usage.codex, name, event.timestamp);
      }
      for (const name of tags) usage.mark(usage.codex, name, event.timestamp);
    }
  }
  return usage;
}

function skillDirs(root: string): string[] {
  return listDir(root).filter(name => existsSync(join(root, name, "SKILL.md")));
}

function markdownFiles(root: string): string[] {
  return walkFiles(root, path => path.endsWith(".md")).sort(comparePaths);
}

function comparePaths(a: string, b: string): number {
  const left = a.split(sep);
  const right = b.split(sep);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return left.length - right.length;
}

export function commandName(root: string, path: string): string {
  const parts = relative(root, path).split(sep);
  const last = parts.length - 1;
  const suffix = extname(parts[last]);
  if (suffix) parts[last] = parts[last].slice(0, -suffix.length);
  return parts.join(":");
}

function installedInventory(agentsHome: string, claudeHome: string, project: string | null): Map<string, string> {
  const inventory = new Map<string, string>();
  const add = (name: string, kind: string): void => { if (!inventory.has(name)) inventory.set(name, kind); };
  for (const root of [join(agentsHome, "skills"), join(claudeHome, "skills")]) for (const name of skillDirs(root)) add(name, "skill");
  for (const root of [join(agentsHome, "commands"), join(claudeHome, "commands")]) {
    for (const path of markdownFiles(root)) add(commandName(root, path), "command");
  }
  if (project) {
    for (const root of [join(project, ".agents", "skills"), join(project, ".claude", "skills")]) {
      for (const name of skillDirs(root)) add(name, "project-skill");
    }
  }
  return inventory;
}

function prefixes(usage: Usage): Set<string> {
  return new Set([...usage.claude.keys(), ...usage.codex.keys()].filter(name => name.includes(":")).map(name => name.split(":", 1)[0]));
}

export function countFor(usage: Usage, name: string): [number, number, string] {
  const aliases = new Set([name, name.replaceAll(":", "/"), ...[...prefixes(usage)].map(prefix => `${prefix}:${name}`)]);
  let claude = 0;
  let codex = 0;
  let last = "";
  for (const alias of aliases) {
    claude += usage.claude.get(alias) ?? 0;
    codex += usage.codex.get(alias) ?? 0;
    const seen = usage.last.get(alias) ?? "";
    if (seen > last) last = seen;
  }
  return [claude, codex, last];
}

export interface UsageArgs { days: number; project: string | null; maxUses: number; all: boolean }

export function cmdUsage(args: UsageArgs): number {
  const project = args.project ? resolvePath(args.project) : null;
  const usage = collectUsage(args.days);
  const rows: [number, string, string, number, number, string][] = [];
  for (const [name, kind] of installedInventory(AGENTS_HOME, CLAUDE_HOME, project)) {
    const [claude, codex, last] = countFor(usage, name);
    rows.push([claude + codex, kind, name, claude, codex, last]);
  }
  out(`== usage over ${args.days} days (Claude: slash commands + Skill tool; Codex: SKILL.md opened by tools + user skill tags)`);
  out(`  ${pad("total", 5)}  ${padEnd("kind", 13)} ${padEnd("name", 42)} ${pad("claude", 6)} ${pad("codex", 6)}  last`);
  const ordered = rows.sort((a, b) => a[0] - b[0] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
  for (const [total, kind, name, claude, codex, last] of args.all ? ordered : ordered.filter(row => row[0] <= args.maxUses)) {
    out(`  ${pad(total, 5)}  ${padEnd(kind, 13)} ${padEnd(name, 42)} ${pad(claude, 6)} ${pad(codex, 6)}  ${last || "-"}`);
  }
  const merged = new Map<string, number>();
  for (const counter of [usage.claude, usage.codex]) {
    for (const [name, count] of counter) merged.set(name, (merged.get(name) ?? 0) + count);
  }
  const top = [...merged].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const unused = rows.filter(row => row[0] === 0).length;
  out(`  ${rows.length} installed, ${unused} unused; top: ` + top.map(([name, count]) => `${name}=${count}`).join(", "));
  return 0;
}

// --- commands ----------------------------------------------------------------------------------

function iterTextFiles(roots: string[]): string[] {
  return roots.flatMap(root => {
    if (isFile(root)) return [root];
    return walkFiles(root, path => TEXT_SUFFIXES.has(extname(path)) && statSync(path).size < 512_000, name => SKIP_DIRS.has(name));
  });
}

const scriptPath = (() => {
  const path = fileURLToPath(import.meta.url);
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
})();

export function catalogueRoot(explicit: string | null): string | null {
  const candidates = explicit ? [expandUser(explicit)] : [];
  if (env.AGENTS_SKILLS_CATALOG) candidates.push(expandUser(env.AGENTS_SKILLS_CATALOG));
  candidates.push(resolve(dirname(scriptPath), "..", "..", ".."));
  return candidates.find(path => existsSync(join(path, "skill-profiles.json"))) ?? null;
}

function protectedNames(catalogue: string | null): Set<string> {
  if (!catalogue) return new Set();
  const names = new Set(skillDirs(join(catalogue, "skills")));
  const dependencies = JSON.parse(readFileSync(join(catalogue, "skill-dependencies.json"), "utf8")) as Record<string, string[]>;
  for (const [caller, called] of Object.entries(dependencies)) {
    names.add(caller);
    for (const name of called) names.add(name);
  }
  return names;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

export function referencePattern(name: string): RegExp {
  const path = escapeRegExp(name.replaceAll(":", "/")) + "\\.md";
  return new RegExp(`(?<![\\w/.-])/${escapeRegExp(name)}(?![\\w:-])|commands/${path}`);
}

export interface CommandsArgs {
  commandsDir: string; archiveDir: string; tasksDir: string; catalog: string | null; days: number;
  minAgeDays: number; only: string[] | null; apply: boolean; verbose: boolean;
}

export function commandDefaults(): CommandsArgs {
  return {
    commandsDir: join(AGENTS_HOME, "commands"),
    archiveDir: join(AGENTS_HOME, "skill-archive", "commands"),
    tasksDir: join(AGENTS_HOME, "tasks"),
    catalog: null,
    days: 90,
    minAgeDays: 30,
    only: null,
    apply: false,
    verbose: false,
  };
}

interface Candidate { name: string; source: string; reason: string | null }

function commandCandidates(args: CommandsArgs): [Candidate[], string | null] {
  const commandsRoot = expandUser(args.commandsDir);
  const catalogue = catalogueRoot(args.catalog);
  const protectedSet = protectedNames(catalogue);
  const usage = collectUsage(args.days);
  const corpusRoots = ["skills", "agents", "rules", "AGENTS.md"].map(name => join(AGENTS_HOME, name));
  if (catalogue) corpusRoots.push(join(catalogue, "skills"), join(catalogue, "agents"));
  const corpus = iterTextFiles(corpusRoots).map(path => [path, readFileSync(path, "utf8")] as const);
  const minMtime = Date.now() - args.minAgeDays * 86_400_000;
  const candidates: Candidate[] = [];
  for (const path of markdownFiles(commandsRoot)) {
    const name = commandName(commandsRoot, path);
    const [claude, codex] = countFor(usage, name);
    let reason: string | null = null;
    if (protectedSet.has(name) || protectedSet.has(name.split(":").at(-1)!)) {
      reason = "protected by catalogue";
    } else if (claude + codex) {
      reason = `used ${claude + codex}x`;
    } else if (statSync(path).mtimeMs > minMtime) {
      reason = `younger than ${args.minAgeDays} days`;
    } else {
      const pattern = referencePattern(name);
      const referrer = corpus.find(([ref, text]) => ref !== path && pattern.test(text));
      if (referrer) reason = `referenced by ${basename(referrer[0])}`;
    }
    candidates.push({ name, source: path, reason });
  }
  return [candidates, catalogue];
}

export function cmdCommands(args: CommandsArgs): number {
  const [candidates, catalogue] = commandCandidates(args);
  out(`== commands in ${args.commandsDir} (0 use over ${args.days} days, unreferenced, older than ${args.minAgeDays} days)`);
  out(`  catalogue protection: ${catalogue ?? "NOT FOUND - pass --catalog"}`);
  const selected = candidates.filter(item => item.reason === null && (!args.only || args.only.includes(item.name)));
  for (const item of candidates) {
    if (item.reason) {
      if (args.verbose) out(`  keep  ${padEnd(item.name, 40)} ${item.reason}`);
    } else {
      out(`  prune ${item.name}`);
    }
  }
  out(`  ${selected.length} candidate(s) of ${candidates.length}`);
  if (!args.apply) {
    out("  read-only; rerun with --apply [--only NAME ...] to archive");
    return 0;
  }
  if (!catalogue) {
    out("  refusing --apply without catalogue protection");
    return 2;
  }
  const commandsRoot = expandUser(args.commandsDir);
  const archiveRoot = expandUser(args.archiveDir);
  const date = localDate();
  const manifestDir = join(expandUser(args.tasksDir), `command-pruning-${date}`);
  mkdirSync(manifestDir, { recursive: true });
  const moved: { name: string; source: string; archive: string; sha256: string }[] = [];
  for (const item of selected) {
    const target = join(archiveRoot, relative(commandsRoot, item.source));
    if (existsSync(target)) {
      out(`  skip ${item.name}: archive target exists`);
      continue;
    }
    const digest = sha256(item.source);
    mkdirSync(dirname(target), { recursive: true });
    movePath(item.source, target);
    moved.push({ name: item.name, source: item.source, archive: target, sha256: digest });
  }
  const first = join(manifestDir, "manifest.json");
  const manifest = existsSync(first) ? join(manifestDir, `manifest-${nowStamp()}.json`) : first;
  const criteria = `0 use over ${args.days} days, no reference, older than ${args.minAgeDays} days`;
  writeFileSync(manifest, JSON.stringify({ date, criteria, commands: moved }, null, 2) + "\n");
  out(`  archived ${moved.length}; manifest ${manifest}`);
  return 0;
}

export function cmdRestore(args: { name: string; tasksDir: string }): number {
  const tasks = expandUser(args.tasksDir);
  const manifests = listDir(tasks)
    .filter(name => name.startsWith("command-pruning-") && isDir(join(tasks, name)))
    .flatMap(name => listDir(join(tasks, name))
      .filter(file => file.startsWith("manifest") && file.endsWith(".json"))
      .map(file => join(tasks, name, file)))
    .sort(comparePaths)
    .reverse();
  for (const manifest of manifests) {
    const commands = (JSON.parse(readFileSync(manifest, "utf8")).commands ?? []) as { name: string; source: string; archive: string; sha256: string }[];
    for (const entry of commands) {
      if (entry.name !== args.name) continue;
      if (existsSync(entry.source)) {
        out(`restore refused: ${entry.source} already exists`);
        return 2;
      }
      if (!existsSync(entry.archive)) {
        out(`restore refused: ${entry.archive} missing`);
        return 2;
      }
      if (sha256(entry.archive) !== entry.sha256) out("warning: archived file changed since pruning");
      mkdirSync(dirname(entry.source), { recursive: true });
      movePath(entry.archive, entry.source);
      out(`restored ${args.name} -> ${entry.source}`);
      return 0;
    }
  }
  out(`${args.name} not found in ${manifests.length} manifest(s)`);
  return 1;
}

// --- memory ------------------------------------------------------------------------------------

const INDEX_LINE = /^- \[[^\]]*\]\(([^)]+)\)/;

export function projectSlug(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, "-");
}

export interface MemoryReport {
  indexBytes: number;
  entries: number;
  dangling: string[];
  unindexed: string[];
  longLines: [string, number][];
  largeFiles: [string, number][];
  neverMentioned: string[];
}

export function auditMemory(memoryDir: string, transcripts: string[], lineBudget: number, fileBudget: number): MemoryReport {
  const index = join(memoryDir, "MEMORY.md");
  const lines = existsSync(index) ? readFileSync(index, "utf8").split(/\r?\n/) : [];
  const linked = new Map<string, number>();
  for (const line of lines) {
    const match = INDEX_LINE.exec(line);
    if (match) linked.set(match[1], Buffer.byteLength(line, "utf8"));
  }
  const files = new Map<string, number>();
  for (const name of listDir(memoryDir)) {
    if (name.endsWith(".md") && name !== "MEMORY.md") files.set(name, statSync(join(memoryDir, name)).size);
  }
  const mentioned = new Set<string>();
  for (const transcript of transcripts) {
    for (const raw of readLines(transcript)) {
      if (!raw.includes("memory/")) continue;
      for (const name of files.keys()) if (raw.includes(`memory/${name}`)) mentioned.add(name);
    }
  }
  const bySize = (a: [string, number], b: [string, number]): number => b[1] - a[1];
  return {
    indexBytes: existsSync(index) ? statSync(index).size : 0,
    entries: linked.size,
    dangling: [...linked.keys()].filter(name => !files.has(name)).sort(),
    unindexed: [...files.keys()].filter(name => !linked.has(name)).sort(),
    longLines: [...linked].filter(([, bytes]) => bytes > lineBudget).sort(bySize),
    largeFiles: [...files].filter(([, size]) => size > fileBudget).sort(bySize),
    neverMentioned: [...files.keys()].filter(name => !mentioned.has(name)).sort(),
  };
}

export function unreadFiles(candidates: string[], searchRoots: string[]): [string, string[]][] {
  const corpus = new Map(iterTextFiles(searchRoots).map(path => [path, readFileSync(path, "utf8")] as const));
  const result: [string, string[]][] = [];
  for (const candidate of candidates) {
    const name = basename(candidate);
    const referrers = [...corpus].filter(([path, text]) => text.includes(name) && path !== candidate).map(([path]) => path);
    const underHome = candidate.startsWith(HOME + sep);
    const includes = [`@${candidate}`, underHome ? `@~/${relative(HOME, candidate)}` : `@${candidate}`];
    const readers = referrers.filter(path => !INSTRUCTION_FILES.has(basename(path)) || includes.some(item => corpus.get(path)!.includes(item)));
    if (!readers.length) result.push([candidate, referrers.map(path => basename(path))]);
  }
  return result;
}

export interface MemoryArgs { project: string; days: number; lineBudget: number; fileBudget: number; limit: number; writeOnly: string[] | null }

export function cmdMemory(args: MemoryArgs): number {
  const project = resolvePath(args.project);
  const slug = projectSlug(project);
  const projects = join(CLAUDE_HOME, "projects");
  const memoryDir = join(projects, slug, "memory");
  out(`== memory: ${memoryDir}`);
  if (!existsSync(memoryDir)) {
    out("  no memory directory");
  } else {
    const roots = listDir(projects).filter(name => name.startsWith(slug)).map(name => join(projects, name));
    const report = auditMemory(memoryDir, recentFiles(roots, ".jsonl", args.days), args.lineBudget, args.fileBudget);
    out(`  MEMORY.md ${num(report.indexBytes)} bytes, ${report.entries} entries (loaded on every call; measure with \`floor\`)`);
    out(`  dangling links: ${report.dangling.length ? pyList(report.dangling) : "none"}`);
    out(`  unindexed files: ${report.unindexed.length ? pyList(report.unindexed) : "none"}`);
    out(`  index lines > ${args.lineBudget} bytes: ${report.longLines.length}`);
    for (const [name, size] of report.longLines.slice(0, args.limit)) out(`    ${pad(size, 4)}  ${name}`);
    out(`  memory files > ${num(args.fileBudget)} bytes (cost when recalled): ${report.largeFiles.length}`);
    for (const [name, size] of report.largeFiles.slice(0, args.limit)) out(`    ${pad(num(size), 6)}  ${name}`);
    out(`  never mentioned in ${args.days} days of transcripts (weak signal, do not auto-delete): ${report.neverMentioned.length}`);
    for (const name of report.neverMentioned.slice(0, args.limit)) out(`    ${name}`);
  }
  const memoryHome = join(AGENTS_HOME, "memory");
  const lessonFiles = args.writeOnly
    ? args.writeOnly.map(expandUser)
    : listDir(memoryHome).filter(name => name.endsWith(".md")).map(name => join(memoryHome, name));
  const searchRoots = [AGENTS_HOME, join(CLAUDE_HOME, "settings.json"), join(CLAUDE_HOME, "hooks"), join(CODEX_HOME, "config.toml")];
  const orphans = unreadFiles(lessonFiles.filter(path => existsSync(path)), searchRoots);
  out("  write-only files (no skill, hook, rule or @include reads them):");
  for (const [path, referrers] of orphans) {
    out(`    ${path} ${num(statSync(path).size)} bytes; mentioned only by ${referrers.length ? pyList(referrers) : "nothing"}`);
  }
  if (!orphans.length) out("    none");
  return 0;
}

// --- mcp ---------------------------------------------------------------------------------------

export function parseMcpList(output: string): [string, string][] {
  const servers: [string, string][] = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes(": ") || !line.includes(" - ")) continue;
    const split = line.indexOf(": ");
    const rest = line.slice(split + 2);
    const status = rest.slice(rest.lastIndexOf(" - ") + 3).trim();
    servers.push([line.slice(0, split).trim(), status]);
  }
  return servers;
}

export function disableServers(configPath: string, project: string, names: string[], stateDir = STATE_DIR): [string[], string] {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as Json;
  const projects = asObject(config.projects);
  if (!projects || !(project in projects)) throw new ExitError(`${project} is unknown to Claude Code; open a session there first`);
  const saved = backupFile(configPath, stateDir);
  const entry = projects[project] as Json;
  entry.disabledMcpServers ??= [];
  if (!Array.isArray(entry.disabledMcpServers)) throw new ExitError(`${project} has a malformed disabledMcpServers entry`);
  const disabled = entry.disabledMcpServers as string[];
  for (const name of names) if (!disabled.includes(name)) disabled.push(name);
  atomicWriteJson(configPath, config);
  return [disabled, saved];
}

export interface McpArgs { project: string; disable: string[] | null; apply: boolean; force: boolean; stateDir: string }

export function cmdMcp(args: McpArgs): number {
  const project = resolvePath(args.project);
  out(`== mcp: ${project}`);
  let servers: [string, string][] = [];
  const result = spawnSync("claude", ["mcp", "list"], { cwd: project, encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) out(`  claude mcp list failed: ${runFailure(result.error)}`);
  else servers = parseMcpList(result.stdout);
  for (const [name, status] of servers) out(`  ${padEnd(name, 28)} ${status}`);
  if (existsSync(CLAUDE_JSON)) {
    const entry = asObject(asObject(asObject(JSON.parse(readFileSync(CLAUDE_JSON, "utf8")))?.projects)?.[project]);
    const disabled = entry?.disabledMcpServers;
    out(`  disabledMcpServers: ${pyList(Array.isArray(disabled) ? disabled.map(String) : [])}`);
  }
  if (!args.disable) return 0;
  const known = new Set(servers.map(([name]) => name));
  const unknown = args.disable.filter(name => !known.has(name));
  if (unknown.length && !args.force) {
    out(`  unknown server(s) ${pyList(unknown)}; names look like 'claude.ai Gmail'. Use --force to write anyway`);
    return 2;
  }
  if (!args.apply) {
    out(`  would disable ${pyList(args.disable)}; rerun with --apply`);
    return 0;
  }
  const [disabled, saved] = disableServers(CLAUDE_JSON, project, args.disable, args.stateDir);
  out(`  disabledMcpServers now ${pyList(disabled)}; backup ${saved}; restart open sessions`);
  return 0;
}

// --- agentburn ---------------------------------------------------------------------------------

function git(args: string[], check = true): number {
  const result = spawnSync("git", args, { stdio: check ? ["ignore", "inherit", "inherit"] : "ignore" });
  if (check && (result.error || result.status !== 0)) throw new ExitError(`git ${args[0] === "-C" ? args[2] : args[0]} failed`);
  return result.status ?? 1;
}

function ensureAgentburn(cache: string): string {
  const checkout = join(cache, "agentburn");
  if (!existsSync(join(checkout, ".git"))) {
    mkdirSync(dirname(checkout), { recursive: true });
    git(["clone", "--quiet", AGENTBURN_REPO, checkout]);
  }
  if (git(["-C", checkout, "cat-file", "-e", `${AGENTBURN_PIN}^{commit}`], false) !== 0) git(["-C", checkout, "fetch", "--quiet", "origin"]);
  git(["-C", checkout, "checkout", "--quiet", "--detach", AGENTBURN_PIN]);
  return checkout;
}

export function agentburnCommand(action: string, agent: string, extra: string[]): string[] {
  const mapping: Record<string, string[]> = {
    report: ["report"], limits: ["limits"], why: ["why"], context: ["context"], "save-baseline": ["--save-baseline"], compare: ["--compare"],
  };
  return [env.CONTEXT_OPTIMIZER_PYTHON ?? "python3", "-m", "agentburn.cli", "--agent", agent, ...mapping[action], ...extra];
}

export interface AgentburnArgs { action: string; agent: string; allowNetwork: boolean; extra: string[]; cacheDir: string }

export function cmdAgentburn(args: AgentburnArgs): number {
  if (args.extra.some(token => AGENTBURN_NETWORK.has(token.split("=")[0])) && !args.allowNetwork) {
    out("refusing network-capable agentburn options without --allow-network");
    return 2;
  }
  const checkout = ensureAgentburn(expandUser(args.cacheDir));
  out(`== agentburn ${args.action} (pinned ${AGENTBURN_PIN.slice(0, 12)}; fix/re-read-loop advice is unreliable)`);
  const [command, ...rest] = agentburnCommand(args.action, args.agent, args.extra);
  const result = spawnSync(command, rest, { cwd: checkout, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) {
    out(`agentburn failed: ${runFailure(result.error)}`);
    return 1;
  }
  const lines = (result.stdout + result.stderr).split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  for (const line of lines) out(line);
  return result.status ?? 1;
}

// --- all ---------------------------------------------------------------------------------------

export interface AllArgs {
  project: string; days: number; runs: number; timeout: number; catalog: string | null;
  skipFloor: boolean; skipAgentburn: boolean; stateDir: string; cacheDir: string;
}

export function cmdAll(args: AllArgs): number {
  const steps: (() => number)[] = [];
  if (!args.skipFloor) {
    steps.push(() => cmdFloor({ cwd: args.project, runs: args.runs, claudeArg: [], timeout: args.timeout, record: false, stateDir: args.stateDir }));
  }
  steps.push(
    () => cmdUsage({ days: args.days, project: args.project, all: false, maxUses: 0 }),
    () => cmdCommands({ ...commandDefaults(), days: args.days, catalog: args.catalog }),
    () => cmdMemory({ project: args.project, days: args.days, lineBudget: 120, fileBudget: 3000, limit: 10, writeOnly: null }),
    () => cmdMcp({ project: args.project, disable: null, apply: false, force: false, stateDir: args.stateDir }),
  );
  if (!args.skipAgentburn) {
    steps.push(() => cmdAgentburn({
      action: "report", agent: "claude-code", extra: ["--days", String(Math.min(args.days, 30))], allowNetwork: false, cacheDir: args.cacheDir,
    }));
  }
  let status = 0;
  for (const step of steps) {
    status = Math.max(status, step());
    out();
  }
  return status;
}

// --- command line ------------------------------------------------------------------------------

type Kind = "int" | "string" | "bool" | "multi" | "append";
interface Option { flag: string; key: string; kind: Kind; value?: unknown; help?: string; choices?: string[] }
interface Positional { key: string; choices?: string[]; help?: string }
interface Command { name: string; help: string; description?: string; options: Option[]; positionals: Positional[]; remainder?: string }

const opt = (flag: string, kind: Kind, value?: unknown, help?: string, choices?: string[]): Option => ({
  flag, kind, value, help, choices, key: flag.slice(2).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()),
});

const GLOBAL_OPTIONS = [opt("--state-dir", "string", STATE_DIR, "history and backups"), opt("--cache-dir", "string", CACHE_DIR, "agentburn checkout cache")];

function commandSpecs(): Command[] {
  const defaults = commandDefaults();
  return [
    { name: "floor", help: "measure tokens sent on a trivial call", positionals: [], options: [
      opt("--cwd", "string", "."), opt("--runs", "int", 3), opt("--timeout", "int", 300),
      opt("--record", "bool", false, "append to floor-history.jsonl"),
      opt("--claude-arg", "append", [], "extra claude flag, e.g. --claude-arg=--strict-mcp-config"),
    ] },
    { name: "usage", help: "count skill and command invocations", positionals: [], options: [
      opt("--days", "int", 90), opt("--project", "string", null, "also list the project's own skills"),
      opt("--max-uses", "int", 0, "list entries used at most N times"), opt("--all", "bool", false),
    ] },
    { name: "commands", help: "archive unused, unreferenced slash commands", positionals: [], options: [
      opt("--commands-dir", "string", defaults.commandsDir), opt("--archive-dir", "string", defaults.archiveDir),
      opt("--tasks-dir", "string", defaults.tasksDir),
      opt("--catalog", "string", null, "agents-skills checkout whose skills and dependencies are protected"),
      opt("--days", "int", defaults.days), opt("--min-age-days", "int", defaults.minAgeDays), opt("--only", "multi", null),
      opt("--apply", "bool", false), opt("--verbose", "bool", false),
    ] },
    { name: "restore", help: "restore an archived command from its manifest", positionals: [{ key: "name" }], options: [
      opt("--tasks-dir", "string", defaults.tasksDir),
    ] },
    { name: "memory", help: "audit a project's Claude memory index and files", positionals: [], options: [
      opt("--project", "string", "."), opt("--days", "int", 90), opt("--line-budget", "int", 120), opt("--file-budget", "int", 3000),
      opt("--limit", "int", 10), opt("--write-only", "multi", null, "files to check for readers (default: ~/.agents/memory/*.md)"),
    ] },
    { name: "mcp", help: "list MCP servers; disable some for one project", positionals: [], options: [
      opt("--project", "string", "."), opt("--disable", "multi", null), opt("--apply", "bool", false), opt("--force", "bool", false),
    ] },
    {
      name: "agentburn", help: "run the pinned agentburn profiler",
      description: "Diagnosis is useful (limits, why, compactions); its fix and re-read-loop advice is not. "
        + "drift, explain, rank, --submit, --llm and --trends reach the network and need --allow-network.",
      positionals: [{ key: "action", choices: AGENTBURN_ACTIONS }], remainder: "extra",
      options: [opt("--agent", "string", "claude-code", undefined, ["claude-code", "codex"]), opt("--allow-network", "bool", false)],
    },
    { name: "all", help: "run every audit without mutating anything", positionals: [], options: [
      opt("--project", "string", "."), opt("--days", "int", 90), opt("--runs", "int", 1), opt("--timeout", "int", 300),
      opt("--catalog", "string", null), opt("--skip-floor", "bool", false), opt("--skip-agentburn", "bool", false),
    ] },
  ];
}

const PROG = "context-optimizer.ts";

function optionUsage(option: Option): string {
  const metavar = option.choices ? `{${option.choices.join(",")}}` : option.key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase();
  if (option.kind === "bool") return option.flag;
  if (option.kind === "multi") return `${option.flag} ${metavar} [${metavar} ...]`;
  return `${option.flag} ${metavar}`;
}

function helpText(command?: Command): string {
  const specs = commandSpecs();
  if (!command) {
    const lines = [`usage: ${PROG} [-h] [--state-dir STATE_DIR] [--cache-dir CACHE_DIR] {${specs.map(spec => spec.name).join(",")}} ...`, "", DESCRIPTION, "", "options:"];
    lines.push("  -h, --help            show this help message and exit");
    for (const option of GLOBAL_OPTIONS) lines.push(`  ${optionUsage(option).padEnd(21)} ${option.help}`);
    lines.push("", "subcommands:");
    for (const spec of specs) lines.push(`  ${spec.name.padEnd(21)} ${spec.help}`);
    return lines.join("\n");
  }
  const positional = command.positionals.map(item => item.choices ? `{${item.choices.join(",")}}` : item.key);
  const usage = [`usage: ${PROG} ${command.name} [-h]`, ...command.options.map(option => `[${optionUsage(option)}]`), ...positional];
  if (command.remainder) usage.push(`[-- ${command.remainder.toUpperCase()} ...]`);
  const lines = [usage.join(" "), "", command.description ?? command.help, "", "options:", "  -h, --help            show this help message and exit"];
  for (const option of command.options) {
    const label = optionUsage(option);
    const detail = [option.help, option.value !== null && option.value !== undefined && option.kind !== "bool" && option.kind !== "append" ? `(default: ${option.value})` : ""].filter(Boolean).join(" ");
    lines.push(`  ${label.padEnd(21)} ${detail}`.trimEnd());
  }
  if (command.remainder) lines.push(`  -- ${command.remainder.toUpperCase()}...`.padEnd(23) + " arguments after -- go to agentburn");
  return lines.join("\n");
}

class UsageError extends Error {
  command?: Command;
  constructor(message: string, command?: Command) {
    super(message);
    this.command = command;
  }
}

class HelpRequest extends Error {
  command?: Command;
  constructor(command?: Command) {
    super("help");
    this.command = command;
  }
}

type Parsed = Record<string, unknown>;

function parseOptions(tokens: string[], options: Option[], positionals: Positional[], remainder: string | undefined, command?: Command): [Parsed, string[]] {
  const parsed: Parsed = {};
  for (const option of options) parsed[option.key] = Array.isArray(option.value) ? [...option.value] : option.value;
  const values: string[] = [];
  const extra: string[] = [];
  const fail = (message: string): never => { throw new UsageError(message, command); };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "-h" || token === "--help") throw new HelpRequest(command);
    if (token === "--") {
      if (!remainder) fail("unrecognized arguments: --");
      extra.push(...tokens.slice(index + 1));
      break;
    }
    if (token.startsWith("--")) {
      const equals = token.indexOf("=");
      const flag = equals < 0 ? token : token.slice(0, equals);
      const inline = equals < 0 ? undefined : token.slice(equals + 1);
      const option = options.find(item => item.flag === flag);
      if (!option) {
        if (remainder && values.length >= positionals.length) {
          extra.push(token);
          continue;
        }
        fail(`unrecognized arguments: ${token}`);
      }
      const known = option!;
      if (known.kind === "bool") {
        if (inline !== undefined) fail(`argument ${flag}: ignored explicit argument '${inline}'`);
        parsed[known.key] = true;
        continue;
      }
      const takeNext = (): string => {
        const next = tokens[index + 1];
        if (next === undefined || next.startsWith("-")) fail(`argument ${flag}: expected ${known.kind === "multi" ? "at least one argument" : "one argument"}`);
        index += 1;
        return next;
      };
      if (known.kind === "multi") {
        const items = inline !== undefined ? [inline] : [takeNext()];
        while (inline === undefined && tokens[index + 1] !== undefined && !tokens[index + 1].startsWith("-")) items.push(tokens[++index]);
        parsed[known.key] = items;
        continue;
      }
      const value = inline ?? takeNext();
      if (known.choices && !known.choices.includes(value)) fail(`argument ${flag}: invalid choice: '${value}' (choose from ${known.choices.map(item => `'${item}'`).join(", ")})`);
      if (known.kind === "int") {
        if (!/^-?\d+$/.test(value)) fail(`argument ${flag}: invalid int value: '${value}'`);
        parsed[known.key] = Number.parseInt(value, 10);
      } else if (known.kind === "append") {
        (parsed[known.key] as string[]).push(value);
      } else {
        parsed[known.key] = value;
      }
      continue;
    }
    if (values.length < positionals.length) {
      const positional = positionals[values.length];
      if (positional.choices && !positional.choices.includes(token)) {
        fail(`argument ${positional.key}: invalid choice: '${token}' (choose from ${positional.choices.map(item => `'${item}'`).join(", ")})`);
      }
      values.push(token);
      parsed[positional.key] = token;
    } else if (remainder) {
      extra.push(token);
    } else {
      return [parsed, tokens.slice(index)];
    }
  }
  if (values.length < positionals.length) fail(`the following arguments are required: ${positionals.slice(values.length).map(item => item.key).join(", ")}`);
  if (remainder) parsed[remainder] = extra;
  return [parsed, []];
}

export function main(argv = process.argv.slice(2)): number {
  const specs = commandSpecs();
  try {
    const firstCommand = argv.findIndex((token, index) => !token.startsWith("-") && !["--state-dir", "--cache-dir"].includes(argv[index - 1] ?? ""));
    const globalTokens = firstCommand < 0 ? argv : argv.slice(0, firstCommand);
    const [globals, leftover] = parseOptions(globalTokens, GLOBAL_OPTIONS, [], undefined);
    if (leftover.length) throw new UsageError(`unrecognized arguments: ${leftover.join(" ")}`);
    if (firstCommand < 0) throw new UsageError(`the following arguments are required: command`);
    const name = argv[firstCommand];
    const command = specs.find(spec => spec.name === name);
    if (!command) throw new UsageError(`argument command: invalid choice: '${name}' (choose from ${specs.map(spec => `'${spec.name}'`).join(", ")})`);
    const [parsed, rest] = parseOptions(argv.slice(firstCommand + 1), command.options, command.positionals, command.remainder, command);
    if (rest.length) throw new UsageError(`unrecognized arguments: ${rest.join(" ")}`, command);
    const args = { ...parsed, stateDir: expandUser(String(globals.stateDir)), cacheDir: expandUser(String(globals.cacheDir)) };
    switch (command.name) {
      case "floor": return cmdFloor(args as unknown as FloorArgs);
      case "usage": return cmdUsage(args as unknown as UsageArgs);
      case "commands": return cmdCommands(args as unknown as CommandsArgs);
      case "restore": return cmdRestore(args as unknown as { name: string; tasksDir: string });
      case "memory": return cmdMemory(args as unknown as MemoryArgs);
      case "mcp": return cmdMcp(args as unknown as McpArgs);
      case "agentburn": return cmdAgentburn(args as unknown as AgentburnArgs);
      default: return cmdAll(args as unknown as AllArgs);
    }
  } catch (error) {
    if (error instanceof HelpRequest) {
      process.stdout.write(helpText(error.command) + "\n");
      return 0;
    }
    if (error instanceof UsageError) {
      const usage = helpText(error.command).split("\n")[0];
      process.stderr.write(`${usage}\n${PROG}: error: ${redact(error.message)}\n`);
      return 2;
    }
    process.stderr.write(`${redact(error instanceof Error ? error.message : String(error))}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main();
