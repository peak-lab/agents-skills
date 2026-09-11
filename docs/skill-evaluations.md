# Controlled skill evaluations

This repository has two distinct gates:

- Deterministic CI checks: metadata, composition, helpers, CLI packaging, evaluation schema and runner tests. No model credentials or paid calls.
- Explicit model evaluations: Claude or Codex chooses JSON actions in a controlled simulation. The runner executes those actions against isolated in-memory project files and fixed service fixtures, then grades the resulting trace and artifacts. No GitHub, Plane or GlitchTip API is contacted.

The initial suite has 12 behavioral cases and 20 routing queries (two positives and two near-misses for each of five workflows). The scenarios live in `evals/scenarios.json`, outside distributed skills. Runner code lives in `scripts/evals/` and is not part of the npm agent installer.

## Run

```bash
bun run eval:check
bun run eval:skills --list
bun run eval:skills --suite routing --list
bun run eval:skills --case apex-rejects-conflicting-tdd-and-no-test
```

These commands validate, list or preview only. Actual execution requires an explicit host and model, with that host already logged in locally:

```bash
bun run eval:skills --execute --host claude --model sonnet \
  --case apex-rejects-conflicting-tdd-and-no-test

bun run eval:skills --execute --host codex --model gpt-5.6-sol \
  --suite routing --case route-apex-feature --max-steps 3 --max-calls 3
```

Model aliases can drift. For release comparisons, pass the same available pinned model identifier and keep the recorded CLI versions. The runner does not install CLIs or set up authentication. By default it uses existing CLI login and forwards no API-key or service-token environment variables. Explicit `--auth api-key` forwards only `ANTHROPIC_API_KEY` for Claude or `CODEX_API_KEY` for Codex to model invocations, never to version checks. Neither mode copies credentials or changes global configuration.

### Manual GitHub Actions

The `Evaluate skills` workflow (`.github/workflows/evaluate-skills.yml`) runs only through **Actions → Evaluate skills → Run workflow**, on the default branch. Merge the workflow there before using it. PR/push validation remains deterministic and credential-free.

Before the first run, create the GitHub environment `skill-evaluations`, restrict its deployment branches to the default branch, and configure required reviewers. Add an environment secret `ANTHROPIC_API_KEY` for Claude and/or `CODEX_API_KEY` for Codex. Use dedicated, limited-budget provider credentials. No environment or secrets are provisioned by this repository.

Choose the host, an available model, suite and scenario ID. The default runs one behavioral case; for routing use e.g. `route-apex-feature`. A blank case selects the entire suite, so raise `max-runs` deliberately. Repeats, calls and time are bounded by the runner; these are not monetary limits. Set spend controls with the provider too.

The workflow pins CLI versions and exposes the selected key only to the evaluation step, after installation and validation. This step executes trusted repository code: review workflow, script and dependency changes before merging. It is not suitable for arbitrary PR code or third-party catalogues. For general-purpose Codex automation, OpenAI recommends its [Codex Action](https://developers.openai.com/codex/noninteractive/); this specialized runner needs repeated tool-free CLI turns and uses direct, step-scoped `CODEX_API_KEY` authentication instead. Claude's API-key authentication is documented in its [headless guide](https://code.claude.com/docs/en/headless).

Download `skill-evaluations-<run-id>-<attempt>` from the run's artifacts (7-day retention). Reports are uploaded even after evaluation failures, if produced; authentication/preflight failures may produce no report. Failed assertions or model errors fail the job. Artifacts contain fixture data and model output: never put confidential fixtures in this public repository. Concurrent campaigns are serialized.

### Budgets

Defaults are one repetition, at most four runs, 30 total adapter calls, 16 steps per run, 60 seconds per call, and 300 seconds for the run loop. One adapter call launches one CLI turn; a CLI may internally make multiple provider requests or retries, particularly for structured output. A larger suite must be explicitly authorized with `--max-runs`; the other caps still apply. No runner-level automatic retries or polling schedules; model calls require explicit local execution or manual workflow dispatch. A call cap is not a dollar or token cap; reported usage is observational, and timed-out calls may still incur provider charges. Local preflight/version discovery and final report writing are outside the run-loop clock.

Use `--help` for bounded overrides. Unsupported host flags, malformed responses, native tool attempts, exhausted budgets and missing final responses produce **errors**, never passing refusals. The remaining runs are recorded as errors if the total budget has expired.

## Comparisons

```bash
# Same behavioral case, with the current skill and without skills
bun run eval:skills --execute --host claude --model sonnet \
  --case apex-rejects-conflicting-tdd-and-no-test --baseline none \
  --repeats 3 --max-runs 6 --max-calls 40

# Previous catalogue checked out separately; never changes the current worktree
bun run eval:skills --execute --host codex --model gpt-5.6-sol \
  --suite routing --case route-apex-feature \
  --baseline /path/to/previous-catalogue --repeats 3 --max-runs 6
```

The previous catalogue must expose `skills/<name>/SKILL.md` and its bundled resources. Current/previous or current/without-skill use identical task fixtures and assertions. Variant order alternates across repetitions. No-skill comparison is deliberately unavailable for routing: an empty catalogue cannot measure description quality. Behavioral success never requires loading the skill, so the no-skill baseline can genuinely succeed.

Each invocation creates a fresh ignored `.eval-results/run-*` directory with a manifest, one JSON record per run, and a Markdown report. Records include scenario/catalogue hashes, host/model/version, action results, final project artifacts, assertions, duration, calls and available token/cost measurements. The manifest also fingerprints the runner source and records the Bun version. Missing usage stays unknown, not zero. Errors stay in the pass-rate denominator. The paired delta is descriptive, not proof of statistical significance or universal speedup.

Keep baseline snapshots alongside release evidence if exact replay is needed: hashes identify content but cannot reconstruct it. Reports may contain task data and model output; review them before sharing. Local runs do not publish reports; the manually dispatched workflow uploads them as GitHub artifacts.

## Evidence boundaries

- **Routing is a controlled proxy**, not native auto-discovery. The model sees catalogue names/descriptions, then selects `load_skill`. Native Claude/Codex skills, plugins, memory, project instructions and tools are disabled. This avoids personal configuration contaminating the comparison, but does not prove a real harness will discover or prioritize the same skill.
- Behavioral cases exercise decisions and fixture mutations. A simulated `shell.run` response is a fixture, not an executed test suite. There is no arbitrary shell or generated-code execution. These cases do not prove end-to-end issue implementation, real CI, deployment or remote permissions.
- Behavioral runs explicitly identify the skill to exercise; routing runs do not. This is intentional: execution quality and automatic selection are separate measurements. The no-skill behavioral baseline receives no skill identity or resources, but retains the same user task and outcome assertions.
- Expected assertions and unrequested service responses are never included in model requests. Assertions are evaluated outside the agent. Service responses enter its context only after the corresponding call.
- Forbidden action checks include unsuccessful attempts, not just successful writes. A polite final message does not erase an earlier attempted mutation.
- Files live in per-run maps; paths cannot traverse out, skill snapshots are read-only, and simulated services have no network implementation. Native CLI subprocesses use fresh empty temporary working directories and a minimal environment. This is not a general-purpose sandbox for untrusted third-party CLIs; use reviewed host versions. Authentication remains managed by those CLIs.
- Some semantic findings need a narrow text assertion in addition to trace evidence. Those are heuristics, not an independent human review. Inspect failures before rewriting either skills or expected results.

The next separate validation layer is native discovery and end-to-end runs in externally isolated disposable repositories. Do not infer those results from this controlled suite.

## Adding a regression

Add a realistic prompt and minimal raw fixtures, then define an observable oracle. Prefer actual read/write/service actions and parsed artifact values. Do not require exact prose, unnecessary reads or a particular coding style. Include a failing counterexample in runner tests when adding a new assertion kind. For an authorization gate, include both a permitted and forbidden action when practical.

For a measured improvement, preserve the old skill snapshot, use the same host/model/tool availability, repeat the same cases, and retain unedited reports. Use held-out prompts before broad claims; do not optimize the skill solely for these 32 fixtures.

## Sources

Patterns inspected on 2026-09-11:

- [Anthropic skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md): baseline comparisons, separate assertions, usage measurement and trigger near-misses.
- [Expo skill evaluation](https://github.com/expo/skills/blob/main/.claude/skills/expo-skill-eval/SKILL.md): distinguish routing, generated artifacts and runtime evidence.
- [Superpowers testing skills](https://github.com/obra/superpowers/blob/main/skills/writing-skills/testing-skills-with-subagents.md): realistic pressure scenarios and regression-driven instruction changes.

These are design influences, not vendored implementations. Our safety controls and lightweight TS runner are repository-specific.

The Codex adapter's tool-disabling overrides follow the upstream
[temporary structured request implementation](https://github.com/openai/codex/blob/main/codex-rs/tui/src/temporary_structured_request.rs)
and [configuration schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json).
Claude flags were checked against local CLI help. Its structured-output formatter is allowed;
command execution, file tools and external service tools are not.
