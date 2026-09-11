---
paths:
  - "**/test_*.py"
  - "**/*_test.py"
  - "**/conftest.py"
  - "**/tests/**"
---

# Pytest Rules

Scope: `**/test_*.py`, `**/*_test.py`, `**/conftest.py`, `**/tests/**`

## Test observable behavior

Write tests around public behavior, durable side effects, and failure contracts. Avoid assertions that merely mirror implementation details. Keep tests deterministic: control time, randomness, network access, and external services through the project's supported fixtures or fakes.

Each test must be able to run alone and in any order. Do not depend on mutable module state or data created by another test.

## Put fixtures at the right scope

Keep a fixture near the tests that use it. Move it to the nearest `conftest.py` only when it is genuinely shared. Pytest discovers `conftest.py` fixtures without imports; do not import fixtures from sibling test modules.

Choose fixture scope from the resource lifecycle, not merely speed. A wider-scoped mutable fixture needs explicit isolation or reset behavior. Use `yield` or registered finalizers so cleanup also runs after failures.

## Isolate files and process state

Use `tmp_path` for disposable filesystem work and `monkeypatch` for environment variables, attributes, and working-directory changes. Avoid fixed global temporary paths and direct environment mutations that leak into later tests.

Do not place real credentials in fixtures. Prevent unintended network calls unless the test is explicitly an integration test with an authorized target.

## Configure async tests explicitly

Pytest does not execute async tests by itself. Confirm that the repository has the appropriate async plugin and mode, then use its documented marker and fixture decorators. Depending on pytest and plugin versions, an unsupported coroutine test may be skipped, warned about, or rejected; never interpret collection as proof that its body ran.

Run at least one async test directly when changing async configuration, and treat coroutine-related warnings as failures in CI where practical.

## Prefer focused variation

Use parametrization for the same behavior across meaningful inputs. Keep case identifiers readable. Avoid loops inside a test when separate cases would produce clearer failures.

Run focused tests first, then the repository's configured suite. Report skipped and xfailed tests separately from executed passes.
