---
name: step-02-find-solutions
description: Research and identify potential solutions to the error
prev_step: steps/step-01-analyze.md
next_step: steps/step-03-propose.md
---

# Step 2: Find Solutions

## Rules

- Do not modify files or implement anything.
- Find at least 2 distinct solutions (ideally 3); include a minimal fix and a root-cause fix when they differ.
- Prefer existing codebase patterns, helpers and tests over new abstractions.

## Output: `{solutions}`

For each solution:

| Field | Value |
|-------|-------|
| Name | Short label |
| Approach | What it changes |
| Files to modify | List |
| Effort / Risk | Low, Medium, High |
| Pros / Cons | Key trade-offs, including backward compatibility |
| Recommended? | Yes for exactly one |

Recommend one based on root-cause coverage, regression risk, effort and fit with codebase patterns.

## Next

Load [step-03-propose.md](./step-03-propose.md) without asking.
