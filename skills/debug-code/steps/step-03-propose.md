---
name: step-03-propose
description: Present solutions to user for selection
prev_step: steps/step-02-find-solutions.md
next_step: steps/step-04-fix.md
---

# Step 3: Propose Solutions

## Rules

- Do not modify files. Do not implement before a solution is selected.

## Sequence

1. Recap: error, root cause, number of affected files.
2. Present every solution from `{solutions}`: approach, files, pros/cons, effort, risk. Say why the recommended one is recommended.
3. Selection gate:
   - `{auto_mode}`: select the recommended solution.
   - Otherwise: ask "Which solution should we implement?" with one option per solution, recommended first and labelled "(Recommended)". Wait for the answer.
4. Store `{selected_solution}`: id, name, approach, files to modify.

## Next

Load [step-04-fix.md](./step-04-fix.md).
