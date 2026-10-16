# Checklist ambiguïtés et risques

## Questions récurrentes à faire trancher

- Sync / « mettre à jour X quand Y change » : déclencheur, sens, arbitrage des conflits, suppressions, échecs.
- Emails, agenda, logiciel existant : credentials, OAuth2 validé, sandbox, API publique ou export CSV.
- Documents légaux (contrat, facture) : template, relecture juridique, format FR.
- Paie / heures : CCN, nuit, fériés, temps partiel. Approbations : qui, délégation, délai.

## Scope creep typique

Emails → devis (OAuth2 + watch + parsing + bruit) · planning drag & drop (conflits, multijoueur, undo) ·
contrats auto (signature, validité légale) · push (VAPID, iOS) · reporting (définir chaque métrique) ·
multi-agence (isolation, facturation par tenant) · import CSV (doublons, rollback) · pointage GPS (batterie, légal).

## Chaînes de dépendance

Auth/rôles → tout ce qui dépend de l'identité · RLS → lecture de données d'autrui · schéma + migrations → toute nouvelle donnée ·
devis → facture · données clients/missions → heures, planning, facturation · OAuth Google → sync agenda · credentials + sandbox Pennylane → facturation auto.

## Conformité (contexte FR)

- **DPAE** à l'URSSAF avant chaque début de mission ; automatisation = prestataire certifié ou accès API URSSAF.
- **Contrats de mission** : clauses obligatoires (CCN, motif, durée, poste, taux) ; template relu par un avocat.
- **Relevés d'heures** cohérents avec les feuilles signées pour la facturation.
- **Factures** : SIRET, TVA, conditions de paiement, pénalités ; facture électronique obligatoire depuis 2026.
- **RGPD** : données salariés (salaire, heures, santé) → registre de traitement + durée de conservation ; données de paie à accès strict.

## Pièges de performance (stack Supabase)

N+1 de profils dans les hooks · cache mémoire en edge function · agrégation client des saisies d'heures ·
polling des notifications au lieu de Realtime · PDF générés côté client.
