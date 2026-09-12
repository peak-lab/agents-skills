---
name: peaklab.fix-qa-bug
description: "Fix a bug recorded in qa-tracker through a linked GitHub issue, then recheck it and record the verdict in the ledger."
---

# Fix a QA-tracker bug

Resolve one recorded defect through evidence, a GitHub issue, implementation, and a ledger recheck. The ledger decides whether the bug is closed; a merged pull request alone does not.

Read [qa-session](../qa-session/SKILL.md) for the tracker session, evidence, expectation, and verification contract. Use [peaklab.gh-do-issue](../peaklab.gh-do-issue/SKILL.md) as the only implementation and pull-request owner.

## Runtime configuration

Use a configured qa-tracker checkout supplied through `QA_TRACKER_DIR`; never assume a workstation location or source a personal environment file. `bin/qa` is the only tracker entry point:

```bash
: "${QA_TRACKER_DIR:?Set QA_TRACKER_DIR to the qa-tracker checkout}"
QA="$QA_TRACKER_DIR/bin/qa"
test -x "$QA"
```

The issue operation needs `QA_GITHUB_TOKEN` in the current process environment and a target repository from `--repo owner/name` or `QA_GITHUB_REPO`. Do not print, persist, or add credentials to shell history. If either required value is absent, ask for the missing configuration. Keep the live target URL in `QA_URL` or obtain it from the selected bug/session; never substitute a guessed environment.

## 1. Select exactly one eligible bug

Use requested bug IDs or list open candidates:

```bash
"$QA" bug list --status open
```

When there is no open bug, report that result and stop. If several candidates exist without an explicit selection, show severity and occurrence counts and ask the user which one to fix. Refuse `wontfix` and `duplicate` bugs unless the user explicitly directs work on them. Process multiple IDs sequentially as separate runs; do not combine them into one pull request.

## 2. Establish the cause before changing anything

```bash
"$QA" bug show <id> --json
"$QA" shot list --bug <id>
```

Read the screenshots: QA bugs are visual claims and their captures often identify the component. Use `area`, `url_pattern`, selector, steps, expected and actual behavior, occurrences, `external_ref`, and the screenshot evidence to find the root cause in the product checkout, not in the tracker. State a proven cause, or explicitly report it unconfirmed; do not make acceptance criteria from a guess.

Do not disturb a tracker-agent run in flight. Check its documented lock/process mechanism first; ending its browser or session destroys its authentication and invalidates its run.

## 3. Record acceptance expectations before filing or fixing

Record specific, testable expectations against the route that exists now:

```bash
"$QA" bug expect <id> --url-reaches "/expected-route"
"$QA" bug expect <id> --text-appears "<expected message>"
"$QA" bug expect <id> --selector-visible "[role=alert]"
```

Run one command for each expectation because repeated flags retain only their final value. All expectations are ANDed, so do not combine mutually exclusive conditions. Without expectations, verification is inconclusive and cannot close the ledger item. Restate the recorded expectations as the issue's acceptance criteria.

## 4. Create or reuse its GitHub issue

```bash
"$QA" bug issue <id> --labels "bug,qa" --repo owner/name
```

Omit `--repo` only when `QA_GITHUB_REPO` is configured.

The tracker builds the issue body and stores the issue URL in `external_ref`. If an external reference already exists, read that issue with `gh issue view` and continue from it; never overwrite it with `--force`. When the target repository is public, obtain explicit permission before publishing screenshot evidence, because evidence blobs can remain publicly readable. Without that permission, use `--no-evidence` to create the issue without uploading screenshots and report the omitted evidence. Capture the issue number from the resulting URL.

Never use `qa bug status --ref` after the issue exists: it overwrites the dashboard's only outbound issue link. Put a pull-request URL in notes, never in `--ref`.

## 5. Delegate implementation

Invoke `peaklab.gh-do-issue` with the issue number, product repository, proven cause, and the recorded expectations. It owns the worktree, implementation, review, CI, and delivery decision. The default outcome is a reviewed pull request. Do not infer a merge; pass through only delivery authority the user supplied. With `--no-merge`, stop after reporting the reviewed pull request.

## 6. Recheck on the bug's own page

After a merged and deployed fix, create a fresh QA session against the affected environment and recheck through the tracker:

```bash
"$QA" session start --base-url "$QA_URL" --env <environment> \
  --goal "verify bug <id> after <pr-url>"
"$QA" recheck <id> --apply --notes "PR <pr-url>"
"$QA" session end --status completed
```

Read the actual result. `fixed` completes the workflow. `still-broken` means resume the existing issue workflow; do not file a duplicate. `wrong_page` or `summary_applied: false` means no ledger state changed: correct the page target or expectations and repeat the recheck. Never set a status by hand to make the workflow appear closed.

## Result

Report the bug ID and title, confirmed or unconfirmed cause, number of expectations recorded, GitHub issue, pull request and actual recheck verdict. Keep newly discovered defects outside this pull request: use `qa bug check` and then the tracker report workflow for them.
