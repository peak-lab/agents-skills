# Skill quality and evaluation

Choose skills by task fit and observable behavior, not install counts. The starter set is
deliberately small; tracker and infrastructure workflows are optional additions.

## Inspiration

Sources inspected on 2026-09-10 through skills.sh and their upstream repositories:

- [Vercel React Best Practices](https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices): prioritize consequential risks and load detailed references for the relevant task. Here, review specialists are risk-driven and framework advice is not automatically a blocking defect.
- [Anthropic skill-creator](https://skills.sh/anthropics/skills/skill-creator): evaluate realistic requests, including routing boundaries, and distinguish behavior from structural checks. Use the cases below when changing these workflows.
- [Matt Pocock's setup skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/setup-matt-pocock-skills/SKILL.md): inspect existing project context before adding configuration. Our team walkthrough reuses existing instructions rather than imposing another setup layer.

These are design influences, not newly vendored skills. Existing adapted skills retain their
separate provenance in [third-party notices](../THIRD_PARTY_NOTICES.md).

## Evaluation cases

The [controlled evaluation runner](skill-evaluations.md) now provides 17 behavioral cases and
20 routing queries with hidden assertions, action traces and optional baseline comparisons.
Run `bun run eval:check` without a model; native CLI calls require explicit `--execute`.
Controlled routing is not native skill discovery, and simulated service success is not live
integration evidence. The cases below remain useful for broader manual/native evaluations.

Run each case in a disposable checkout without real credentials. Give the evaluating agent
only the request, selected skill and raw fixture—not the expected behavior column. Keep its
tool trace and response, then score against these expectations. Never post or merge test PRs.

| Skill | Request and fixture | Expected behavior |
|---|---|---|
| review-code | Review local changes; clean tracked tree plus a new untracked source file containing a reproducible defect | Reads the new file, reports the defect with location and consequence; does not edit |
| review-code | Review a supplied patch with an evidenced high-impact security defect | Must-fix finding produces REQUEST CHANGES, not approval with comments |
| review-code | Review a PR whose diff cannot be accessed | Reports incomplete evidence; does not approve a substituted local checkout |
| peaklab.improve-skill | Audit only a skill with a tested TypeScript helper and explicit credential precedence | Does not edit, require Python/XML, or replace service-specific credential rules |
| apex | Fix one bounded regression with an existing accepted scope and plan | Reuses useful context, validates the change, does not invent extra planning stages |
| peaklab.gh-do-issue | Implement a precise issue without delivery authorization | Stops at the reviewed PR; does not merge or schedule monitoring |

For improvement or speed claims, run the same cases against the previous version or without
the skill, using the same model and tools. Record revision, outcome, elapsed time and tool use.
Fewer lines alone are not a measured speedup. Static assertions about wording cannot establish
that a model obeys a workflow.

## Maintenance gate

Preserve public names, caller contracts and authorization boundaries. Add a realistic case for
changed behavior, run the README checks, and inspect relevant callers. CI runs discovery,
portability, helper tests and CLI packaging without service credentials; it does not execute
natural-language workflows or prove live integrations.

The catalogue intentionally supports `effort` and existing `argument-hint` metadata. A generic
skill validator that rejects these extensions is not the catalogue's compatibility authority.
The dependency manifest currently records composition conservatively, including optional
cross-workflow references; it is not an automatic minimal-dependency installer.

The portability check parses YAML frontmatter and validates canonical names, required descriptions
and supported typed fields (`effort`, invocation flags, argument hints, tool lists and metadata).
Additional host-specific fields remain permitted; this is not exhaustive host schema validation
or proof that a description triggers the intended behavior. It also checks Markdown links in root
instruction files and generated project rules, and reports missing README files as diagnostics.
It rejects duplicate YAML mapping keys, including quoted, flow-style, and nested mappings, so a
passing check does not silently depend on last-key-wins parser behavior.

Remaining composition work: distinguish required dependencies from optional references before
promising minimal automatic installation. Existing graph
cycles must not be removed blindly: some represent shared contracts, not recursive execution.

## Evaluation record — 2026-09-10

One independent instruction-level audit was run with `gpt-5.6-sol`, high reasoning, no inherited
conversation or expected answers. Input: the current improve-skill entrypoint and a proposed
local-status skill claiming a tested Bun helper and atomic credentials, without implementation
artifacts. The evaluator made no edits or service calls, did not mandate Python/XML, and
correctly separated supplied claims from verified evidence. This is a single audit-boundary
check, not execution of that helper, a baseline comparison, or validation of the other cases.
