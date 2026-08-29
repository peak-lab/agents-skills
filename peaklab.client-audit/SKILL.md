---
name: peaklab.client-audit
description: Use when auditing a client project before quoting or starting work, estimating feasibility, detecting blockers and ambiguities, checking stack compatibility, or producing a Codex-adjusted time estimate from a transcript or codebase.
effort: deep
argument-hint: "[chemin transcript/requirements] [chemin codebase (optionnel)]"
---

<objective>
Audit de faisabilité et de cadrage — PAS un code review qualité.

Répondre à trois questions avant de commencer :
1. Peut-on construire ce que le client veut, avec ce qu'il a, comme il l'imagine ?
2. Qu'est-ce qui va nous surprendre (ambiguïtés, blockers, complexité d'intégration) ?
3. Combien de temps ça prend réellement, avec la vélocité Codex ?

L'output sert à préparer un devis ou un premier milestone.
</objective>

<input-resolution>
Déterminer ce qui est disponible avant de lancer les agents :

| Source | Où chercher |
|--------|-------------|
| Transcript client / chat | Fichiers `.txt`/`.md` dans le projet (ex: `*-chat.txt`) |
| Codebase existante | `package.json`, fichiers src clés, migrations DB, structure env |
| Liste de features | Extraire du transcript — lister explicitement |
| Figma / wireframes | Seulement si l'utilisateur fournit un chemin ou URL |

Si ni codebase ni transcript → demander à l'utilisateur avant de continuer.
</input-resolution>

<workflow>
## Phase 0 : SETUP CHECK — détecter l'infrastructure projet

Avant de lire le transcript, exécuter ces commandes bash dans le répertoire codebase.
Si pas de codebase fourni, passer directement à Phase 1 (tous les postes = INCONNU).

```bash
CODEBASE="{codebase_path}"
cd "$CODEBASE"

echo "=== LINTER ==="
[ -f biome.json ] || [ -f biome.jsonc ] && echo "Biome: PRÉSENT" || echo "Biome: ABSENT"
grep -q '"@biomejs/biome"' package.json 2>/dev/null && echo "Biome dep: OUI" || echo "Biome dep: NON"
[ -f .eslintrc* ] || [ -f eslint.config* ] && echo "ESLint: PRÉSENT" || echo "ESLint: ABSENT"

echo "=== DEAD CODE ==="
[ -f knip.json ] || [ -f knip.jsonc ] || [ -f .knip.json ] && echo "Knip config: PRÉSENT" || echo "Knip config: ABSENT"
grep -q '"knip"' package.json 2>/dev/null && echo "Knip dep: OUI" || echo "Knip dep: NON"

echo "=== GIT HOOKS ==="
[ -f lefthook.yml ] || [ -f lefthook.yaml ] && echo "Lefthook: PRÉSENT" || echo "Lefthook: ABSENT"
[ -d .husky ] && echo "Husky: PRÉSENT" || echo "Husky: ABSENT"
grep -q '"lefthook"\|"husky"' package.json 2>/dev/null && echo "Hook dep: OUI" || echo "Hook dep: NON"

echo "=== Codex ==="
[ -f AGENTS.md ] && echo "AGENTS.md: PRÉSENT" || echo "AGENTS.md: ABSENT"
[ -d .codex/rules ] && ls .codex/rules/*.md 2>/dev/null | wc -l | xargs -I{} echo "Rules: {} fichier(s)" || echo "Rules: ABSENT"

echo "=== AI DOCS ==="
[ -f AGENTS.md ] && echo "AGENTS.md: PRÉSENT" || echo "AGENTS.md: ABSENT"
[ -f .cursorrules ] || [ -f .cursor/rules ] && echo "Cursor rules: PRÉSENT" || echo "Cursor rules: ABSENT"

echo "=== MONITORING ==="
grep -rq '@sentry/\|glitchtip\|@glitchtip' package.json 2>/dev/null && echo "Error monitoring dep: OUI" || echo "Error monitoring dep: NON"
grep -rq 'Sentry.init\|GlitchTip' src/ 2>/dev/null && echo "Error monitoring init: OUI" || echo "Error monitoring init: NON"

echo "=== TRACKER ==="
[ -f .plane* ] || [ -f plane.config* ] && echo "Plane config: PRÉSENT" || echo "Plane config: ABSENT"
grep -q 'PLANE_TOKEN\|LINEAR_API' .env* 2>/dev/null && echo "Tracker env: PRÉSENT" || echo "Tracker env: ABSENT"

echo "=== CI/CD ==="
[ -d .github/workflows ] && ls .github/workflows/*.yml 2>/dev/null | wc -l | xargs -I{} echo "GitHub Actions: {} workflow(s)" || echo "GitHub Actions: ABSENT"
[ -f .gitlab-ci.yml ] && echo "GitLab CI: PRÉSENT" || echo "GitLab CI: ABSENT"
```

Construire la variable `setup_missing_list` depuis la sortie :
```
Biome: ABSENT | Knip: ABSENT | Lefthook: ABSENT | AGENTS.md: ABSENT |
Rules CC: ABSENT | AGENTS.md: ABSENT | Error monitoring: NON | Tracker: ABSENT | CI: ABSENT
```
Cette variable sera injectée telle quelle dans le prompt du Subagent C.

## Phase 1 : EXTRACT — construire la feature matrix

Lire tout le contexte disponible (transcript + codebase). Produire **en interne** :

- **État actuel** — ce qui existe et fonctionne aujourd'hui
- **Features souhaitées** — liste numérotée extraite des mots du client (verbatim si possible)
- **Intégrations demandées** — APIs externes, webhooks, outils à connecter
- **Contraintes** — budget mentionné, deadline, non-négociables
- **Rôles / utilisateurs** — qui utilise le système, niveaux d'accès
- **Stack détecté** — technologies identifiées dans le codebase
- **Setup manquant** — résultat de Phase 0 (PRÉSENT / ABSENT par poste)

## Phase 2 : DISPATCH — lancer 3 subagents en parallèle

**RÈGLE CRITIQUE : envoyer les 3 appels `Agent` dans un SEUL message.**
Ne pas attendre le résultat du premier avant de lancer les autres.
Chaque agent est autonome — il ne communique pas avec les deux autres.

```
subagent_type: "general-purpose"
effort: "deep"
```

Avant de lancer : substituer toutes les variables `{...}` par le contenu réel extrait en Phase 1.
Ne jamais envoyer des placeholders non résolus aux agents.

---
### Subagent A — Faisabilité & Stack (`audit-feasibility`)

```
Tu es un consultant tech senior qui audite la faisabilité d'un projet client.

Charge et lis entièrement ce fichier de référence AVANT de répondre :
~/.agents/skills/peaklab.client-audit/references/feasibility-matrix.md

Stack détecté : {detected_stack}
Features souhaitées (numérotées) :
{extracted_feature_list}

Intégrations demandées : {integrations}
Code existant : {summary_of_existing_code — ou "aucun codebase fourni"}

Évalue chaque feature pour :
1. FAISABILITÉ avec le stack actuel — peut-on l'implémenter sans réécriture complète ?
2. RISQUES STACK — désalignements, libs dépréciées, limites scaling, vendor lock-in
3. COMPLEXITÉ INTÉGRATION — noter chaque intégration externe :
   SIMPLE (SDK officiel, bien documenté) |
   MEDIUM (OAuth2, webhooks, parsing) |
   HARD (API non officielle, scraping fragile, docs manquantes)
4. RÉUTILISER vs RÉÉCRIRE — pour chaque module majeur, est-il plus rapide de garder ou refaire ?

Signaler UNIQUEMENT les problèmes majeurs (bloquants ou haut risque).
Ne pas noter la qualité du code ni les détails mineurs.

Output : une table par section. Maximum 600 mots.
```

---
### Subagent B — Ambiguïtés & Risques (`audit-ambiguities`)

```
Tu es un consultant de cadrage projet. Ta mission : trouver ce qui est MANQUANT,
FLOU ou DANGEREUX dans la demande du client — avant que le développement commence.

Charge et lis entièrement ce fichier de référence AVANT de répondre :
~/.agents/skills/peaklab.client-audit/references/ambiguity-risk-checklist.md

Contenu du transcript / features souhaitées :
{transcript_content — coller le contenu réel, pas un chemin}

Stack : {detected_stack}

Identifier et catégoriser :
1. AMBIGUÏTÉS — features décrites vaguement qui nécessitent une décision client avant de coder
2. VECTEURS DE SCOPE CREEP — features qui semblent petites mais cachent de la complexité
3. BLOQUEURS DE DÉPENDANCE — features qui ne peuvent pas être construites avant une autre
4. CONFORMITÉ / LÉGAL — PII, facturation, droit du travail, RGPD, DPAE si contexte FR
5. PIÈGES PERFORMANCE — patterns qui fonctionnent à 100 users mais cassent à 1000

Pour chaque item : description (1 phrase) + impact (1 phrase) + question à poser au client.
Maximum 500 mots.
```

---
### Subagent C — Estimation de temps (`audit-estimation`)

```
Tu estimes le temps de développement d'un projet client.
Le développeur utilise Codex, ce qui accélère significativement l'implémentation.

Charge et lis entièrement ce fichier de référence AVANT de répondre :
~/.agents/skills/peaklab.client-audit/references/time-estimation-guide.md

Features métier à estimer (numérotées) :
{extracted_feature_list}

Setup tooling manquant (ABSENT = à inclure dans l'estimation) :
{setup_missing_list — ex: "Biome: ABSENT, Knip: ABSENT, Lefthook: ABSENT, AGENTS.md: ABSENT, GlitchTip: ABSENT"}

Code existant réutilisable : {summary_of_what_exists — ou "aucun"}
Stack : {detected_stack}
Intégrations demandées : {integrations}

Pour chaque feature / module ET pour chaque poste setup manquant :
1. Estimer en "jours dev senior solo" comme baseline
2. Appliquer le multiplicateur Codex du fichier de référence
   (typiquement 0.25–0.35x pour features bien cadrées, 0.5x pour archi/intégration)
3. Ajouter un buffer de risque selon le niveau d'ambiguïté (faible/moyen/élevé)

Le setup tooling (Biome, Knip, hooks, AGENTS.md, rules, monitoring) a ses propres
lignes dans la table — regroupe-les dans une section "Setup & Infrastructure".

Produire :
- Table features métier : Feature | Baseline solo (j) | Mult. CC | Estimation CC | Buffer | Total
- Table setup/infra : Poste | Estimation CC | Obligatoire/Optionnel
- Fourchette projet : optimiste / réaliste / avec inconnues (les deux tables combinées)
- Les 3 hypothèses principales dont dépend l'estimation

Maximum 600 mots. Être précis — pas de "ça dépend" sans fourchette chiffrée.
```

## Phase 3 : CONSOLIDATE — rapport d'audit final

Attendre les 3 résultats, puis fusionner en un seul rapport structuré.
Dédupliquer les findings qui apparaissent dans plusieurs agents (garder le plus détaillé).
Trier par sévérité : **BLOQUANT → RISQUE → CLARIFIER**.

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
{liste numérotée : ambiguïté + impact + question à poser}

## Risques & Bloqueurs majeurs
{liste bullet, uniquement les majeurs}

## Setup & Infrastructure (M1 recommandé)
| Poste | Estimation CC | Statut | Inclure dans M1 ? |
|-------|--------------|--------|-------------------|
| Biome (lint+format) | ~1h | ABSENT/PRÉSENT | Oui si absent |
| Knip (dead code) | ~1h | ABSENT/PRÉSENT | Oui si absent |
| Lefthook (git hooks) | ~1h | ABSENT/PRÉSENT | Oui si absent |
| AGENTS.md + rules | ~1.5h | ABSENT/PRÉSENT | Oui si absent |
| AGENTS.md / Codex | ~1h | ABSENT/PRÉSENT | Optionnel |
| Tracker (Plane) | ~1h | N/A | Optionnel |
| GlitchTip (erreurs) | ~2h | ABSENT/PRÉSENT | Optionnel |
| Uptime Kuma | ~1h | ABSENT/PRÉSENT | Optionnel |

## Estimation de temps (vélocité Codex)
{table features métier depuis Subagent C + fourchette totale}

## Verdict
{3–5 bullets : peut-on démarrer tel quel / que clarifier d'abord /
milestone 1 recommandé / périmètre exclu}
```

Labels de sévérité :
- **BLOQUANT** — à résoudre avant de démarrer
- **RISQUE** — peut démarrer, mais surveiller
- **CLARIFIER** — décision client nécessaire
</workflow>

<execution-rules>
- TOUJOURS lancer les 3 subagents dans un seul message (appels Agent simultanés)
- TOUJOURS injecter le contenu réel — zéro placeholder non résolu dans les prompts
- TOUJOURS attendre les 3 résultats avant de consolider
- Ne PAS démarrer si aucun contexte (transcript ou codebase) — demander d'abord
- Si pas de codebase : Subagent A se concentre sur la faisabilité features uniquement
- Signaler les problèmes MAJEURS uniquement — /review-code couvre la qualité de code
- Les estimations doivent être des fourchettes concrètes, jamais "ça dépend" sans chiffre
- SKILL_PATH = ~/.agents/skills/peaklab.client-audit
</execution-rules>
