import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSkillMetadata } from "../scripts/skill-metadata.ts";

const codes = (text: string) => validateSkillMetadata(text).errors.map(error => error.code);

test("accepts valid YAML frontmatter including multiline and quoted scalars", () => {
  const result = validateSkillMetadata(`---
name: "peaklab.example"
description: >-
  A concise description
  with a continuation.
effort: standard
argument-hint: '--target "project path"'
disable-model-invocation: true
user-invocable: false
allowed-tools:
  - Read
  - "Bash(bun test)"
metadata:
  owner: platform
  options:
    retries: 2
host-specific-field: accepted
---

# Example
`);

  expect(result).toEqual({ name: "peaklab.example", errors: [] });
});

test("accepts whitespace and CRLF frontmatter delimiters", () => {
  expect(validateSkillMetadata("--- \t\r\nname: valid\r\ndescription: valid\r\n--- \t\r\n")).toEqual({ name: "valid", errors: [] });
});

test("keeps the established missing-name code for absent or unbounded frontmatter", () => {
  expect(codes("# No frontmatter")).toEqual(["skill-name-missing"]);
  expect(codes("---\ndescription: present\n---\n# Missing name")).toEqual(["skill-name-missing"]);
  expect(codes("---\nname: one\ndescription: valid\n---\nbody\n---\nname: two\n")).toEqual([]);
});

test("rejects malformed YAML and invalid known metadata", () => {
  expect(codes("---\nname: valid\ndescription: [\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: Invalid_Name\ndescription: valid\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: valid\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: valid\ndescription: \"\"\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: valid\ndescription: 42\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes(`---\nname: ${"a".repeat(65)}\ndescription: valid\n---`)).toEqual(["skill-metadata-invalid"]);
  expect(codes(`---\nname: valid\ndescription: ${"a".repeat(1025)}\n---`)).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: valid\ndescription: valid\neffort: extreme\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: valid\ndescription: valid\nargument-hint: [one]\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: valid\ndescription: valid\ndisable-model-invocation: yes\n---")).toEqual(["skill-metadata-invalid"]);
});

test("validates allowed-tools and metadata container types", () => {
  expect(codes("---\nname: valid\ndescription: valid\nallowed-tools: Read\nmetadata: {}\n---")).toEqual([]);
  expect(codes("---\nname: valid\ndescription: valid\nallowed-tools: [Read, Write]\n---")).toEqual([]);
  expect(codes("---\nname: valid\ndescription: valid\nallowed-tools: [Read, 1]\n---")).toEqual(["skill-metadata-invalid"]);
  expect(codes("---\nname: valid\ndescription: valid\nmetadata: []\n---")).toEqual(["skill-metadata-invalid"]);
});

test("rejects duplicate YAML keys in block, quoted, flow, and nested mappings", () => {
  for (const metadata of [
    "name: valid\nname: replacement\ndescription: valid",
    "\"name\": valid\nname: replacement\ndescription: valid",
    "{name: valid, name: replacement, description: valid}",
    "name: valid\ndescription: valid\nmetadata: { owner: one, owner: two }",
  ]) {
    expect(codes(`---\n${metadata}\n---`)).toEqual(["skill-metadata-invalid"]);
  }
});

test("accepts all catalogue skill metadata", () => {
  const skills = join(import.meta.dir, "..", "skills");
  const errors = readdirSync(skills, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => validateSkillMetadata(readFileSync(join(skills, entry.name, "SKILL.md"), "utf8")).errors);
  expect(errors).toEqual([]);
});
