import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STATE_FILE = ".peaklab-agent-state.json";
export const RECOVERY_FILE = ".peaklab-agent-recovery.json";

export type Agent = "codex" | "claude-code";

export interface InstallAgentsOptions {
  target: string;
  agent: Agent;
  apply?: boolean;
  update?: boolean;
  sourceRoot?: string;
  /** Test seam for simulating failures between checked writes. */
  checkedWrite?: typeof writeChecked;
}

type Source = readonly [string, readonly string[]];
type StateFiles = Record<string, string>;
type RecoveryEntry = { name: string; before: string | null; after: string };
type Recovery = {
  version: 1;
  catalogue: "peak-lab/agents-skills";
  agent: Agent;
  mode: "install" | "update";
  stateBefore: string | null;
  files: RecoveryEntry[];
};

const catalogueRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sources(sourceRoot: string): Record<Agent, Source> {
  return {
    codex: [join(sourceRoot, "agents", "codex"), [".codex", "agents"]],
    "claude-code": [join(sourceRoot, "agents", "claude"), [".claude", "agents"]],
  };
}

function lstatOrNull(path: string) {
  try {
    return lstatSync(path);
  } catch (error: unknown) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function rejectSymlink(path: string): void {
  if (lstatOrNull(path)?.isSymbolicLink()) {
    throw new Error(`refusing symlinked path: ${path}`);
  }
}

function explicitAbsolute(path: string): string {
  const expanded = path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
  return isAbsolute(expanded) ? resolve(expanded) : resolve(process.cwd(), expanded);
}

function destination(targetInput: string, agent: Agent, sourceRoot: string): string {
  const target = explicitAbsolute(targetInput);
  rejectSymlink(target);
  const targetStat = lstatOrNull(target);
  if (!targetStat?.isDirectory()) {
    throw new Error(`target must be an existing directory: ${target}`);
  }

  const resolved = realpathSync(target);
  if (resolved === realpathSync(homedir()) || resolved === parse(resolved).root) {
    throw new Error(`refusing global target directory: ${target}`);
  }

  const [, relativeDestination] = sources(sourceRoot)[agent];
  let current = target;
  for (const part of relativeDestination) {
    current = join(current, part);
    rejectSymlink(current);
    const stat = lstatOrNull(current);
    if (stat && !stat.isDirectory()) {
      throw new Error(`destination component is not a directory: ${current}`);
    }
  }
  return join(target, ...relativeDestination);
}

function digest(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function readFile(path: string): Buffer | null {
  rejectSymlink(path);
  const stat = lstatOrNull(path);
  if (!stat) return null;
  if (!stat.isFile()) throw new Error(`not a regular file: ${path}`);
  return readFileSync(path);
}

function readState(path: string, agent: Agent): readonly [StateFiles, Buffer | null] {
  const raw = readFile(path);
  if (raw === null) return [{}, null];

  try {
    return [parseState(raw, agent), raw];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid agent state ${path}: ${message}`);
  }
}

function parseState(raw: Buffer, agent: Agent): StateFiles {
  const state: unknown = JSON.parse(raw.toString("utf8"));
  if (!isState(state, agent)) throw new Error("unsupported state schema");
  for (const [name, checksum] of Object.entries(state.files)) {
    if (!/^[a-z0-9][a-z0-9-]*\.(?:md|toml)$/.test(name) || !/^[0-9a-f]{64}$/.test(checksum)) {
      throw new Error("invalid state entry");
    }
  }
  return state.files;
}

function isState(value: unknown, agent: Agent): value is { version: 1; catalogue: string; agent: Agent; files: StateFiles } {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  if (state.version !== 1 || state.catalogue !== "peak-lab/agents-skills" || state.agent !== agent) return false;
  if (typeof state.files !== "object" || state.files === null || Array.isArray(state.files)) return false;
  return Object.values(state.files).every((checksum) => typeof checksum === "string");
}

export function writeChecked(path: string, content: Buffer, expected: Buffer | null): void {
  if (!buffersEqual(readFile(path), expected)) {
    throw new Error(`file changed during installation: ${path}`);
  }
  if (expected === null) {
    writeNewDurably(path, content);
    return;
  }

  const temporary = join(dirname(path), `.peaklab-write-${randomBytes(12).toString("hex")}`);
  let created = false;
  try {
    const descriptor = openSync(temporary, "wx");
    created = true;
    try {
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    chmodSync(temporary, statSync(path).mode & 0o777);
    if (!buffersEqual(readFile(path), expected)) {
      throw new Error(`file changed during installation: ${path}`);
    }
    renameSync(temporary, path);
  } finally {
    if (created && existsSync(temporary)) unlinkSync(temporary);
  }
}

function buffersEqual(left: Buffer | null, right: Buffer | null): boolean {
  return left === right || (left !== null && right !== null && left.equals(right));
}

function stateContent(agent: Agent, files: StateFiles): Buffer {
  return Buffer.from(`${JSON.stringify({ version: 1, catalogue: "peak-lab/agents-skills", agent, files }, null, 2)}\n`);
}

function isChecksum(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function readRecovery(path: string, agent: Agent): readonly [Recovery | null, Buffer | null] {
  const raw = readFile(path);
  if (raw === null) return [null, null];
  try {
    const value: unknown = JSON.parse(raw.toString("utf8"));
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object");
    const recovery = value as Record<string, unknown>;
    if (recovery.version !== 1 || recovery.catalogue !== "peak-lab/agents-skills" || recovery.agent !== agent) {
      throw new Error("unsupported schema");
    }
    if (recovery.mode !== "install" && recovery.mode !== "update") throw new Error("invalid mode");
    if (recovery.stateBefore !== null && typeof recovery.stateBefore !== "string") throw new Error("invalid prior state");
    if (!Array.isArray(recovery.files) || recovery.files.length === 0) throw new Error("invalid file list");
    const files: RecoveryEntry[] = recovery.files.map((entry): RecoveryEntry => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new Error("invalid file entry");
      const file = entry as Record<string, unknown>;
      if (typeof file.name !== "string" || (file.before !== null && !isChecksum(file.before)) || !isChecksum(file.after)) {
        throw new Error("invalid file entry");
      }
      return { name: file.name, before: file.before, after: file.after };
    });
    if (new Set(files.map((file) => file.name)).size !== files.length) throw new Error("duplicate file entry");
    return [{ version: 1, catalogue: "peak-lab/agents-skills", agent, mode: recovery.mode, stateBefore: recovery.stateBefore, files }, raw];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid agent recovery journal ${path}: ${message}`);
  }
}

function writeNewDurably(path: string, content: Buffer): void {
  const temporary = join(dirname(path), `.peaklab-write-${randomBytes(12).toString("hex")}`);
  let created = false;
  try {
    const descriptor = openSync(temporary, "wx");
    created = true;
    try {
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    linkSync(temporary, path);
  } finally {
    if (created && existsSync(temporary)) unlinkSync(temporary);
  }
}

function recoveryFor(
  agent: Agent,
  mode: Recovery["mode"],
  oldState: Buffer | null,
  changes: readonly { path: string; content: Buffer; current: Buffer | null }[],
): Buffer {
  const files = changes.map((change) => ({
    name: change.path.split(/[\\/]/).at(-1) as string,
    before: change.current === null ? null : digest(change.current),
    after: digest(change.content),
  }));
  return Buffer.from(`${JSON.stringify({ version: 1, catalogue: "peak-lab/agents-skills", agent, mode, stateBefore: oldState?.toString("base64") ?? null, files }, null, 2)}\n`);
}

function validatedRecovery(
  recovery: Recovery,
  sourceNames: readonly string[],
  source: string,
  destinationDir: string,
  statePath: string,
): { changes: Array<{ path: string; content: Buffer; current: Buffer | null }>; stateAtValidation: Buffer | null; newState: Buffer } {
  const oldState = recovery.stateBefore === null ? null : Buffer.from(recovery.stateBefore, "base64");
  if (recovery.mode === "install" && oldState !== null) {
    throw new Error("invalid agent recovery journal: inconsistent mode");
  }
  let baseline: StateFiles;
  try {
    baseline = oldState === null ? {} : parseState(oldState, recovery.agent);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid agent recovery journal: invalid prior state: ${message}`);
  }
  const entries = new Map(recovery.files.map((file) => [file.name, file]));
  const expectedEntryNames = new Set<string>();
  const newBaseline: StateFiles = { ...baseline };
  const changes: Array<{ path: string; content: Buffer; current: Buffer | null }> = [];
  for (const name of sourceNames) {
    const content = readFile(join(source, name));
    if (content === null) throw new Error(`missing agent source: ${join(source, name)}`);
    const before = baseline[name];
    const expectedChange = before === undefined ? true : before !== digest(content);
    const entry = entries.get(name);
    if (expectedChange !== Boolean(entry)) throw new Error(`invalid agent recovery journal: unexpected entry for ${name}`);
    const path = join(destinationDir, name);
    const current = readFile(path);
    if (entry) {
      expectedEntryNames.add(name);
      if (entry.before !== (before ?? null) || entry.after !== digest(content)) {
        throw new Error(`invalid agent recovery journal: inconsistent entry for ${name}`);
      }
      const currentDigest = current === null ? null : digest(current);
      if (currentDigest !== entry.before && currentDigest !== entry.after) {
        throw new Error(`recovery blocked by changed agent: ${path}`);
      }
      if (currentDigest !== entry.after) changes.push({ path, content, current });
      newBaseline[name] = entry.after;
    } else if (current === null || digest(current) !== before) {
      throw new Error(`recovery blocked by changed agent: ${path}`);
    }
  }
  if (entries.size !== expectedEntryNames.size) {
    throw new Error("invalid agent recovery journal: unknown file entry");
  }
  const newState = stateContent(recovery.agent, newBaseline);
  const currentState = readFile(statePath);
  if (!buffersEqual(currentState, oldState) && !buffersEqual(currentState, newState)) {
    throw new Error("recovery blocked by changed agent state");
  }
  return { changes, stateAtValidation: currentState, newState };
}

export function installAgents(options: InstallAgentsOptions): string[] {
  const { target, agent, apply = false, update = false, sourceRoot = catalogueRoot, checkedWrite = writeChecked } = options;
  if (agent !== "codex" && agent !== "claude-code") throw new Error(`unsupported agent: ${agent}`);

  const [source] = sources(sourceRoot)[agent];
  if (!lstatOrNull(source)?.isDirectory()) {
    throw new Error(`agent source directory is missing: ${source}`);
  }
  const destinationDir = destination(target, agent, sourceRoot);
  const suffix = agent === "codex" ? ".toml" : ".md";
  const sourceNames = readdirSync(source).filter((name) => name.endsWith(suffix)).sort();
  if (sourceNames.length === 0) throw new Error(`no native agent definitions in ${source}`);
  for (const name of sourceNames) {
    if (!new RegExp(`^[a-z0-9][a-z0-9-]*\\${suffix}$`).test(name)) {
      throw new Error(`invalid agent filename: ${name}`);
    }
  }

  const statePath = join(destinationDir, STATE_FILE);
  const recoveryPath = join(destinationDir, RECOVERY_FILE);
  const [recovery, recoveryRaw] = readRecovery(recoveryPath, agent);
  if (recovery !== null && recoveryRaw !== null) {
    if (recovery.mode === "update" && !update) throw new Error("interrupted update requires the update command");
    const recovered = validatedRecovery(recovery, sourceNames, source, destinationDir, statePath);
    if (!apply) return recovered.changes.map((change) => change.path);

    destination(target, agent, sourceRoot);
    mkdirSync(destinationDir, { recursive: true });
    rejectSymlink(destinationDir);
    if (!buffersEqual(readFile(recoveryPath), recoveryRaw)) throw new Error("agent recovery journal changed during installation");
    for (const change of recovered.changes) checkedWrite(change.path, change.content, change.current);
    if (!buffersEqual(readFile(recoveryPath), recoveryRaw)) throw new Error("agent recovery journal changed during installation");
    if (!buffersEqual(recovered.stateAtValidation, recovered.newState)) {
      checkedWrite(statePath, recovered.newState, recovered.stateAtValidation);
    }
    if (!buffersEqual(readFile(recoveryPath), recoveryRaw)) throw new Error("agent recovery journal changed during installation");
    unlinkSync(recoveryPath);
    return recovered.changes.map((change) => change.path);
  }

  const [baseline, oldState] = readState(statePath, agent);
  if (oldState !== null && !update) throw new Error("agent state already exists; use --update");

  const changes: Array<{ path: string; content: Buffer; current: Buffer | null }> = [];
  const conflicts: string[] = [];
  const newBaseline: StateFiles = { ...baseline };
  for (const name of sourceNames) {
    const content = readFile(join(source, name));
    if (content === null) throw new Error(`missing agent source: ${join(source, name)}`);
    const candidate = join(destinationDir, name);
    const current = readFile(candidate);
    const previous = baseline[name];
    if (current !== null && !update) conflicts.push(`existing agent definitions: ${candidate}`);
    else if (previous === undefined && current !== null) conflicts.push(`untracked agent (legacy or user-owned): ${candidate}`);
    else if (previous !== undefined && current === null) conflicts.push(`missing tracked agent: ${candidate}`);
    else if (previous !== undefined && current !== null && digest(current) !== previous) conflicts.push(`locally modified agent: ${candidate}`);
    else if (!buffersEqual(current, content)) {
      changes.push({ path: candidate, content, current });
      newBaseline[name] = digest(content);
    }
  }
  if (conflicts.length > 0) throw new Error(`refusing update before any writes:\n${conflicts.join("\n")}`);

  if (apply && changes.length > 0) {
    destination(target, agent, sourceRoot);
    mkdirSync(destinationDir, { recursive: true });
    rejectSymlink(destinationDir);
    if (!buffersEqual(readFile(statePath), oldState)) throw new Error("agent state changed during installation");
    writeNewDurably(recoveryPath, recoveryFor(agent, update ? "update" : "install", oldState, changes));
    for (const change of changes) checkedWrite(change.path, change.content, change.current);
    const state = stateContent(agent, newBaseline);
    checkedWrite(statePath, state, oldState);
    unlinkSync(recoveryPath);
  }
  return changes.map((change) => change.path);
}
