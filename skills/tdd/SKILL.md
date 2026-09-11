---
name: tdd
description: Deliver behavior with a disciplined red-green-refactor loop. Use when the user requests test-first work, red-green-refactor, or stronger integration coverage.
---

# Test-Driven Development

Read the relevant `CONTEXT.md` and ADRs first so the behavior and test names use the project's domain language.

## Choose seams before tests

Identify the public, observable seams to verify and confirm them with the user when they are not already fixed by an approved specification. Prefer existing seams and the highest meaningful interface. Do not test private methods or internal collaborations.

## Red → green → refactor

For one vertical behavior slice at a time:

1. Write the smallest failing behavior test at an agreed seam.
2. Run it and establish the failure for the intended reason.
3. Write only the production code required to make it pass.
4. Run the focused test and the relevant regression checks.
5. Optionally make a small behavior-preserving refactor and rerun the focused tests. Broader
   redesign needs its own scope and review; do not expand the current slice speculatively.

Good tests describe a caller-visible capability, survive internal refactors, and use independent expected values. Avoid tautological assertions, snapshots without meaningful assertions, and checking the database or call counts through a side channel when the public interface can be used instead.

Mock only genuine system boundaries—external services, time, randomness, or occasionally the filesystem. Prefer real collaborators and test databases where practical; do not mock modules owned by the codebase merely to assert their invocation.
