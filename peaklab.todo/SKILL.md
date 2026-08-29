---
name: "peaklab.todo"
description: Use when managing tasks on the Notion Planning Fahari page, including adding, modifying, deleting, or listing planning tasks.
effort: fast
allowed-tools: Bash(curl :*), Bash(python3 :*)
argument-hint: "[ajouter|modifier|supprimer] [description]"
---

**Page Notion :** `30a2572cfd37803d80d4f3f85ee7e0a6`

## Détecter l'intention

- **Ajouter** : "ajoute", "note", "crée une tâche", "mets sur mon planning", message sans verbe d'action explicite
- **Modifier** : "change", "modifie", "renomme", "déplace", "marque comme fait"
- **Supprimer** : "supprime", "retire", "enlève", "efface"

## Workflow

### Ajouter
1. Fetch la page pour voir le contenu actuel
2. Identifier la section `# Aujourd'hui — <date>` cible (défaut : aujourd'hui)
3. Si la section n'existe pas → la créer en haut de page avec `<mention-date start="YYYY-MM-DD"/>`
4. Insérer `- [ ] {tâche}` à la fin de la section appropriée via `update_content`

### Modifier
1. Fetch la page
2. Localiser la tâche avec `old_str` exact
3. Remplacer via `update_content`

### Supprimer
1. Fetch la page
2. Localiser la ligne exacte
3. Remplacer par une chaîne vide via `update_content`

## Règles

- Toujours utiliser `update_content` (jamais `replace_content`) pour ne pas écraser le reste
- Confirmer l'action effectuée en une ligne
- Si ambiguïté sur quelle tâche modifier/supprimer → demander précision avant d'agir
