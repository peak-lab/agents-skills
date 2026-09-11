---
paths:
  - "**/components/**"
  - "**/*.tsx"
---

# shadcn/ui

Scope: projects that use shadcn/ui components.

- Treat generated components as application-owned source. Customize the local component or its documented variants, not a package copy.
- Respect the project's configured aliases, component location, and class-merging utility; do not assume a particular `src/` layout.
- Extend recurring component states through typed variants or component props instead of ad-hoc overrides at every call site.
- Preserve the component's semantic HTML, keyboard interaction, focus handling, labels, and accessible names when customizing it.
- Keep theme tokens centralized in the project stylesheet and use the existing token convention.
