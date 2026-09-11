---
paths:
  - "**/*.py"
---

# Python Rules

Scope: `**/*.py`

## Target the declared Python version

Read `pyproject.toml`, runtime files, CI, and deployment configuration before choosing syntax or standard-library features. Use the repository's supported minimum version, not the newest interpreter on the development machine.

Follow the project's package manager and lockfile. Do not replace `pip`, Poetry, PDM, uv, or another established workflow merely from a generic preference. Reproducible environments matter more than the tool name.

## Use types where they protect a boundary

Annotate public APIs, shared data structures, and non-obvious functions according to the project's type-checking policy. Local inference is fine when it remains clear. Use built-in generics and union syntax only when the minimum Python version supports them.

Use an enum or `Literal` for a genuinely closed set of domain values. Use dataclasses, typed mappings, validation models, or ordinary classes according to behavior and boundary requirements; do not replace every dictionary with a dataclass.

## Manage resources and failures explicitly

Use context managers for files, locks, transactions, and clients that support them. Ensure async resources use their async context-management or close APIs.

Catch exceptions you can handle, add useful context, and preserve the original cause with `raise ... from exc` when translating errors. Broad catches are acceptable only at process or request boundaries that log, report, clean up, or convert the failure deliberately. Never silently swallow an error.

Use lazy logging arguments rather than preformatted strings when the logging framework expects them:

```python
logger.info("processed job %s", job_id)
```

For ordinary strings, choose the clearest formatting style; f-strings are not mandatory when no interpolation occurs.

## Keep transformations readable

Comprehensions are useful for one clear mapping or filter. Prefer an explicit loop when control flow, side effects, error handling, or nesting makes the comprehension harder to understand. Use structural pattern matching only when it clarifies the shape-based dispatch.

## Verify with project tooling

Run the configured formatter, linter, type checker, and focused tests. Do not introduce a new tool or raise the minimum Python version as a side effect of an unrelated change.
