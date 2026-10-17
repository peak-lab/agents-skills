---
name: "peaklab.gh-create-issue"
description: "Draft or create a GitHub issue from a bug report, feature request, code or image, checking for duplicates first. Use peaklab.plane-create-issue for Plane."
effort: standard
allowed-tools: Read, Bash(gh :*), Bash(git :*)
argument-hint: <issue-description> [--remote <name>] [--assignee <user>] [--code]
---

<objective>
Turn the provided text, code context or images into one well-scoped GitHub issue on the configured remote, created with `gh issue create`.
</objective>

<configuration>
Priority: command-line arguments, then the project's `.env`, then defaults. Remaining argument text is the issue description.

| Argument | `.env` variable | Default |
|----------|-----------------|---------|
| `--remote <name>` | `GH_ISSUE_REMOTE` | `origin` |
| `--assignee <user>` | `GH_ISSUE_ASSIGNEE` | unset (no assignee) |
| `--code` | `GH_ISSUE_CODE` | `false` |

Read only those keys from `.env`; never print other values. Resolve the repository as `owner/repo` from `git remote get-url <remote>` (SSH or HTTPS form) and pass it with `-R` to every `gh` call. Requires an authenticated `gh`.
</configuration>

<process>
1. Parse arguments and configuration as above; collect attached image paths (screenshots, mockups) from the conversation.
2. Understand the request: issue type, affected components, constraints. Inspect the code when it sharpens scope; check current library documentation only when a technical recommendation depends on it.
3. Search for duplicates first: `gh issue list -R "$REPO" --state all --search "<keywords>"`. If a matching open issue exists, report it and do not create another; mention close matches that are closed.
4. Upload images, if any (see `<image_handling>`).
5. Draft the issue (see `<issue_format>`). Pick labels only from `gh label list -R "$REPO"`; never invent labels. Add `--assignee` only when one is configured or passed. Do not set a milestone unless the user asks.
6. Create when the user asked to create, directly or through a calling workflow they invoked to file and deliver the issue; when they asked for a draft or the scope is materially ambiguous, show the draft and wait. Never create more than one issue per request without explicit authorization.
7. Reply with the issue number and URL.
</process>

<issue_format>
Title: Conventional Commits, `type(scope): description` or `type: description`, lowercase imperative summary. Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `perf`, `test`, `ci`, `style`, `build`.

Body skeleton (omit sections that do not apply):

```markdown
## Description
## Acceptance Criteria
- [ ] ...
## Technical Implementation
## Affected Components
## Dependencies
## Screenshots        <!-- only when images were attached -->
## Complexity         <!-- Low / Medium / High -->
```

Bugs also get `## Steps to Reproduce`, `## Expected Behavior` and `## Actual Behavior`.

With `--code` (or `GH_ISSUE_CODE=true`), add `## Implementation Code` with complete snippets per affected file (path heading, imports, config, tests). Without it, keep technical guidance high-level: no detailed code snippets.

Pass multi-line bodies with `--body-file` or a quoted heredoc to avoid shell escaping problems.
</issue_format>

<image_handling>
GitHub has no official API to attach images to issues: `uploads.github.com/.../issues/assets` fails, `github.com/upload/policies/assets` needs a browser session, and data URIs are stripped. Use the release asset method:

```bash
gh release view screenshots -R "$REPO" >/dev/null 2>&1 || \
  gh release create screenshots -R "$REPO" --title "Screenshots" \
    --notes "Auto-uploaded screenshots from issue reports" --prerelease
IMAGE_NAME="$(date +%Y%m%d-%H%M%S)-$(basename "$IMAGE_PATH")"
gh release upload screenshots "$IMAGE_PATH#$IMAGE_NAME" -R "$REPO" --clobber
IMAGE_URL=$(gh release view screenshots -R "$REPO" --json assets \
  --jq ".assets[] | select(.name == \"$IMAGE_NAME\") | .url")
```

Upload each image separately and embed it under `## Screenshots` with descriptive alt text. If an upload fails, add a note asking the reader to attach the screenshot manually in the GitHub editor.
</image_handling>

<success_criteria>
- Duplicate search ran before creation; no duplicate created
- Issue created on the repository of the configured remote, assigned only when an assignee was provided
- Conventional Commits title, required body sections, existing labels only
- `--code` respected; attached images uploaded and embedded under `## Screenshots`
- Reply contains the issue number and URL
</success_criteria>
