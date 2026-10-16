---
name: find-docs
description: "Look up authoritative documentation when library, framework, API or tool behavior requires current or version-specific verification."
effort: standard
---

# Documentation Lookup

## Tool precedence

1. Context7 through an installed `ctx7` CLI.
2. Otherwise Context7 without a global installation: `npx ctx7@latest <command>`.
3. If Context7 is unavailable, has no suitable library, or still fails after 3 attempts, consult the library's official documentation and state that fallback. Do not silently fall back from Context7.

Do not run Context7 commands more than 3 times per question.

## Workflow

```bash
ctx7 library <name> "<query>"   # resolve the library ID
ctx7 docs <libraryId> "<query>" # query its documentation
```

- Call `ctx7 library` first unless the user supplies an ID as `/org/project` or `/org/project/version`. IDs keep the leading `/`.
- Always pass a query built from the user's full intent; it drives ranking and disambiguation. One-word queries return generic results.
- Never put API keys, passwords, credentials, personal data or proprietary code in a query.
- Pick the result by name match, intent relevance, snippet count, source reputation (High/Medium) and benchmark score. If several fit, say so and use the best; if none fit, say so and suggest a refined query; if the request is ambiguous, ask before guessing.
- When the user names a version, use the closest version-specific ID listed by `ctx7 library` (for example `/vercel/next.js/v14.3.0-canary.87`).

## Current versions

Never assert a latest, current or supported version from memory. Verify it from a primary source (official docs, release notes, registry or changelog) and cite it.

## Authentication and quota

Context7 works without authentication; `CONTEXT7_API_KEY` or `ctx7 login` raises rate limits. On a quota error ("Monthly quota reached", "quota exceeded"), tell the user their Context7 quota is exhausted, suggest `ctx7 login`, and if they decline, use the official documentation and identify it as the fallback.
