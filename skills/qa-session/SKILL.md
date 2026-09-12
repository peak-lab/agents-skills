---
name: qa-session
description: "Run browser QA, record UI bugs and screenshots, or inspect known bugs in the qa-tracker ledger. Use for requested testing, not general app exploration."
---

# QA session

Use this skill only with a configured `qa-tracker` checkout and browser automation runtime. The
tracker ledger is the persistent record that prevents duplicate reports across sessions.

## Discover the runtime

Set `QA_TRACKER_DIR` to the qa-tracker checkout. Its `bin/qa` command is the sole ledger entry
point; do not write its database directly. Validate it before testing:

```bash
: "${QA_TRACKER_DIR:?Set QA_TRACKER_DIR to the qa-tracker checkout}"
QA="$QA_TRACKER_DIR/bin/qa"
test -x "$QA"
"$QA" help
```

Use a provided test account and browser session. Keep credentials out of commands, action logs,
notes, screenshots, bug fields, and reports.

## Start from the ledger

Before opening the browser, create a session. Choose the target environment and base URL supplied
for this run:

```bash
"$QA" session start --base-url <url> --env <environment> \
  --account <test-account> --role <role> --goal "<test goal>"
```

Read every known open bug it prints. A known bug may be re-confirmed, but must never be filed as a
new bug. For an interrupted run, use `--resume latest` only when it matches this environment and
base URL; use `qa flow plan` to distinguish newly tested coverage from inherited coverage.

## Cover declared flows first

Run `qa flow list` and complete each declared journey before free exploration. For each flow:

```bash
"$QA" flow start <id>
# walk the printed steps in the browser
"$QA" flow done <id> --status passed|failed
```

`failed` means the flow was run and broke, and requires a bug report. `blocked` and `skipped`
require explanatory notes. After each completed numbered step in a multi-step flow, save a
checkpoint with `qa flow checkpoint <id> --step N`.

## Capture the trail

Use the browser loop `open` → `snapshot -i` → act on an element reference. Capture every
meaningful state and every failure before changing the page:

```bash
"$QA" capture "step-4 continue blocked" --annotation "what to inspect"
"$QA" action add --action click --target @e16 --desc "Continue" --failed \
  --notes "no navigation and no displayed error"
```

Record every navigation, click, fill, select, press, and observed failure immediately. Never put
credential values in a logged action.

## Check duplication before reporting

```bash
"$QA" bug check --title "<one-line symptom>" --area <area> --url <url>
```

- `DUPLICATE`: report with the same arguments to record an occurrence on the existing bug.
- `NEEDS DECISION`: compare the related bug. Use `--dup-of <id>` for the same cause, or `--force`
  only for a genuinely distinct defect.
- `POSSIBLE DUPLICATE`: read the candidate bug and reuse its area, URL, and title when it is the
  same defect.
- `NEW`: report it.

The area is a stable location such as `onboarding/step-4`, not a prose description. Keep stable
area, URL, and symptom wording across sessions.

## Report with evidence

```bash
"$QA" bug report --title "<symptom, not diagnosis>" --area <area> --url <full-url> \
  --selector "<element>" --severity blocker|major|minor|trivial \
  --description "<impact>" --expected "<expected behavior>" \
  --actual "<observed behavior>" --steps "step 1|step 2|step 3"
"$QA" capture "<evidence label>" --bug <id> --annotation "<what it proves>"
```

Use `blocker` when work cannot proceed, `major` for a broken feature or silent failure, `minor`
for a workable defect, and `trivial` for cosmetic defects.

## Recheck the complete known-bug set

After the flows and exploration, run:

```bash
"$QA" sweep
"$QA" flow coverage
"$QA" recheck
"$QA" recheck --apply
```

Visit every bug the sweep owes and each known bug on a page you traversed. `qa verify <id>` judges
only the current page; use `--goto` or `qa recheck` to reach the bug's own URL. If the page does
not match the bug's URL pattern, the evidence must not change its status, even with `--apply`.

Verdicts come from recorded expectations, never image diffs alone. If none exist, add specific,
non-conflicting expectations while on the relevant page, for example:

```bash
"$QA" bug expect <id> --selector-visible "[role=alert]"
"$QA" bug expect <id> --text-appears "<expected message>"
"$QA" bug expect <id> --url-reaches "/expected-route"
```

Run one command per expectation because repeated flags retain only their last value. An
`inconclusive` result leaves the bug owed; it is never evidence of a fix.

## Close and report

```bash
"$QA" session end --strict
"$QA" report --session <id> -o /tmp/qa-report.md
```

`--strict` is a coverage gate: it refuses an unwalked or unexplained flow and an unchecked known
bug. Use `--force` only when the run genuinely could not reach the target and include the reason.
Report flows first, then regressions, new bugs, verified fixes, still-present bugs, and finally
unchecked bugs with their reasons. Do not describe unchecked bugs as fixed.

Useful commands: `qa bug list`, `qa bug show <id>`, `qa shot list --bug <id>`, `qa stats`, and
`qa help`. Exit codes are `0` for no new bugs, `1` for new bugs, `2` for a failed run, `75` when
the ledger is busy, and `130` when interrupted.
