# Feasibility Assessment Reference

## Project Setup Checklist (proposer systématiquement)

Ces éléments s'ajoutent à tout projet, indépendamment des features métier.
Les marquer MANQUANT si absents du codebase existant — les inclure dans M1.

| Poste | Obligatoire | Optionnel | Signal d'absence |
|-------|-------------|-----------|-----------------|
| **Biome** (lint + format) | ✓ | — | ESLint + Prettier présents mais pas Biome, ou aucun linter |
| **Knip** (dead code) | ✓ | — | Imports morts, exports inutilisés en prod = dette qui grossit |
| **Lefthook / git hooks** | ✓ | — | Pas de `lefthook.yml` ou `.husky/` → commits non vérifiés |
| **CLAUDE.md** | ✓ | — | Absent = Claude Code sans contexte projet, conventions non appliquées |
| **Rules `.claude/rules/`** | ✓ | — | Absent = règles métier/domaine non transmises aux agents |
| **AGENTS.md / Codex doc** | — | ✓ | Optionnel si Codex/Cursor/Copilot utilisés en parallèle |
| **Tracker (Plane)** | — | ✓ | Si tickets/milestones à partager avec le client |
| **Monitoring erreurs (GlitchTip)** | — | ✓ | Recommandé dès que l'app est en prod avec de vrais utilisateurs |
| **Uptime Kuma** | — | ✓ | Recommandé si VPS mutualisé ou SLA informel avec client |

Règle : **un projet sans Biome+Knip+hooks+CLAUDE.md est un projet sans filet** pour les itérations
rapides avec Claude Code. Les inclure dans le premier milestone, coût ~4.5h CC.

## Stack Risk Signals

| Signal | Risk | Action |
|--------|------|--------|
| Generated code (Lovable, v0, Bolt) | HIGH — patterns often wrong, types loose, dead code | Audit before extending; budget refactor time |
| Missing tests on business logic | HIGH for financial/payroll features | Block on test coverage before adding complexity |
| react-query/SWR installed but unused | MEDIUM | Migrate before adding new data features (else 2 codebaths) |
| Hand-rolled auth (not Supabase/Auth.js/Clerk) | HIGH | Replace before adding roles |
| `any` casts > 20 in non-generated files | MEDIUM | Type debt compounds with new features |
| No RLS / client-only gating | BLOCKER for multi-tenant or role-sensitive data | Must fix before adding features that rely on permissions |
| Supabase anon key in client + no RLS | BLOCKER | Direct DB exposure |
| In-memory cache in edge function (serverless) | MEDIUM | Cache evicts on cold start; not reliable |
| `verify_jwt = false` on privileged edge functions | HIGH | Only acceptable if function does own auth |
| `.env` not gitignored | CRITICAL | Rotate keys immediately |

## Feature Feasibility Tiers

### Tier 1 — Straightforward (low risk, well-trodden)
- CRUD on existing DB tables
- Role-based route guards (when RLS is correct)
- Email notifications via Resend/SendGrid SDK
- PDF generation (Puppeteer/react-pdf)
- File upload/storage (Supabase Storage, S3)
- PWA offline (vite-plugin-pwa + Workbox, well-defined scope)
- Webhook receiver (parse + store + trigger action)

### Tier 2 — Medium complexity (plan carefully)
- Bidirectional Google Calendar sync (OAuth2, event delta, conflict resolution)
- Invoice generation + external accounting API (PennyLine, Pennylane, QuickBooks)
- Email parsing for intent detection (IMAP/Gmail API + heuristic or LLM)
- Real-time notifications (Supabase Realtime or Pusher)
- Multi-step approval workflows (state machine, edge cases)
- Multi-tenant with row-level isolation (requires RLS redesign)
- Mobile native push badges (requires SW + VAPID or native wrapper)

### Tier 3 — Complex / High risk (scope carefully, quote separately)
- AI agent with tool-use and side effects (CRUD, emails, assignments)
- ERP/SIRH API integration (TiimeRH, Silae, ADP) — often fragile, partial docs
- Automated DPAE submission (requires certified connector or scraping)
- Contract/invoice legal compliance across jurisdictions
- Real-time multiplayer planning (drag-drop with conflict resolution, optimistic UI)
- Email OAuth2 parsing pipeline (Gmail API + Gmail watch + Pub/Sub)

## Integration Complexity Signals

| Integration type | Typical complexity | Key risks |
|-----------------|--------------------|-----------|
| Supabase SDK direct | Simple | Version drift |
| REST API with API key | Simple–Medium | Rate limits, error handling |
| OAuth2 (Google, Microsoft) | Medium | Token refresh, scope changes, revocation |
| Webhooks (inbound) | Medium | Idempotency, retry handling, signature verification |
| Email inbox parsing | Hard | OAuth2 + watch subscription + payload parsing + spam/noise |
| French HR software API (SIRH) | Hard | Partial docs, auth instability, legal fields required |
| Government/legal APIs (DPAE, DSN) | Very Hard | Certification requirements, EDI format, compliance |
| WhatsApp Business API | Medium | Meta approval, template restrictions |

## Rewrite vs Extend Decision Rule

Extend if:
- Core DB schema is sound (correct tables, relations, RLS fixable)
- Business logic is correct, just un-tested
- UI is mostly working, needs polish not replacement
- The existing stack matches the target stack

Rewrite if:
- Generated code has no type safety + no tests + wrong architecture throughout
- Schema has fundamental design flaws (e.g. wrong normalization, no FK constraints)
- The client wants to change the primary stack (e.g. to Next.js SSR)
- Security holes are structural (e.g. service role key on client)

**Rule of thumb:** if extending requires touching >60% of files, it's a rewrite.
