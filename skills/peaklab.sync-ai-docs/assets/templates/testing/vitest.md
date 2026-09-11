---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/vitest.config.*"
  - "**/vitest.setup.*"
---

# Vitest Rules

Scope: Vitest test, configuration, and setup files

## Match the installed Vitest version

Read the installed version, configuration, runtime, and existing test utilities before using an API. Do not label repository rules with a broad major-version promise or assume browser, DOM, globals, pool, and isolation settings.

Test observable behavior and important side effects. Keep tests independent of execution order, wall-clock timing, live networks, and mutable state left by another test.

## Mock at boundaries

Use fakes or module mocks for external boundaries that should not execute. Use spies when the real implementation is safe and the call itself is part of the contract. Neither approach is universally preferable.

Remember that static `vi.mock()` calls are hoisted. Do not reference later-initialized variables from a mock factory; use the installed Vitest version's documented hoisting or dynamic-mocking APIs when needed.

Restore mocks, timers, environment changes, and globals in teardown or through configured automatic cleanup. Avoid mocking the unit under test so completely that the assertion only verifies the mock.

## Await asynchronous behavior

Await the operation and the assertion helpers that return promises. Test both resolved and rejected paths where they are part of the contract.

```typescript
it('rejects an unknown user', async () => {
  await expect(loadUser('missing')).rejects.toThrow('not found')
})
```

When using fake timers, advance them with the API appropriate to asynchronous callbacks and restore real timers afterward. Do not mix fake time with uncontrolled real timers.

## Test UI through the user-visible surface

For UI tests, prefer accessible roles, labels, and names over implementation selectors. Use the interaction library already configured by the project. Await user interactions and async DOM updates.

Snapshots are appropriate for small, stable, reviewable serialized output. Prefer focused assertions for behavior and avoid large UI snapshots that reviewers cannot assess meaningfully.

Run the focused file, then the repository's configured Vitest command with the same environment and setup used in CI. Report skipped tests separately from executed passes.
