# Guide d'estimation — vélocité agent de code

Baseline en **jours dev senior solo**, puis multiplicateur agent de code. L'agent accélère
boilerplate, scaffolding, types, migrations et CRUD cadré ; pas les allers-retours client,
le debug d'intégrations tierces, la validation légale, le design sans maquette ni les décisions d'archi.

## Multiplicateurs

| Type de tâche | Baseline solo | Mult. agent | Estim. agent |
|---------------|---------------|-------------|--------------|
| CRUD + migration DB (schéma défini) | 1 j | 0.2x | ~2h |
| UI composant / page (design fourni) | 1 j | 0.25x | ~2.5h |
| UI composant / page (design flou) | 1.5 j | 0.4x | ~3h |
| Auth + rôles (Supabase/Clerk, standard) | 3 j | 0.3x | ~1 j |
| Politiques RLS + audit sécurité | 2 j | 0.4x | ~1 j |
| Intégration API Tier 1 (SDK, bonne doc) | 1.5 j | 0.3x | ~0.5 j |
| Intégration API Tier 2 (OAuth2, webhooks) | 3 j | 0.4x | ~1.5 j |
| Intégration API Tier 3 (fragile, non documentée) | 5–8 j | 0.5x | 2.5–4 j |
| Pipeline parsing emails (Gmail API + LLM) | 5 j | 0.45x | ~2.5 j |
| Logique métier complexe (paie, planning) | 4 j | 0.35x | ~1.5 j |
| Refactor d'architecture (react-query, types) | 3 j | 0.3x | ~1 j |
| Temps réel (Supabase Realtime) | 2 j | 0.35x | ~1 j |
| Génération PDF/documents | 2 j | 0.25x | ~0.5 j |
| PWA + service worker (Workbox) | 2 j | 0.3x | ~0.5 j |
| Intégration agent IA (API LLM + tools) | 4 j | 0.4x | ~1.5 j |
| Tests unitaires/intégration d'un module | 1 j | 0.25x | ~2h |
| Déploiement + CI/CD | 1.5 j | 0.3x | ~0.5 j |

## Buffers de risque (sur l'estimation agent)

| Ambiguïté | Buffer |
|-----------|--------|
| LOW — spec complète, validée client | +0 % |
| MEDIUM — décisions en attente, périmètre clair | +25 % |
| HIGH — décisions clés ouvertes, dépendance externe incertaine | +50 % |
| UNKNOWN — « on verra en avançant » | +100 % (chiffrer en fourchette) |

## Setup & tooling (une fois par projet, à la carte)

| Poste | Baseline solo | Mult. agent | Estim. agent | Notes |
|-------|---------------|-------------|--------------|-------|
| **Biome** (lint + format) | 0.5 j | 0.2x | ~1h | Config + check CI |
| **Knip** (dead code) | 0.5 j | 0.2x | ~1h | En CI, rapport dans la PR |
| **Lefthook** (pre-commit : biome + knip + type-check) | 0.5 j | 0.2x | ~1h | Bloque les commits dégradants |
| **AGENTS.md** (instructions projet) | 0.25 j | 0.2x | ~30min | Conventions, chemins, règles métier |
| **Rules agent** (par domaine, path-scoped) | 0.5 j | 0.25x | ~1h | API, auth, DB, front |
| **Docs autres agents** (CLAUDE.md, Cursor, Copilot) | 0.5 j | 0.25x | ~1h | Si plusieurs agents en parallèle |
| **Tracker — Plane** | 0.5 j | 0.3x | ~1h | Workspace + projet + labels |
| **GlitchTip** (erreurs JS + edge functions) | 1 j | 0.3x | ~2h | SDK Sentry-compatible |
| **Uptime Kuma** | 0.5 j | 0.25x | ~1h | Sur VPS existant |
| **CI/CD** (lint + type-check + deploy) | 1.5 j | 0.3x | ~0.5 j | Hook Coolify ou VPS direct |

Packs : setup complet M1 (Biome + Knip + Lefthook + AGENTS.md + rules) ≈ **~4.5h** ·
monitoring (GlitchTip + Uptime Kuma) ≈ **~3h** · tracker Plane ≈ **~1h**.

## Overhead projet (une fois)

| Activité | Estim. agent |
|----------|--------------|
| Audit initial + onboarding codebase | 0.5–1 j |
| Communication / revues client (par milestone) | 0.25 j |
| QA / smoke tests (par milestone) | 0.25 j |
| Déploiement, environnements, DNS | 0.5 j |
| Durcissement sécurité (RLS, env, CORS) | 0.5–1 j |

## Règles

1. Jamais un chiffre unique : fourchette réaliste – avec inconnues.
2. SIRH français, DPAE ou API gouvernementale : ×2 + 1 j.
3. « Le client s'occupe de X » : +0.5 j par dépendance client.
4. Codebase réutilisable : −20 à 40 % sur CRUD/UI mais +10 à 20 % d'audit/dette ; effet net quasi neutre sauf codebase bien structurée.
5. Milestone 1 : +20 % (M1 uniquement).
