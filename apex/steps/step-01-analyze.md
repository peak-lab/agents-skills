---
name: step-01-analyze
description: Gather only the repository and external context needed for the change
next_step: steps/step-02-plan.md
---

# Step 1: Analyze

<goal>
Establish what exists, what must change, and how success can be demonstrated without designing the full solution twice.
</goal>

<reuse>
Start from caller-provided issue context, prior analysis, relevant file locations, and acceptance criteria. Confirm only facts that may be stale or unsupported. Do not repeat broad exploration when the target and patterns are already known.
</reuse>

<procedure>
1. Inspect repository guidance and the smallest likely code area. Search before reading large files.
2. When present, read the applicable `CONTEXT-MAP.md`, nearest bounded-context `CONTEXT.md`, domain glossary, and relevant ADRs. Record vocabulary, invariants, ownership boundaries, and decisions; do not silently redefine overloaded terms or contradict an ADR.
3. Apply the scope gate before broad exploration. If the destination is not clear enough for one bounded implementation session, set status `needs_planning`, explain the decision-sized unknowns, recommend `wayfinder`, and load `step-09-finish.md`. Do not manufacture tasks to make unresolved discovery look executable.
4. Trace an implementation-ready behavior across its real boundary: entrypoint, domain logic, persistence/external calls, and tests as applicable.
5. Find one or two comparable implementations and the project-native validation commands.
6. Use external documentation only for an unfamiliar or version-sensitive API. Prefer primary documentation.
7. Delegate exploration only when independent questions can run in parallel and economy mode is off. Give each worker one bounded question and request conclusions with `file:line` evidence. Never delegate merely to satisfy a quota.
8. Derive measurable acceptance criteria from the request and repository behavior. Flag material product ambiguity; do not ask about decisions the codebase answers.
</procedure>

<minimum_output>
- Relevant files and observed conventions with `file:line` evidence.
- Behavior boundary and affected dependencies.
- Applicable domain vocabulary, context boundaries, and ADR decisions, or an explicit note that none were found.
- Focused and full validation commands, if discoverable.
- Acceptance criteria and unresolved material assumptions.
- Which supplied artifacts were reused and why they remain current.
</minimum_output>

If status is `needs_planning`, `needs_clarification`, or blocked, persist that status, load `step-09-finish.md`, and return without planning. Otherwise update the canonical state and load `step-02-plan.md`. Do not create a separate analysis document unless the caller supplied one as the canonical artifact.
