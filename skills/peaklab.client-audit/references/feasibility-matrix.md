# Matrice de faisabilité

Postes setup absents (Biome, Knip, Lefthook, `AGENTS.md`, rules agent) : toujours proposés en M1 ;
coûts dans le [guide d'estimation](time-estimation-guide.md).

## Signaux de risque stack

| Signal | Risque | Action |
|--------|--------|--------|
| Code généré (Lovable, v0, Bolt) | HIGH | Auditer avant d'étendre ; budgéter un refactor |
| Pas de tests sur la logique métier | HIGH (finance/paie) | Couvrir avant d'ajouter de la complexité |
| react-query/SWR installé mais inutilisé | MEDIUM | Migrer avant les nouvelles features data |
| Auth maison (pas Supabase/Auth.js/Clerk) | HIGH | Remplacer avant d'ajouter des rôles |
| > 20 casts `any` hors code généré | MEDIUM | Dette de typage qui se compose |
| Pas de RLS / gating client seul | BLOQUANT si multi-tenant ou rôles | Corriger avant toute feature à permissions |
| Clé anon Supabase côté client sans RLS | BLOQUANT | Exposition directe de la DB |
| Cache mémoire en edge function | MEDIUM | Perdu à chaque cold start |
| `verify_jwt = false` sur edge function privilégiée | HIGH | Acceptable seulement avec auth propre |
| `.env` non gitignoré | CRITIQUE | Rotation des clés immédiate |

## Tiers de faisabilité

- **Tier 1 — simple** : CRUD sur tables existantes, guards de rôles (RLS correcte), emails Resend/SendGrid, PDF, upload/storage, PWA offline cadrée, réception de webhooks.
- **Tier 2 — à planifier** : sync Google Calendar bidirectionnelle, facturation + API comptable (Pennylane, QuickBooks), parsing d'emails, temps réel, workflows d'approbation, multi-tenant (refonte RLS), push mobile.
- **Tier 3 — à chiffrer à part** : agent IA avec effets de bord, API ERP/SIRH (TiimeRH, Silae, ADP), DPAE automatisée, conformité contrats/factures multi-juridictions, planning multijoueur temps réel, pipeline Gmail OAuth2 + watch + Pub/Sub.

## Intégrations à part

Very Hard : API gouvernementales (DPAE, DSN — certification, EDI). Hard : SIRH français (docs partielles, auth instable),
parsing de boîte mail. Medium : OAuth2, webhooks entrants, WhatsApp Business (validation Meta).

## Étendre ou réécrire

Étendre si schéma sain, logique métier correcte (même non testée), UI globalement fonctionnelle et stack cible identique.
Réécrire si code généré sans typage ni tests ni bonne archi, schéma fondamentalement faux, changement de stack demandé, ou failles de sécurité structurelles.
Règle : si étendre touche > 60 % des fichiers, c'est une réécriture.
