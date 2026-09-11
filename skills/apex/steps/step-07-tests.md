---
name: step-07-tests
description: Compatibility step for adding requested tests missing from a legacy non-TDD route
prev_step: steps/step-04-validate.md
next_step: steps/step-08-run-tests.md
---

# Compatibility step: add tests

Modern APEX plans and implements tests with each behavior. Use this step only when test mode is enabled and a resumed legacy run or explicit non-TDD route reached validation without required coverage. If tests are disabled, return directly to validation without touching test files.

Reuse test infrastructure and comparable tests already found during analysis. Add the smallest behavior-focused tests that cover unmet acceptance criteria, following project conventions. Exercise the highest practical public observable seam, derive expected values independently of production logic, and mock only genuine external boundaries. Do not create another test plan or ask for routine approval.

Add touched test paths to `{owned_paths}`, invalidate affected evidence, then load `step-08-run-tests.md`.
