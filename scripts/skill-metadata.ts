import { parseDocument } from "yaml";

export interface SkillMetadataError {
  code: "skill-name-missing" | "skill-metadata-invalid";
  message: string;
}

export interface SkillMetadataValidation {
  name?: string;
  errors: SkillMetadataError[];
}

const namePattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const frontmatterPattern = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function invalid(message: string, name?: string): SkillMetadataValidation {
  return { ...(name === undefined ? {} : { name }), errors: [{ code: "skill-metadata-invalid", message }] };
}

function boundedFrontmatter(text: string): string | undefined {
  return text.match(frontmatterPattern)?.[1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSkillMetadata(text: string): SkillMetadataValidation {
  const frontmatter = boundedFrontmatter(text);
  if (frontmatter === undefined) return { errors: [{ code: "skill-name-missing", message: "missing frontmatter name" }] };

  let parsed: unknown;
  try {
    const document = parseDocument(frontmatter, { uniqueKeys: true });
    if (document.errors.length > 0) return invalid("frontmatter is not valid YAML");
    parsed = document.toJS();
  } catch {
    return invalid("frontmatter is not valid YAML");
  }
  if (!isRecord(parsed)) return invalid("frontmatter must be a mapping");
  if (typeof parsed.name !== "string" || !parsed.name) return { errors: [{ code: "skill-name-missing", message: "missing frontmatter name" }] };

  const { name } = parsed;
  if (name.length > 64 || !namePattern.test(name)) return invalid("name must be canonical lowercase letters, digits, dots, or hyphens and no longer than 64 characters");
  if (typeof parsed.description !== "string" || !parsed.description.trim() || parsed.description.length > 1024) return invalid("description must be a nonempty string no longer than 1024 characters", name);
  if (parsed.effort !== undefined && !["fast", "standard", "deep"].includes(parsed.effort as string)) return invalid("effort must be fast, standard, or deep", name);
  if (parsed["argument-hint"] !== undefined && typeof parsed["argument-hint"] !== "string") return invalid("argument-hint must be a string", name);
  for (const key of ["disable-model-invocation", "user-invocable"] as const) {
    if (parsed[key] !== undefined && typeof parsed[key] !== "boolean") return invalid(`${key} must be a boolean`, name);
  }
  if (parsed["allowed-tools"] !== undefined && (typeof parsed["allowed-tools"] !== "string" && (!Array.isArray(parsed["allowed-tools"]) || parsed["allowed-tools"].some(tool => typeof tool !== "string")))) return invalid("allowed-tools must be a string or an array of strings", name);
  if (parsed.metadata !== undefined && !isRecord(parsed.metadata)) return invalid("metadata must be a mapping", name);
  return { name, errors: [] };
}
