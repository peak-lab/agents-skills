---
name: "peaklab.plane-intake-ideas"
description: "Turn a teammate's Slack ideas and Loom videos into labelled \"[Idée]\" Plane Intake entries, then draft a Slack recap for the triage discussion."
effort: standard
argument-hint: "<Slack link> | <person> [today]"
allowed-tools: "Bash(python3:*), Read, Write, Edit, Skill"
---

<objective>
Collect product ideas a teammate shared on Slack (text or Loom video), file each one as a pending Plane Intake
entry titled `[Idée] …`, labelled and cross-referenced with existing work items, then prepare a Slack draft
listing them for a triage discussion. Accept = it becomes a work item and delivery is tracked there;
decline = dropped, with the reason in a comment.
</objective>

<requirements>
- [peaklab.plane-api](../peaklab.plane-api/SKILL.md) installed and configured for the target project.
- A Slack integration able to search messages, read threads, look up users and create drafts.
- For Loom transcripts: a browser automation tool that can run JavaScript in a page. Without one, read the
  Slack thread only and say the video was not transcribed.
</requirements>

<scope>
- The Intake may also receive customer messages (contact form, email). The `[Idée]` prefix marks team ideas.
- Scope = the Slack link given. When asked for the person's other videos, take only the ones posted the same
  day: older ones are stale unless the user says otherwise.
- Bugs are not ideas: they go to work items (`peaklab.plane-create-issue`), never to Intake. Skip a bug that
  is already fixed.
- The request authorises creating Intake entries. Slack is draft only: never post on the user's behalf.
</scope>

<workflow>
<step_1_collect>
- Slack link: read the message and its thread. Note author, date, channel and objections raised in replies.
- The person's videos of the day: search Slack for `loom` with `from:<@USER_ID> on:YYYY-MM-DD`.
- Loom transcript: open `https://www.loom.com/share/<id>`, then run in the page a `POST /graphql` with a single
  object (batched requests are refused), `operationName: "FetchVideoTranscript"` and the query
  `fetchVideoTranscript(videoId,password){... on VideoTranscriptDetails{source_url} ... on GenericError{message}}`
  (do not request `id`). Fetch `source_url` and read `.phrases[].value`. When the tool truncates output, read
  the text in slices. Close the tabs afterwards.
- A silent screen recording has no transcript: rely on the Slack thread.
- Split one video into several entries when it carries independent ideas.
</step_1_collect>

<step_2_cross_check>
For each idea, search existing work items by name and by feedback labels, and pending Intake entries
(`intake_idea.py list --all-states`). If an idea is fully covered, do not file it: report the work item.
Otherwise list related work items, with their state, in the description.
</step_2_cross_check>

<step_3_file>
Write one HTML description per idea in a temporary directory:

- `<p><strong>Auteur :</strong> name, #channel, date. Source : <a>message Slack</a>, <a>Loom « title »</a>.</p>`
- `<h3>Constat</h3>` when there is one, `<h3>Idée</h3>`, `<h3>Contraintes relevées dans le fil</h3>` when the
  thread objected, `<h3>Existant à croiser</h3>`.
- `<h3>Suivi</h3><p>Accepter = devient un ticket. Refuser = idée abandonnée, motif en commentaire. Déjà couvert
  = marquer en doublon du ticket existant.</p>`
- Write in the team's language, paraphrase the author, do not speculate.

Create each entry from the project checkout, with an origin label and a dated feedback label
(`<person>-feedback-MMDD`, reusing the spelling already present in the project):

```bash
python3 scripts/intake_idea.py create --title "…" --html-file <file> --labels "source/interne,<person>-feedback-MMDD"
```

Resolve `scripts/` against this skill's directory. The command prints the readable identifier, the labels
applied and the Intake URL. Plane ignores labels in the Intake payload, so the helper sets them with
`PATCH work-items/<issue_id>/`; a `GET` on that path returns 404 for Intake items, so trust the PATCH response.
Deleting an entry (`DELETE intake-issues/<id>/`) returns an empty 204.
</step_3_file>

<step_4_slack_draft>
Create a draft in the channel the user names. Use Slack link syntax `<url|text>`, not Markdown links, and make
only the identifier clickable:

```
<!channel> Les idées de <person> d'aujourd'hui sont dans l'Intake Plane :
• <ENTRY_URL|PREFIX-N> Short title
…

Toutes les idées en attente : <INTAKE_URL|Intake Plane>

On en discute avec <@DECIDER> et <@AUTHOR> pour décider ce qu'on garde et ce qui devient un ticket.
```

Build the list with `intake_idea.py list --label <person>-feedback-MMDD`. Resolve user IDs through the Slack
user search. A new draft does not replace an older one: tell the user to delete superseded drafts.
</step_4_slack_draft>
</workflow>

<output>
A short reply in the user's language: entries filed (identifier, title), ideas already covered (work item),
items skipped (bugs, stale videos), and the draft's channel link.
</output>
