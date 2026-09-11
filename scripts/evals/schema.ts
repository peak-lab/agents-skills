import { safePath } from "./catalogue.ts";
import type { Action, Assertion, Scenario } from "./types.ts";

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const actionKeys = {
  load_skill: ["type", "name"], read_file: ["type", "path"], write_file: ["type", "path", "content"],
  service_call: ["type", "service", "operation", "target"], finish: ["type", "status", "message"],
} as const;

export const actionSchema: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  properties: {
    type: { type: "string", enum: Object.keys(actionKeys) },
    ...Object.fromEntries([...new Set(Object.values(actionKeys).flat())].filter(key => key !== "type").map(key => [key, { type: "string" }])),
  },
  required: ["type"],
};

export function parseAction(text: string): Action {
  const value: unknown = JSON.parse(text);
  if (!record(value) || typeof value.type !== "string" || !Object.hasOwn(actionKeys, value.type)) throw new Error("invalid action type");
  const keys = actionKeys[value.type as keyof typeof actionKeys];
  if (Object.keys(value).length !== keys.length || !keys.every(key => typeof value[key] === "string")) throw new Error("invalid action fields");
  if (typeof value.path === "string" && !safePath(value.path)) throw new Error("unsafe action path");
  if (JSON.stringify(value).length > 32_000) throw new Error("action exceeds size limit");
  return value as unknown as Action;
}

function validAssertion(value: unknown): value is Assertion {
  if (!record(value)) return false;
  switch (value.kind) {
    case "status": return Array.isArray(value.values) && value.values.length > 0 && value.values.every(v => typeof v === "string");
    case "message_matches":
      if (typeof value.pattern !== "string" || value.pattern.length > 300) return false;
      try { new RegExp(value.pattern, "i"); return true; } catch { return false; }
    case "file_equals": return typeof value.path === "string" && safePath(value.path) && typeof value.content === "string";
    case "file_json_value": return typeof value.path === "string" && safePath(value.path) && Array.isArray(value.keys) && value.keys.every(key => typeof key === "string") && Object.hasOwn(value, "value");
    case "files_unchanged": return true;
    case "service_calls_only": return true;
    case "first_skill": return value.name === null || typeof value.name === "string";
    case "first_skill_not": return typeof value.name === "string";
    case "action_count": return typeof value.type === "string" && Object.hasOwn(actionKeys, value.type)
      && (value.min !== undefined || value.max !== undefined)
      && [value.min, value.max].every(v => v === undefined || (Number.isInteger(v) && Number(v) >= 0))
      && (value.match === undefined || (record(value.match) && Object.values(value.match).every(v => typeof v === "string")));
    default: return false;
  }
}

export function parseScenarios(value: unknown): Scenario[] {
  if (!Array.isArray(value) || !value.length) throw new Error("scenario suite must be a nonempty array");
  const ids = new Set<string>();
  for (const entry of value) {
    if (!record(entry) || typeof entry.id !== "string" || !/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id)
      || !["behavior", "routing"].includes(String(entry.kind)) || typeof entry.skill !== "string"
      || typeof entry.prompt !== "string" || !entry.prompt.trim() || entry.prompt.length > 20_000
      || !record(entry.files) || !Object.entries(entry.files).every(([path, text]) => safePath(path) && !path.startsWith("skills/") && typeof text === "string")
      || !Array.isArray(entry.services) || !entry.services.every(s => record(s) && [s.service, s.operation, s.target].every(v => typeof v === "string") && Object.hasOwn(s, "response"))
      || !Array.isArray(entry.assertions) || !entry.assertions.length || !entry.assertions.every(validAssertion)) {
      throw new Error(`invalid scenario: ${record(entry) ? String(entry.id) : "unknown"}`);
    }
    const endpoints = entry.services.map(s => JSON.stringify([s.service, s.operation, s.target]));
    if (new Set(endpoints).size !== endpoints.length) throw new Error(`duplicate service fixture: ${entry.id}`);
    ids.add(entry.id);
  }
  return value as Scenario[];
}
