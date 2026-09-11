---
name: grilling
description: Stress-test a plan, decision, or idea with a structured, dependency-aware user interview. Use when the user asks to be grilled or a decision needs its assumptions exposed.
---

# Grilling

Build a decision tree, then interview the user in rounds. Ask the whole current frontier: questions whose prerequisites are already settled. Do not ask downstream questions in the same round when their answer depends on another unanswered question.

For each question, provide context, viable choices when helpful, and a recommendation:

```markdown
❓ **Q1 — Decision title**

Question and relevant trade-offs.

➡️ Recommended answer: reason.
```

Use available tools and codebase exploration to establish facts yourself. Never ask the user for information that is safely discoverable. If a fact is still being researched, ask the independent frontier questions and defer only the dependent branch.

After each answer, update the decision tree and ask the next frontier. Finish only when no material decision remains silently assumed. Summarize the shared understanding and wait for confirmation before executing any resulting work.
