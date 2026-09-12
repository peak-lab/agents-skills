---
name: ultrathink
description: "Analyze a difficult architecture, design or refactoring decision in depth before committing to an approach."
effort: deep
---

# Ultrathink

Use this skill before a consequential architecture, design, or refactoring decision whose alternatives, constraints, or failure modes are not already clear. Produce a decision that another engineer can assess and implement. Do not use it to avoid ordinary implementation work.

<constraints>
- Start from the user’s actual outcome and repository evidence. Treat assumptions as hypotheses until verified.
- Preserve existing behavior, public contracts, security boundaries, and operational constraints unless the proposal explicitly changes them.
- Prefer the smallest design that satisfies the acceptance criteria. Do not add abstractions for hypothetical future use.
- Separate facts, inferences, open questions, and recommendations.
- Do not implement, commit, deploy, or alter external state unless the user explicitly expands the task from analysis to execution.
</constraints>

<workflow>
1. State the decision, the outcome it must support, constraints, acceptance criteria, and relevant files or systems.
2. Inspect the current architecture, execution paths, tests, configuration, callers, and recent history that materially affect the decision.
3. Identify viable alternatives, including retaining the current design when it meets the goal. Eliminate alternatives only with concrete evidence.
4. Evaluate each viable option against behaviour, migration cost, compatibility, performance, reliability, security, operability, testability, and maintenance. Scale the analysis to actual risk.
5. Recommend one option and explain its trade-offs, rejected alternatives, migration sequence, rollback or containment path, validation, and unresolved risks.
6. Re-read the conclusion against the evidence. Tighten scope until every proposed component has a stated purpose.
</workflow>

<output>
Deliver an implementation-ready decision record containing:

- the problem and success criteria;
- relevant evidence and assumptions;
- alternatives with material trade-offs;
- the recommended design and why it fits the constraints;
- a sequenced implementation and validation plan;
- risks, rollout or rollback considerations, and decisions that require user input.

Use diagrams or tables only when they clarify relationships that prose cannot. Cite repository paths, tests, and authoritative documentation directly.
</output>

<acceptance_criteria>
- The recommendation follows from verified evidence and the stated constraints.
- A capable implementer can execute the plan without rediscovering important decisions.
- Risks and compatibility effects have concrete mitigations or are explicitly accepted.
- The design is no more complex than the problem requires.
</acceptance_criteria>
