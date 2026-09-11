# Time Estimation Guide — Claude Code Velocity

## Core principle

Estimates here use **solo senior developer days** as baseline, then apply a Claude Code
multiplier. The multiplier reflects real observed speedups: Claude Code handles boilerplate,
scaffolding, type generation, migrations, and well-defined CRUD at 3-5x speed.
It does NOT eliminate: client feedback loops, integration debugging, decision-making, QA.

## Multiplier table

| Task type | Solo dev baseline | Claude Code multiplier | Claude Code estimate |
|-----------|------------------|----------------------|---------------------|
| CRUD + DB migration (well-defined schema) | 1 day | 0.2x | ~2h |
| UI component / page (design provided) | 1 day | 0.25x | ~2.5h |
| UI component / page (design unclear) | 1.5 day | 0.4x | ~3h |
| Auth + roles (Supabase/Clerk, standard) | 3 days | 0.3x | ~1 day |
| RLS policies + security audit | 2 days | 0.4x | ~1 day |
| API integration (Tier 1 — SDK, good docs) | 1.5 days | 0.3x | ~half day |
| API integration (Tier 2 — OAuth2, webhooks) | 3 days | 0.4x | ~1.5 days |
| API integration (Tier 3 — fragile/undocumented) | 5–8 days | 0.5x | 2.5–4 days |
| Email parsing pipeline (Gmail API + LLM) | 5 days | 0.45x | ~2.5 days |
| Complex business logic (payroll, scheduling) | 4 days | 0.35x | ~1.5 days |
| Architecture refactor (react-query, types) | 3 days | 0.3x | ~1 day |
| Real-time features (Supabase Realtime) | 2 days | 0.35x | ~1 day |
| PDF/document generation | 2 days | 0.25x | ~0.5 day |
| PWA + service worker (Workbox) | 2 days | 0.3x | ~0.5 day |
| AI agent integration (Claude API + tools) | 4 days | 0.4x | ~1.5 days |
| Unit/integration tests for a module | 1 day | 0.25x | ~2h |
| Deployment + CI/CD setup | 1.5 days | 0.3x | ~half day |

## Risk buffers (add to Claude Code estimate)

| Ambiguity level | Buffer |
|-----------------|--------|
| LOW — spec is complete, client approved | +0% |
| MEDIUM — some decisions pending, but scope clear | +25% |
| HIGH — key decisions unresolved, external dep uncertain | +50% |
| UNKNOWN — "let's figure it out as we go" | +100% (quote as range) |

## Project setup & tooling (add once per project, à la carte)

Ces éléments sont indépendants des features métier. Les proposer systématiquement au client
comme options de base avant le premier milestone.

| Poste | Solo baseline | CC mult | Estim. CC | Notes |
|-------|--------------|---------|-----------|-------|
| **Linting — Biome** (remplace ESLint+Prettier, plus rapide) | 0.5j | 0.2x | ~1h | Inclut config + CI check |
| **Dead code — Knip** (détection imports/exports inutilisés) | 0.5j | 0.2x | ~1h | Run en CI, rapport dans PR |
| **Git hooks — Lefthook** (pre-commit : biome + knip + type-check) | 0.5j | 0.2x | ~1h | Bloque les commits dégradants |
| **CLAUDE.md** (instructions projet pour Claude Code) | 0.25j | 0.2x | ~30min | Conventions, chemins, règles métier |
| **Rules Claude Code** (`.claude/rules/*.md` par domaine) | 0.5j | 0.25x | ~1h | API, auth, DB, front — path-scoped |
| **Codex / AI docs** (AGENTS.md ou contexte LLM global) | 0.5j | 0.25x | ~1h | Règles pour Codex, Cursor, Copilot |
| **Tracker — Plane** (workspace + projet + labels) | 0.5j | 0.3x | ~1h | Via API Plane ou setup manuel |
| **Monitoring — GlitchTip** (erreurs JS + edge functions) | 1j | 0.3x | ~2h | SDK Sentry-compatible, self-host OK |
| **Monitoring — Uptime Kuma** (disponibilité, alertes) | 0.5j | 0.25x | ~1h | Config sur VPS existant |
| **CI/CD** (GitHub Actions : lint + type-check + deploy) | 1.5j | 0.3x | ~half day | Coolify deploy hook ou VPS direct |

**Package setup complet (recommandé M1) :** Biome + Knip + Lefthook + CLAUDE.md + rules ≈ **~4.5h CC**
**Monitoring complet (optionnel M1) :** GlitchTip + Uptime Kuma ≈ **~3h CC**
**Tracker :** Plane ≈ **~1h CC**

## Project overhead (add once per project, not per feature)

| Activity | Claude Code estimate |
|----------|---------------------|
| Initial codebase audit + onboarding | 0.5–1 day |
| Client communication / reviews (per milestone) | 0.25 day |
| QA / smoke testing per milestone | 0.25 day |
| Deploy, environment setup, DNS | 0.5 day |
| Security hardening pass (RLS, env, CORS) | 0.5–1 day |

## Estimation rules

1. **Never estimate a single number.** Always give low–high (realistic–with-unknowns).
2. Anything involving a French SIRH, DPAE, or government API: multiply by 2 and add 1 day.
3. "The client will handle X" is a risk: add 0.5 day buffer per external dependency on client.
4. An existing codebase to reuse saves 20-40% on CRUD/UI — but costs 10-20% on audit/debt
   navigation. Net effect: roughly neutral unless codebase is well-structured.
5. Milestone 1 always takes longer than estimated (unknown unknowns): add 20% to M1 only.

## Sample breakdown format

```
| Feature | Solo baseline | CC mult | Base est. | Buffer | Total |
|---------|--------------|---------|-----------|--------|-------|
| hourly_rate protection (RLS) | 0.5d | 0.4x | 2h | LOW +0% | 2h |
| Client list RLS fix | 0.5d | 0.3x | 1.5h | LOW +0% | 1.5h |
| Devis module (CRUD + Supabase) | 3d | 0.25x | 0.75d | MED +25% | ~1d |
| ...etc |

**Project total:**
- Optimistic (all LOW buffer): Xd
- Realistic (MEDIUM buffers): Xd
- With unknowns (HIGH ambiguity items resolve badly): Xd

Key assumptions:
1. ...
2. ...
3. ...
```

## Claude Code velocity caveats

These multipliers DO apply to:
- Implementation of well-scoped, well-typed features
- Refactoring with clear before/after target
- Generating migrations, tests, types from schema
- Scaffolding new modules from existing patterns in the codebase

These multipliers DO NOT apply to:
- Waiting for client feedback or approvals
- Debugging third-party integration failures (rate limits, flaky APIs)
- Legal/compliance validation (DPAE certification, invoice legal requirements)
- Design work (UX decisions, component design without Figma)
- Architectural decisions requiring consensus
