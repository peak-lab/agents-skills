---
name: step-05-examine
description: Perform a risk-based review of the owned patch for the current fingerprint
prev_step: steps/step-04-validate.md
next_step: steps/step-06-resolve.md
---

# Step 5: Examine

<scope>
Review only the owned patch scoped in validation. Reuse a review only when its fingerprint still matches.
This phase uses deep review intent: a delegated review explicitly selects the host's configured
deep model and effort. Direct execution keeps the current session's model.
</scope>

<procedure>
1. Inspect correctness, acceptance-criteria coverage, error paths, boundary validation, security, and maintainability in proportion to the change.
2. Review directly by default. Delegate a bounded specialist review only when delegation is allowed and patch risk justifies it (authorization, injection, concurrency, migrations, public contracts, framework-specific performance).
3. Validate every proposed finding against the current code and classify it as blocking, important, minor, noise, or uncertain.
4. Report actionable findings with `file:line`, impact, evidence, and the smallest appropriate correction. Do not create todos for noise.
</procedure>

If there are real findings to address, load `step-06-resolve.md`. Otherwise mark the review current for this fingerprint and load `step-09-finish.md`.
