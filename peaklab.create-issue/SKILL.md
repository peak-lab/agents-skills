---
name: "peaklab.create-issue"
description: Use when creating comprehensive GitHub issues from descriptions, bug reports, feature requests, code context, or images.
effort: standard
disable-model-invocation: true
allowed-tools: Read, Bash(gh :*), Bash(git :*)
argument-hint: <issue-description> [--remote <name>] [--assignee <user>] [--code]
---

<objective>
Create comprehensive GitHub issues by analyzing provided text, leveraging documentation research, and following best practices. Issues are created on configurable remotes with configurable assignees.
</objective>

<quick_start>
<setup>
Ensure GitHub CLI is authenticated:

```bash
gh auth login
```

Optional: Configure defaults in `.env`:
```bash
GH_ISSUE_REMOTE=origin
GH_ISSUE_ASSIGNEE=mkldevops
```
</setup>

<basic_usage>
```bash
# Simple issue creation
/peaklab.create-issue "Add user authentication feature"

# With attached image (screenshot/mockup) — image is auto-uploaded to GitHub
/peaklab.create-issue "Login page is broken" [attach screenshot.png]

# With custom assignee
/peaklab.create-issue "Fix login redirect bug" --assignee alice

# With custom remote and assignee
/peaklab.create-issue "Refactor database layer" --remote upstream --assignee bob

# With code examples in description
/peaklab.create-issue "Add dark mode toggle" --code

# All options combined
/peaklab.create-issue "Add caching layer" --remote upstream --assignee alice --code
```
</basic_usage>
</quick_start>

<configuration>
**Priority order** (highest to lowest):
1. Command-line arguments (`--remote`, `--assignee`, `--code`)
2. Environment variables from `.env` file
3. Default values

**Environment variables:**
| Variable | Description | Default |
|----------|-------------|---------|
| `GH_ISSUE_REMOTE` | Git remote for issue creation | `origin` |
| `GH_ISSUE_ASSIGNEE` | Default issue assignee | `mkldevops` |
| `GH_ISSUE_CODE` | Include code examples in description | `false` |

**Example `.env` file:**
```bash
GH_ISSUE_REMOTE=upstream
GH_ISSUE_ASSIGNEE=team-lead
GH_ISSUE_CODE=true
```

**Getting repository URL from remote:**
```bash
# Get repo URL for gh issue create -R
REMOTE="origin"
REPO_URL=$(git remote get-url $REMOTE | sed 's/git@github.com://' | sed 's/.git$//')
# Result: owner/repo
```
</configuration>

<argument_parsing>
**Syntax:**
```
/peaklab.create-issue <description-text> [--remote <remote-name>] [--assignee <username>] [--code]
```

**Parsing rules:**
1. Extract `--remote <value>` if present
2. Extract `--assignee <value>` if present
3. Check if `--code` flag is present (boolean)
4. Remaining text is the issue description

**Examples:**
```
/peaklab.create-issue "Add user authentication"
→ description: "Add user authentication"
→ remote: from .env or "origin"
→ assignee: from .env or "mkldevops"
→ code: from .env or false

/peaklab.create-issue "Fix login bug" --assignee john
→ description: "Fix login bug"
→ remote: from .env or "origin"
→ assignee: "john"
→ code: from .env or false

/peaklab.create-issue "New feature" --remote upstream --assignee alice
→ description: "New feature"
→ remote: "upstream"
→ assignee: "alice"
→ code: from .env or false

/peaklab.create-issue "Add dark mode" --code
→ description: "Add dark mode"
→ remote: from .env or "origin"
→ assignee: from .env or "mkldevops"
→ code: true (include code examples in description)

/peaklab.create-issue "Refactor auth" --remote upstream --assignee bob --code
→ description: "Refactor auth"
→ remote: "upstream"
→ assignee: "bob"
→ code: true (include code examples in description)
```
</argument_parsing>

<process>
1. **Parse Arguments and Configuration**
   - Extract `--remote` and `--assignee` from arguments
   - Check `.env` file for `GH_ISSUE_REMOTE` and `GH_ISSUE_ASSIGNEE`
   - Apply defaults: remote=`origin`, assignee=`mkldevops`
   - Extract the description text

2. **Detect Attached Images**
   - Check if any images were attached to the prompt (screenshots, mockups, diagrams)
   - Images appear as file paths in the conversation (e.g. `/tmp/paste-xxx.png`, `/var/folders/.../image.png`)
   - Collect all image paths for upload in step 6

3. **Text Analysis**
   - Parse input to understand the request/problem
   - Identify issue type: feature, bug, enhancement, refactor, etc.
   - Extract key requirements and technical constraints
   - Determine affected components/areas

4. **Documentation Research** (if Symfony project)
   - Use Context7 to resolve library documentation
   - Research relevant components for requirements
   - Find best practices and implementation patterns
   - Identify dependencies or related features

5. **Investigation and Solution Research**
   - Evaluate available solutions/alternatives
   - Compare approaches and pros/cons
   - Identify best solution based on:
     - Technical compatibility and stability
     - Maintenance status and community support
     - Performance and security considerations
     - Integration complexity

6. **Upload Images to GitHub** (if images detected in step 2)
   - Get repository from configured remote
   - Upload each image using the GitHub assets API (see `<image_handling>`)
   - Collect the returned `url` for each uploaded image

7. **Issue Generation**
   - Create title following Conventional Commits format: `type(scope): description` or `type: description`
   - Write detailed description with acceptance criteria
   - If images were uploaded, add a `## Screenshots` section with embedded markdown images
   - Select appropriate labels

8. **Issue Creation**
   - Create issue with `gh issue create`
   - Output issue URL
</process>

<github_cli_commands>
**Get repository from remote:**
```bash
REMOTE="origin"
REPO=$(git remote get-url $REMOTE | sed 's/git@github.com://' | sed 's/https:\/\/github.com\///' | sed 's/.git$//')
echo $REPO  # owner/repo format
```

**Create issue:**
```bash
gh issue create \
  -R "$REPO" \
  --assignee "$ASSIGNEE" \
  --title "feat(auth): add user authentication" \
  --body "## Description
Implement user authentication feature.

## Acceptance Criteria
- [ ] Login form
- [ ] Password validation
- [ ] Session management

## Technical Notes
Use Symfony Security component." \
  --label "enhancement,backend"
```

**List available labels:**
```bash
gh label list -R "$REPO"
```

**List available assignees:**
```bash
gh api repos/{owner}/{repo}/collaborators --jq '.[].login'
```
</github_cli_commands>

<image_handling>
When images are attached to the prompt (screenshots, mockups, error dialogs, etc.), attempt to upload them to GitHub using the **release asset method** (the only reliable programmatic option), then embed the URL in the issue.

**IMPORTANT — GitHub API limitations:**
- `uploads.github.com/repos/{repo}/issues/assets` → broken/restricted, returns "Bad Size"
- `github.com/upload/policies/assets` → requires browser CSRF session token, not API tokens
- Base64 data URIs in Markdown → stripped by GitHub for security
- There is NO official GitHub REST API to upload images directly to issues

**Preferred method — release asset upload:**
```bash
# Step 1: check if a "screenshots" release tag exists, create it if not
gh release view screenshots -R "$REPO" > /dev/null 2>&1 || \
  gh release create screenshots \
    -R "$REPO" \
    --title "Screenshots" \
    --notes "Auto-uploaded screenshots from issue reports" \
    --prerelease

# Step 2: upload the image as a release asset
IMAGE_PATH="/path/to/image.png"
IMAGE_NAME="$(date +%Y%m%d-%H%M%S)-$(basename "$IMAGE_PATH")"

gh release upload screenshots "$IMAGE_PATH#$IMAGE_NAME" \
  -R "$REPO" \
  --clobber

# Step 3: get the download URL
IMAGE_URL=$(gh release view screenshots -R "$REPO" --json assets \
  --jq ".assets[] | select(.name == \"$IMAGE_NAME\") | .url")
```

**Multiple images:** upload each one separately, collect all URLs.

**Embed in issue body:**
```markdown
## Screenshots

![Screenshot]($IMAGE_URL)
```

Use descriptive alt text based on context (e.g. `![Login page error]`, `![Mobile layout bug]`).

**If upload fails:** add a note in the issue body:
```markdown
> Note: A screenshot was attached to this report but could not be uploaded automatically. Please attach it manually by dragging the image into the GitHub issue editor.
```
</image_handling>

<code_option>
When `--code` flag is set or `GH_ISSUE_CODE=true`, include detailed code examples in the issue description:

**Additional sections in issue body:**
```markdown
## Implementation Code

### File: `src/components/DarkModeToggle.tsx`
\`\`\`typescript
import { useState, useEffect } from 'react';

export const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <button onClick={() => setIsDark(!isDark)}>
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};
\`\`\`

### File: `src/styles/globals.css`
\`\`\`css
:root {
  --bg-color: #ffffff;
  --text-color: #000000;
}

.dark {
  --bg-color: #1a1a1a;
  --text-color: #ffffff;
}
\`\`\`
```

**What to include:**
- Complete code snippets for each affected file
- File paths where changes should be made
- Import statements and dependencies
- Configuration changes if needed
- Migration scripts if applicable
- Test examples

**What NOT to include when `--code` is disabled:**
- Only high-level technical suggestions
- Architecture recommendations
- No detailed code snippets
</code_option>

<issue_format>
**Title format (Conventional Commits):**
```
type(scope): brief description
```

Or without scope:
```
type: brief description
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `chore` - Maintenance tasks
- `perf` - Performance improvement
- `test` - Tests
- `ci` - CI/CD changes
- `style` - Code style (formatting, semicolons, etc.)
- `build` - Build system or dependencies

Common scopes (optional):
- `auth` - Authentication
- `api` - API changes
- `ui` - User interface
- `db` - Database
- `config` - Configuration

**Body template:**
```markdown
## Description
[Clear problem statement or feature request]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Implementation
[Technical suggestions and approach]

## Affected Components
- Component 1
- Component 2

## Dependencies
- Dependency 1 (if any)

## Screenshots
<!-- Only include this section when images were attached to the prompt -->
![Screenshot description](https://github.com/assets/...)

## Complexity
[Low / Medium / High]
```

**Common labels:**
| Category | Labels |
|----------|--------|
| Type | `feature`, `bug`, `enhancement`, `documentation` |
| Priority | `priority:low`, `priority:medium`, `priority:high`, `priority:critical` |
| Area | `backend`, `frontend`, `database`, `api` |
| Effort | `good-first-issue`, `complex`, `breaking-change` |
</issue_format>

<workflow_examples>
<simple_feature>
```bash
# Input
/peaklab.create-issue "Add dark mode toggle to settings"

# Parsed
description="Add dark mode toggle to settings"
remote="origin"  # from .env or default
assignee="mkldevops"  # from .env or default

# Get repo
REPO=$(git remote get-url origin | sed 's/git@github.com://' | sed 's/.git$//')

# Create issue
gh issue create -R "$REPO" \
  --assignee "mkldevops" \
  --title "feat(ui): add dark mode toggle to settings" \
  --body "## Description
Add a dark mode toggle in the application settings.

## Acceptance Criteria
- [ ] Toggle switch in settings page
- [ ] Theme persists across sessions
- [ ] Smooth transition animation

## Complexity
Medium" \
  --label "enhancement,frontend"
```
</simple_feature>

<bug_report>
```bash
# Input
/peaklab.create-issue "Login redirects to wrong page after authentication" --assignee alice

# Create issue
gh issue create -R "$REPO" \
  --assignee "alice" \
  --title "fix(auth): login redirects to wrong page after authentication" \
  --body "## Description
Users are redirected to the wrong page after successful login.

## Steps to Reproduce
1. Go to login page
2. Enter valid credentials
3. Click submit
4. Observe incorrect redirect

## Expected Behavior
Redirect to dashboard after login.

## Actual Behavior
Redirects to homepage instead of dashboard.

## Complexity
Low" \
  --label "bug,priority:high"
```
</bug_report>

<custom_remote>
```bash
# Input
/peaklab.create-issue "Upgrade to PHP 8.3" --remote upstream --assignee team

# Get upstream repo
REPO=$(git remote get-url upstream | sed 's/git@github.com://' | sed 's/.git$//')

# Create issue on upstream
gh issue create -R "$REPO" \
  --assignee "team" \
  --title "chore(deps): upgrade to PHP 8.3" \
  --body "## Description
Upgrade project to PHP 8.3 for latest features and performance.

## Acceptance Criteria
- [ ] Update composer.json
- [ ] Fix deprecated features
- [ ] Run full test suite
- [ ] Update CI configuration

## Complexity
Medium" \
  --label "chore,backend"
```
</custom_remote>

<with_code_examples>
```bash
# Input
/peaklab.create-issue "Add dark mode toggle to settings" --code

# Create issue with code examples
gh issue create -R "$REPO" \
  --assignee "mkldevops" \
  --title "feat(ui): add dark mode toggle to settings" \
  --body "## Description
Add a dark mode toggle in the application settings.

## Acceptance Criteria
- [ ] Toggle switch in settings page
- [ ] Theme persists across sessions
- [ ] Smooth transition animation

## Implementation Code

### File: \`src/components/DarkModeToggle.tsx\`
\\\`\\\`\\\`typescript
import { useState, useEffect } from 'react';

export const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className=\"p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700\"
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
};
\\\`\\\`\\\`

### File: \`tailwind.config.js\`
\\\`\\\`\\\`javascript
module.exports = {
  darkMode: 'class',
  // ... rest of config
};
\\\`\\\`\\\`

## Complexity
Medium" \
  --label "enhancement,frontend"
```
</with_code_examples>
</workflow_examples>

<env_file_parsing>
**Reading .env values:**
```bash
# Check if .env exists and read values
if [ -f .env ]; then
  GH_ISSUE_REMOTE=$(grep -E '^GH_ISSUE_REMOTE=' .env | cut -d '=' -f2 || echo "origin")
  GH_ISSUE_ASSIGNEE=$(grep -E '^GH_ISSUE_ASSIGNEE=' .env | cut -d '=' -f2 || echo "mkldevops")
  GH_ISSUE_CODE=$(grep -E '^GH_ISSUE_CODE=' .env | cut -d '=' -f2 || echo "false")
else
  GH_ISSUE_REMOTE="origin"
  GH_ISSUE_ASSIGNEE="mkldevops"
  GH_ISSUE_CODE="false"
fi
```

**Override with command-line args:**
```bash
# If --remote provided, use it
# If --assignee provided, use it
# If --code flag present, set to true
# Otherwise use .env or defaults
```
</env_file_parsing>

<success_criteria>
- Arguments parsed correctly (--remote, --assignee, --code, description)
- Configuration loaded from .env if present
- Issue created on correct remote repository
- Issue assigned to correct user
- Issue has clear title following Conventional Commits format: `type(scope): description` or `type: description`
- Issue body contains all required sections
- Appropriate labels applied
- Issue URL returned to user
- If --code flag set: issue description contains detailed implementation code
- If images attached to prompt: images uploaded to GitHub assets API and embedded in issue body under `## Screenshots`
</success_criteria>
