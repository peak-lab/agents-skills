---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Rules

Scope: `**/*.ts`, `**/*.tsx`

## Respect the project configuration

Read `tsconfig.json`, package metadata, lockfiles, lint rules, and runtime targets before changing syntax or commands. Use the repository's package manager and scripts; never introduce or mix lockfiles from another manager.

Preserve strict compiler settings. Enabling stricter options can be valuable, but treat it as an intentional migration when an existing codebase is not ready rather than hiding new errors with broad casts.

## Validate values at boundaries

Use `unknown` for untrusted input, then validate and narrow it before access. Type assertions do not perform runtime validation.

```typescript
function hasName(value: unknown): value is { name: string } {
  return typeof value === 'object'
    && value !== null
    && 'name' in value
    && typeof value.name === 'string'
}
```

Avoid `any` unless an untyped dependency forces it into a narrow adapter. Do not let the escape hatch spread through application code.

## Model states precisely

Use discriminated unions when fields depend on a state:

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }
```

Use literal unions or `as const` objects for closed values when runtime lookup is useful. Native enums remain valid when their runtime object or interoperability semantics are intentional. Do not replace every repeated string with an enum.

Handle discriminated states exhaustively at important boundaries so a newly added case becomes a type error.

## Keep module boundaries explicit

Use `import type` when required by the compiler/module configuration or when it makes a type-only dependency clear. Avoid adding runtime imports for symbols used only as types.

Annotate exported functions and public interfaces when it stabilizes the contract. Let obvious local helpers infer their return type. Prefer small validation adapters over repeated assertions at call sites.

## Verify the actual targets

Run the repository's type-check, lint, build, and focused test scripts. Test each configured runtime separately when code is shared across server, browser, worker, or edge targets.
