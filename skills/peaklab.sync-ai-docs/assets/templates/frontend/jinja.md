---
paths:
  - "**/templates/**"
  - "**/*.html"
  - "**/*.jinja"
  - "**/*.jinja2"
---

# Jinja templates

Scope: template files using Jinja.

- Keep autoescaping enabled for HTML templates. Never mark untrusted content safe; sanitize and document any intentionally rendered HTML.
- Use the framework's route helper for application URLs rather than duplicating route strings.
- Prefer shared layouts, includes, and named blocks where the application has common chrome.
- Keep authorization, database access, and business decisions in application code. Small display conditions and loops are appropriate in templates.
- Escape or encode values for their output context (HTML, URL, JavaScript, or CSS); HTML escaping alone does not make arbitrary URLs or scripts safe.
