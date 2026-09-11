---
paths:
  - "**/*.php"
---

# PHP Rules

Scope: `**/*.php`

## Target the declared PHP version

Read `composer.json`, the platform configuration, CI, and deployment images before using language features. The newest locally available syntax is not portable when production targets an older PHP release.

Use `declare(strict_types=1);` when that matches the repository's convention. Add parameter, property, and return types where they clarify the contract and are supported by the target version. Prefer a precise type over `mixed`; use PHPDoc for generic collection shapes that native types cannot express.

## Model domain states deliberately

Use backed enums for stable, closed domain sets when the minimum PHP version supports them and when values cross a persistence or API boundary. Literal strings remain appropriate for messages, protocol values used once, and open-ended external data.

Use `match` when strict comparison, exhaustiveness, or a returned value improves the code. A simple conditional is often clearer than forcing every branch into `match`.

## Choose object features for the invariant

- Constructor promotion reduces duplication for straightforward dependencies and value objects; explicit properties are valid when annotations or initialization logic need more space.
- `readonly` is appropriate for values that must not be reassigned after initialization; it does not make referenced objects deeply immutable.
- Property hooks and asymmetric visibility require a compatible runtime. Use them only when they make an access invariant clearer than ordinary methods or visibility.
- First-class callables are useful when a callable is passed as a value and supported by the target runtime; they are not a blanket replacement for every string callback.

## Preserve runtime safety

Validate untrusted input at the boundary. Use parameterized database queries, escape output for its target context, and avoid unserializing untrusted data. Do not suppress errors with `@` or catch `Throwable` without a deliberate recovery or translation boundary.

Keep credentials out of source, exceptions, and logs. Use the project's configuration loader rather than direct environment reads scattered through domain code.

## Follow project tooling

Use the repository's Composer scripts, formatter, static analyzer, and test commands. Preserve the existing lockfile and package-manager workflow. Run syntax checks and the relevant static analysis/tests after changing public types or version-dependent syntax.
