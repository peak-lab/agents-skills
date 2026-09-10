---
name: step-07-tests
description: Compatibility step for adding requested tests missing from a legacy non-TDD route
prev_step: steps/step-04-validate.md
next_step: steps/step-08-run-tests.md
---

# Compatibility step: add tests

Modern APEX plans and implements tests with each behavior. Use this step only when a resumed legacy run or explicit non-TDD route reached validation without required coverage.

Reuse test infrastructure and comparable tests already found during analysis. Add the smallest behavior-focused tests that cover unmet acceptance criteria, following project conventions. Do not create another test plan or ask for routine approval.

Add touched test paths to `{owned_paths}`, invalidate affected evidence, then load `step-08-run-tests.md`.
