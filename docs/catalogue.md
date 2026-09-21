# Choose a skill by task

Start with the [four-skill installation](installation.md#install-the-starter-set). Choose one
entry point for your task; the other skills are available when a specific need arises.
The [full package index](../README.md#choose-your-next-task) is in the README's expandable catalogue.

## Everyday development

These examples assume the named skill is installed and the project's test tools are available.
For additions outside the starter set, use [custom selection instructions](installation.md#other-selections).

| Need | Skill | Example request |
|---|---|---|
| Implement a bounded change | [apex](../skills/apex/SKILL.md) | Use apex to fix the empty-search crash. An empty query should show all results. Run the relevant tests; do not commit or open a PR. |
| Review existing changes | [review-code](../skills/review-code/SKILL.md) | Use review-code to review my local changes, including new files. Do not edit. |
| Enforce test-first work | [tdd](../skills/tdd/SKILL.md) | Use tdd to add validation for an empty email address. |
| Continue in another session | [handoff](../skills/handoff/SKILL.md) | Use handoff to record what changed, the verification results, and what remains. |
| Investigate a reproducible bug | [debug-code](../skills/debug-code/SKILL.md) | Use debug-code to reproduce and fix this failure: [steps and expected result]. |
| Apply a defined structural change | [refactor](../skills/refactor/SKILL.md) | Use refactor to extract this parser while preserving its public behavior. |
| Assess maintainability | [clean-code](../skills/clean-code/SKILL.md) | Use clean-code to assess this module and identify the most useful improvements. |

`apex` already includes analysis and validation. You do not need to run every row as a sequence.

## Issues and delivery

Install the linked workflow first; its installation guide lists service prerequisites.

| Starting point | Installation | Example request |
|---|---|---|
| GitHub issue | [GitHub](installation.md#github-issues) | Use peaklab.gh-do-issue for [issue URL]. Stop at a reviewed PR. |
| Plane issue | [Plane](installation.md#plane-issues) | Use peaklab.plane-do-issue for [issue URL]. Stop at a reviewed PR. |
| GlitchTip error | [GlitchTip](installation.md#glitchtip-errors) | Use peaklab.glitchtip-do-issue for [error URL]. Stop at a reviewed PR. |
| Existing PR ready to finalize | [GitHub](installation.md#github-issues) | Use peaklab.ship-pr to review and merge [PR URL] once the required checks pass. |

The last example explicitly authorizes merging. Issue workflows stop at a reviewed PR by default;
see [workflow options and authorization](team-workflows.md#workflow-options-and-authorization).

## Planning, design, and specialized tools

| Need | Start with | Additional prerequisites |
|---|---|---|
| Resolve unanswered product decisions | `grilling` | Decision-maker input |
| Explore a broad initiative | `wayfinder` | Its planning dependencies; see custom installation |
| Clarify business language | `domain-modeling` | Project/domain context |
| Write an implementation specification | `to-spec` | Established requirements |
| Split approved work into tickets | `to-tickets` | An approved plan or specification |
| Build a web interface | `frontend-design`, or `shadcn` for component work | Project frontend toolchain |
| Update project instructions | `peaklab.sync-ai-docs` | [Template usage](rule-templates.md#use-in-a-project) |
| Run browser QA | `qa-session` | qa-tracker and the browser tools required by the skill |
| Coordinate Orca workers | `orchestration` | Orca runtime |
| Scaffold an app | `create-peaklab-app` | Project generator |
| Work with infrastructure | Relevant service skill from the full index | Service-specific configuration and credentials |

Each package's `SKILL.md` is the authority for its prerequisites and workflow. Keep credentials
in environment variables or gitignored configuration, outside this catalogue.
