---
paths:
  - "**/*.css"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Tailwind CSS

Scope: styles in a Tailwind project.

- Follow the installed Tailwind version and the project's established configuration style.
- In Tailwind v4, define utility-generating design tokens with top-level `@theme` variables; use ordinary CSS custom properties when no utility is needed.
- Keep utility names complete and statically detectable; map variants to full class strings instead of interpolating fragments. Use CSS custom properties for runtime values and the installed version's source-registration mechanism when required files are outside automatic detection.
- Reuse semantic project tokens for product colors, typography, spacing, and states when they exist. One-off values are acceptable when they express a genuinely local design decision.
- Preserve accessible contrast, visible focus indicators, responsive behavior, and motion preferences when composing utilities.
- Avoid scattering repeated class recipes: extract a component, variant, or shared style only after repetition makes that clearer.
