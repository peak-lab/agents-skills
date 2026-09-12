---
name: wayfinder
description: "Map a broad, uncertain initiative into decision tickets before planning implementation."
disable-model-invocation: true
---

# Wayfinder

Wayfinding discovers the route; it does not prematurely execute the destination.

Use it for work with meaningful uncertainty, multiple architectural decisions, or a horizon larger than one agent session. First define the destination in one or two sentences. If the route is already clear and small, stop and use [to-spec](../to-spec/SKILL.md) for a specification or [to-tickets](../to-tickets/SKILL.md) to split an approved plan instead.

Create one durable map in the project's issue tracker or planning location:

```markdown
## Destination

## Notes

## Decisions so far

## Not yet specified

## Out of scope
```

Create child decision tickets only for questions that can be stated precisely now. Keep still-vague but in-scope concerns in **Not yet specified**. Use **Out of scope** for work that lies beyond the destination, never as a backlog.

Each ticket is one of: research (agent-led fact finding), prototype (a concrete artifact for human feedback), grilling (a human decision), or task (work that unblocks a decision). Record dependencies so the unblocked, unclaimed tickets form a visible frontier.

Work one non-research decision ticket per session: claim it before investigating, publish the resolution on the ticket, close it, update the map with a one-line linked decision, and create only the newly visible follow-up tickets. Do not turn the map into a duplicate store of ticket details.
