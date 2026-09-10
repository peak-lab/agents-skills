---
name: "peaklab.plane-ship-watch"
description: "Use when a Plane-linked pull request already has a parent review verdict and must be checked, merged, and synced within the current agent session."
effort: standard
argument-hint: "<PR> --issue PREFIX-N --reviewed-head SHA --reviewed-base SHA --review-verdict clean|fixed --plane-skill-dir PATH"
allowed-tools: "Bash(git:*), Bash(gh:*), Bash(rtk:*), Bash(python3:*), Read, Write, Skill"
---

<overview>
Consume a parent-owned review verdict for one exact PR head, wait for current CI, merge that
same SHA, and sync Plane. This skill does not review code, fix code, or schedule another run.
</overview>

<constraints>
- Require PR, explicit Plane issue, reviewed head/base SHAs, verdict `clean` or `fixed`, and the
  resolved filesystem directory of the loaded `peaklab.plane-do-issue` skill.
- A verdict applies only to that head/base pair. Any change invalidates it and stops merge.
- Never mutate the parent checkout. Use an external temporary detached worktree only when local
  inspection is required.
- Never rebase, resolve conflicts, or fix CI after review: each changes the reviewed state and
  must return to the implementation worker and parent review gate.
- Wait only inside this turn or a live session worker. Never create cron, cloud routines,
  `/loop`, scheduled wakeups, or any deferred continuation.
- Call Plane transition helpers only with an explicit issue and concrete GitHub evidence.
</constraints>

<workflow>
<step name="resolve">
Fetch authoritative PR metadata:

```bash
gh pr view "$PR" \
  --json number,url,title,body,state,isDraft,headRefName,baseRefName,headRefOid,mergeStateStatus
```

Before any Plane sync, extract complete `PREFIX-N` identifiers from the head branch, PR title,
and PR body, then require the explicit issue to equal one extracted identifier exactly. Substring
matching is forbidden (`PREFIX-1` must not match `PREFIX-10`). Otherwise return
`blocked_issue_mismatch`.

Require `headRefOid == reviewed_head` for every state; otherwise return
`blocked_review_required` with both SHAs. If already merged, confirm `state=MERGED`, sync Plane
using the merged PR URL, and return. Stop without Plane mutation when closed but unmerged. Stop
when `isDraft=true`.
</step>

<step name="check-base">
Fetch the base and head refs without switching the parent checkout:

```bash
git fetch origin
```

Resolve `origin/$BASE_BRANCH` and require it equals `reviewed_base`. If the base changed, return
`blocked_review_required`; the parent must revalidate the updated diff. If the reviewed head is
not a descendant of `origin/$BASE_BRANCH`, return
`blocked_rebase_required`. The implementation worker must rebase, validate, push, and the
parent must review the new SHA. If GitHub reports conflicts, return `blocked_conflict` with
the affected PR and branches; do not attempt a post-review resolution.
</step>

<step name="check-policy">
Read the repository's root instructions plus scoped instructions for changed files. Verify the
PR is non-draft, its base branch is permitted, its changed modules may ship together, and its
merge strategy/release gates match repository policy. This is a policy check, not another code
review. Return `blocked_policy` with the exact rule when a required gate is missing.
</step>

<step name="wait-ci">
Inspect checks and Actions runs for the reviewed SHA:

```bash
gh pr checks "$PR_NUMBER" --json name,state,workflow,link
gh run list --branch "$HEAD_BRANCH" --limit 10 \
  --json databaseId,status,conclusion,workflowName,headSha,url
```

When checks for the reviewed SHA are pending, wait in this turn:

```bash
gh pr checks "$PR_NUMBER" --watch --fail-fast
```

Re-run the blocking watch if the command timeout expires while checks are still pending. If
configured CI fails, return `blocked_ci` with failed check/run URLs and logs; code fixes belong
to the implementation worker and require a new parent review. If workflows or required checks
exist but no result is available for the reviewed SHA, return `blocked_missing_ci`.

When the repository has no workflows, no required checks, and no Actions run for the head,
record `ci_not_configured`; the parent's validation and review are the available gates.
</step>

<step name="race-check">
Immediately before merge, fetch PR metadata and the remote base again:

```bash
gh pr view "$PR_NUMBER" --json state,isDraft,headRefOid,mergeStateStatus
REMOTE_BASE=$(gh api "repos/{owner}/{repo}/git/ref/heads/$BASE_BRANCH" --jq .object.sha)
```

Require all of:

- PR is open and mergeable;
- `headRefOid` still equals `reviewed_head`;
- `REMOTE_BASE` still equals `reviewed_base`;
- successful configured CI belongs to that exact SHA, or CI is explicitly not configured;
- the reviewed head is still current with the base branch.

Any changed head or base returns `blocked_review_required`. Never reuse a verdict after either
change. A behind-but-unchanged reviewed pair returns `blocked_rebase_required`.
</step>

<step name="merge">
Use the merge strategy allowed by repository policy and pin the server-side merge to the
reviewed head SHA:

```bash
gh pr merge "$PR_NUMBER" "$MERGE_FLAG" --delete-branch \
  --match-head-commit "$REVIEWED_HEAD"
```

`MERGE_FLAG` is exactly one policy-approved strategy such as `--squash`, `--merge`, or
`--rebase`; do not assume one globally. `--match-head-commit` atomically protects the head.
The fresh base comparison closes the normal base race; when atomic base freshness is mandatory,
repository branch protection must also require the branch to be up to date before merge.

A non-zero exit may come from local branch deletion. Always re-read `gh pr view --json state,url`
before deciding. Continue only when GitHub proves `state=MERGED`; otherwise return the exact
merge error without changing Plane.
</step>

<step name="sync-plane">
Use the caller-provided resolved filesystem root of the `peaklab.plane-do-issue` skill, never a
`skill://` URI or an assumed home-directory install:

```bash
FINISH_ISSUE="$PLANE_SKILL_DIR/scripts/finish_issue.py"
test -f "$FINISH_ISSUE"
python3 "$FINISH_ISSUE" --merged --issue "$ISSUE" --pr-url "$PR_URL"
```

Use `--blocked` only for a permanent, evidenced post-PR blocker and include `--reason` with the
head SHA plus GitHub check/conflict URL. Do not transition Plane for a transient wait, review
invalidation, stale base, unavailable tool, or missing local credentials.

State IDs and configured terminal names are resolved dynamically by `peaklab.plane-api` from
one atomic config source. Report the state printed by `finish_issue.py`; never assume `Done`.
</step>
</workflow>

<session_contract>
- `--wait-merge`: execute this workflow synchronously and return its terminal result.
- `--async-merge`: valid only inside a live session worker that can complete this workflow and
  deliver its result. If that facility is unavailable, do not start; return the reviewed PR and
  the explicit command needed to resume.
- A pending check is not a terminal result. Keep the current blocking watch active until success,
  failure, or the current turn's bounded tool timeout.
</session_contract>

<result>
Return PR URL, issue, reviewed SHA, CI evidence, merge state, Plane state, and one status:
`merged`, `blocked_review_required`, `blocked_rebase_required`, `blocked_conflict`,
`blocked_issue_mismatch`, `blocked_policy`, `blocked_ci`, `blocked_missing_ci`, or
`closed_unmerged`.
</result>

<acceptance_criteria>
- Merge is server-pinned to the parent-reviewed head SHA and immediately preceded by a fresh
  base-SHA check; repositories needing atomic base freshness enforce up-to-date branch protection.
- A head/base/code change always returns through implementation and parent review.
- Plane changes only after explicit GitHub evidence and uses an explicit issue identifier.
- No parent checkout or deferred automation is created.
</acceptance_criteria>
