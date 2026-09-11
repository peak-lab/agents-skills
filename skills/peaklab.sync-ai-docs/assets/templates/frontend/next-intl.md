---
paths:
  - "**/*.tsx"
  - "**/i18n/**"
  - "**/messages/**"
---

# Internationalization

Scope: application code using `next-intl`.

- Use the library's server or client API in the matching rendering context.
- Use the project's locale-aware navigation helpers when configured; do not bypass locale routing with raw links or redirects.
- Add a message key to every supported locale, with the same placeholders and ICU plural/select branches.
- Keep messages organized by feature or page. Use interpolation and rich-text APIs rather than building translated sentences through concatenation.
- Format dates, numbers, and currency with the active locale; do not hard-code a locale, currency, or date format in reusable UI.
