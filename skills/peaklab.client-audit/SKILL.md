---
name: peaklab.client-audit
description: "Audit a client project before quoting or implementation: feasibility, blockers, stack compatibility and effort estimates."
effort: deep
argument-hint: "[chemin transcript/requirements] [chemin codebase (optionnel)]"
---

<objective>
Audit de faisabilité et de cadrage — PAS un code review qualité (`review-code` couvre la qualité).

Répondre avant de démarrer :
1. Peut-on construire ce que le client veut, avec ce qu'il a, comme il l'imagine ?
2. Qu'est-ce qui va nous surprendre (ambiguïtés, bloqueurs, intégrations) ?
3. Combien de temps, avec la vélocité d'un agent de code ?

L'output sert à préparer un devis ou un premier milestone.
</objective>

<input-resolution>
Sources : transcript client (`.txt`/`.md`, ex. `*-chat.txt`), codebase (`package.json`, src clés, migrations, env),
Figma seulement si fourni. Ni codebase ni transcript → demander avant de continuer.
</input-resolution>

<workflow>
## Phase 0 : SETUP CHECK

Sans codebase, passer en Phase 1 (tous les postes = INCONNU). Sinon, dans la codebase :

```bash
cd "{codebase_path}"

echo "=== LINTER ==="
[ -f biome.json ] || [ -f biome.jsonc ] && echo "Biome: PRÉSENT" || echo "Biome: ABSENT"
ls .eslintrc* eslint.config* >/dev/null 2>&1 && echo "ESLint: PRÉSENT" || echo "ESLint: ABSENT"

echo "=== DEAD CODE ==="
[ -f knip.json ] || [ -f knip.jsonc ] || [ -f .knip.json ] && echo "Knip config: PRÉSENT" || echo "Knip config: ABSENT"

echo "=== GIT HOOKS ==="
[ -f lefthook.yml ] || [ -f lefthook.yaml ] && echo "Lefthook: PRÉSENT" || echo "Lefthook: ABSENT"
[ -d .husky ] && echo "Husky: PRÉSENT" || echo "Husky: ABSENT"

echo "=== AI DOCS ==="
[ -f AGENTS.md ] && echo "AGENTS.md: PRÉSENT" || echo "AGENTS.md: ABSENT"
n=$(ls .agents/rules/*.md .claude/rules/*.md .cursor/rules/* 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] && echo "Rules agent: $n fichier(s)" || echo "Rules agent: ABSENT"
[ -f CLAUDE.md ] || [ -f .cursorrules ] || [ -f .github/copilot-instructions.md ] && echo "Docs autres agents: PRÉSENT" || echo "Docs autres agents: ABSENT"

echo "=== MONITORING ==="
grep -q '@sentry/\|glitchtip' package.json 2>/dev/null && echo "Error monitoring dep: OUI" || echo "Error monitoring dep: NON"
grep -rq 'Sentry.init\|GlitchTip' src/ 2>/dev/null && echo "Error monitoring init: OUI" || echo "Error monitoring init: NON"

echo "=== TRACKER ==="
ls .plane* plane.config* >/dev/null 2>&1 && echo "Plane config: PRÉSENT" || echo "Plane config: ABSENT"
grep -q 'PLANE_TOKEN\|LINEAR_API' .env* 2>/dev/null && echo "Tracker env: PRÉSENT" || echo "Tracker env: ABSENT"

echo "=== CI/CD ==="
n=$(ls .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] && echo "GitHub Actions: $n workflow(s)" || echo "GitHub Actions: ABSENT"
[ -f .gitlab-ci.yml ] && echo "GitLab CI: PRÉSENT" || echo "GitLab CI: ABSENT"
```

En déduire `setup_missing_list`, injectée telle quelle dans le Subagent C :
```
Biome: ABSENT | Knip: ABSENT | Lefthook: ABSENT | AGENTS.md: ABSENT | Rules agent: ABSENT |
Docs autres agents: ABSENT | Error monitoring: NON | Tracker: ABSENT | CI: ABSENT
```

## Phase 1 : EXTRACT — feature matrix (interne)

État actuel · features souhaitées (liste numérotée, verbatim client si possible) · intégrations ·
contraintes (budget, deadline, non-négociables) · rôles/utilisateurs · stack détecté · setup manquant (Phase 0).

## Phase 2 : DISPATCH — 3 subagents en parallèle

Envoyer les 3 appels `Agent` dans un SEUL message (`subagent_type: "general-purpose"`, `effort: "deep"`).
Substituer toutes les variables `{...}` par le contenu réel de la Phase 1 — jamais de placeholder.

### Subagent A — Faisabilité & Stack (`audit-feasibility`)

```
Lis d'abord la [matrice de faisabilité](references/feasibility-matrix.md).

Stack détecté : {detected_stack}
Features souhaitées : {extracted_feature_list}
Intégrations : {integrations}
Code existant : {summary_of_existing_code — ou "aucun codebase fourni"}

Pour chaque feature :
1. FAISABILITÉ avec le stack actuel, sans réécriture complète ?
2. RISQUES STACK — désalignements, libs dépréciées, scaling, lock-in
3. COMPLEXITÉ INTÉGRATION : SIMPLE (SDK officiel) | MEDIUM (OAuth2, webhooks, parsing) |
   HARD (API non officielle, scraping, docs manquantes)
4. RÉUTILISER vs RÉÉCRIRE pour chaque module majeur

Bloquants et haut risque uniquement. Une table par section, 600 mots max.
```

### Subagent B — Ambiguïtés & Risques (`audit-ambiguities`)

```
Trouve ce qui est MANQUANT, FLOU ou DANGEREUX dans la demande client.
Lis d'abord la [checklist ambiguïtés et risques](references/ambiguity-risk-checklist.md).

Transcript / features : {transcript_content — contenu réel, pas un chemin}
Stack : {detected_stack}

Catégories : AMBIGUÏTÉS (décision client requise) · SCOPE CREEP · BLOQUEURS DE DÉPENDANCE ·
CONFORMITÉ / LÉGAL (RGPD, facturation, droit du travail, DPAE si FR) · PIÈGES PERFORMANCE (100 → 1000 users).

Par item : description (1 phrase) + impact (1 phrase) + question à poser au client. 500 mots max.
```

### Subagent C — Estimation (`audit-estimation`)

```
Estime le temps de dev d'un projet client réalisé avec un agent de code.
Lis d'abord le [guide d'estimation](references/time-estimation-guide.md).

Features métier : {extracted_feature_list}
Setup manquant (ABSENT = à estimer) : {setup_missing_list}
Code réutilisable : {summary_of_what_exists — ou "aucun"}
Stack : {detected_stack}
Intégrations : {integrations}

Pour chaque feature ET chaque poste setup manquant : baseline "jours dev senior solo",
multiplicateur agent du guide, buffer selon l'ambiguïté.

Produire :
- Table features : Feature | Baseline solo (j) | Mult. agent | Estim. agent | Buffer | Total
- Table "Setup & Infrastructure" : Poste | Estim. agent | Obligatoire/Optionnel
- Fourchette projet : optimiste / réaliste / avec inconnues (tables combinées)
- Les 3 hypothèses principales
600 mots max. Jamais "ça dépend" sans fourchette chiffrée.
```

## Phase 3 : CONSOLIDATE — rapport final

Attendre les 3 résultats, dédupliquer (garder le plus détaillé), trier **BLOQUANT → RISQUE → CLARIFIER** :
- **BLOQUANT** — à résoudre avant de démarrer
- **RISQUE** — peut démarrer, à surveiller
- **CLARIFIER** — décision client nécessaire

```markdown
# Audit Client — {nom du projet}

## État actuel
{ce qui existe et fonctionne}

## Features souhaitées (extraites)
{liste numérotée, termes du client}

## Faisabilité
| Feature | Verdict | Risque | Remarque |
|---------|---------|--------|----------|

## Stack & Intégrations
{depuis Subagent A}

## Ambiguïtés — Questions pour le client
{liste numérotée : ambiguïté + impact + question}

## Risques & Bloqueurs majeurs
{bullets, majeurs uniquement}

## Setup & Infrastructure (M1 recommandé)
| Poste | Estim. agent | Statut | Inclure dans M1 ? |
|-------|--------------|--------|-------------------|
| Biome (lint+format) | ~1h | ABSENT/PRÉSENT | Oui si absent |
| Knip (dead code) | ~1h | ABSENT/PRÉSENT | Oui si absent |
| Lefthook (git hooks) | ~1h | ABSENT/PRÉSENT | Oui si absent |
| AGENTS.md + rules agent | ~1.5h | ABSENT/PRÉSENT | Oui si absent |
| Docs autres agents (CLAUDE.md, Cursor, Copilot) | ~1h | ABSENT/PRÉSENT | Optionnel |
| Tracker (Plane) | ~1h | N/A | Optionnel |
| GlitchTip (erreurs) | ~2h | ABSENT/PRÉSENT | Optionnel |
| Uptime Kuma | ~1h | ABSENT/PRÉSENT | Optionnel |

## Estimation de temps (vélocité agent de code)
{table features depuis Subagent C + fourchette totale}

## Verdict
{3–5 bullets : démarrer tel quel ? / à clarifier d'abord / milestone 1 recommandé / périmètre exclu}
```
</workflow>

<execution-rules>
- Sans codebase, le Subagent A ne juge que la faisabilité des features.
- Problèmes MAJEURS uniquement ; la qualité de code relève de `review-code`.
- Résoudre les références relativement au répertoire de ce skill installé, jamais via un chemin home supposé.
</execution-rules>
