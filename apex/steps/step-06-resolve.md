---
name: step-06-resolve
description: Resolve validated review findings and invalidate affected evidence
prev_step: steps/step-05-examine.md
next_step: steps/step-04-validate.md
---

# Step 6: Resolve findings

Fix blocking and important findings that are real and within scope. In auto mode, skip noise and leave uncertain or scope-expanding items documented. In non-auto mode, ask only when accepting, rejecting, or expanding a finding requires user judgment.

For each accepted finding:

1. update the relevant canonical plan slice;
2. apply the smallest root-cause correction while respecting owned paths;
3. invalidate review and validation evidence affected by the edit;
4. run the narrow focused check needed for safe iteration.

If fixes changed the patch, load `step-04-validate.md`. If no edit was made, record the disposition: load Finish for accepted non-blocking residual risk, or load Finish with blocked status for an unresolved blocking finding. Do not duplicate a full suite here.
