export interface ModelRequest {
  prompt: string;
  timeoutMs: number;
  jsonSchema?: Record<string, unknown>;
}

export interface ModelResponse {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd?: number;
}

export interface ModelAdapter {
  host: string;
  model: string;
  version: string;
  complete(request: ModelRequest): Promise<ModelResponse>;
}

export type Action =
  | { type: "load_skill"; name: string }
  | { type: "read_file"; path: string }
  | { type: "write_file"; path: string; content: string }
  | { type: "service_call"; service: string; operation: string; target: string }
  | { type: "finish"; status: string; message: string };

export type Assertion =
  | { kind: "status"; values: string[] }
  | { kind: "message_matches"; pattern: string }
  | { kind: "file_equals"; path: string; content: string }
  | { kind: "file_json_value"; path: string; keys: string[]; value: unknown }
  | { kind: "files_unchanged" }
  | { kind: "service_calls_only" }
  | { kind: "action_count"; type: Action["type"]; min?: number; max?: number; match?: Record<string, string> }
  | { kind: "first_skill"; name: string | null }
  | { kind: "first_skill_not"; name: string };

export interface Scenario {
  id: string;
  kind: "behavior" | "routing";
  skill: string;
  prompt: string;
  files: Record<string, string>;
  services: Array<{ service: string; operation: string; target: string; response: unknown }>;
  assertions: Assertion[];
}

export interface Catalogue {
  hash: string;
  skills: Array<{ name: string; description: string }>;
  files: Record<string, string>;
}

export interface TraceEntry {
  step: number;
  action: Action;
  result: unknown;
}

export interface RunResult {
  scenario: string;
  kind: Scenario["kind"];
  variant: string;
  repeat: number;
  host: string;
  model: string;
  hostVersion: string;
  catalogueHash: string;
  scenarioHash: string;
  outcome: "pass" | "fail" | "error";
  error?: string;
  checks: Array<{ assertion: Assertion; passed: boolean; evidence: string }>;
  trace: TraceEntry[];
  files: Record<string, string>;
  final: Extract<Action, { type: "finish" }> | null;
  durationMs: number;
  calls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}
