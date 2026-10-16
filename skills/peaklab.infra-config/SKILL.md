---
name: peaklab.infra-config
description: "Discover infrastructure settings from local environment files and configure a project that needs them."
effort: standard
allowed-tools: Read, Write, Bash
---

# infra-config

Auto-discover deployment and integration credentials from all available sources, fill gaps interactively, then persist in **two files with distinct purposes**:

| File | Purpose | Gitignored |
|------|---------|------------|
| `.env` | Machine-readable project config — shared by Claude, Codex, local app scripts, and skills. Contains project infra vars including tokens. | ✅ Yes — never committed |
| `.codex/rules/infra.md` | Human-readable context — auto-loaded by Codex each session so it knows where to look for deployments, logs, monitoring. No tokens. | ❌ No — versioned |

## Known Infrastructure (PeakLab)

| Instance | Token Var | URL | Notes |
|----------|-----------|-----|-------|
| Coolify main | `COOLIFY_TOKEN` | `https://coolify.example.com/api/v1` | Main instance |
| Coolify secondary | `COOLIFY_TOKEN_SECONDARY` | `https://coolify-secondary.example.com/api/v1` | Optional second instance |
| Coolify monitoring | `COOLIFY_TOKEN_MONITORING` | `https://coolify-monitoring.example.com/api/v1` | Monitoring only |
| Glitchtip | — | `https://glitchtip.example.com` | Error tracking |
| Uptime Kuma | — | `http://uptime-kuma.internal:3001` (SSH: `ubuntu@monitoring.example.com`) | Uptime monitoring |
| Umami | — | `https://analytics.example.com` | Analytics |
| Plane | — | `https://plane.example.com` | Project management |

## Credential sources

This skill owns credential discovery for the infrastructure skills (`peaklab.coolify-api`,
`peaklab.uptime-kuma`). Precedence, first match wins:

1. project `.env`
2. `~/.agents/.env` (shared global fallback)
3. legacy `.claude/settings.local.json` / `.codex/settings.local.json` `env` block
4. `~/.zshrc` exports (discovery only)

Discovery prints variable **names** only (`grep -oE`), never values. Scripts read values from files
directly (shell `grep` does not export them) and never print secrets or tokens; masked display is
`••••••<last6>`. Never default `COOLIFY_URL` to the placeholder host: use a discovered value or ask.

## Workflow

### Step 1 — Auto-discover from all sources (run in parallel)

```bash
# Source 1: .zshrc — richest, has all PeakLab tokens (names only, never values)
grep -oE "^export (COOLIFY|PLANE|GLITCHTIP|DATABASE|APP_|OPENROUTER|HCLOUD)[A-Z_]*" ~/.zshrc 2>/dev/null

# Source 2: shared global agent env (names only)
grep -oE "^(COOLIFY|PLANE|GLITCHTIP|DATABASE|APP_|OPENROUTER|HCLOUD)[A-Z_]*" ~/.agents/.env 2>/dev/null

# Source 3: existing infra.md (already configured?)
cat .codex/rules/infra.md 2>/dev/null

# Source 4: project .env
grep -oE "^[A-Z_]+=" .env 2>/dev/null

# Source 5: sibling projects
ls ../*/.env 2>/dev/null | head -10
```

Sibling projects often share `COOLIFY_URL`, `PLANE_TOKEN`, `GLITCHTIP_URL`: read their values in a script, never in the terminal.

### Step 2 — Auto-detect Coolify APP UUID + FQDN

If `COOLIFY_TOKEN` and `COOLIFY_URL` are known but `COOLIFY_APP_UUID` is missing, query the API:

```python
import os, re, subprocess, urllib.request, json

def load_env(path):
    env = {}
    try:
        for line in open(os.path.expanduser(path)):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env

env = {}
env.update(load_env("~/.agents/.env"))
env.update(load_env(".env"))  # project overrides global

if 'COOLIFY_TOKEN' not in env:  # zshrc fallback
    zshrc = open(os.path.expanduser('~/.zshrc')).read()
    m = re.search(r'^export COOLIFY_TOKEN="?([^"\n]+)"?', zshrc, re.MULTILINE)
    if m: env['COOLIFY_TOKEN'] = m.group(1)

TOKEN = env.get('COOLIFY_TOKEN', '')
URL = env.get('COOLIFY_URL', '').rstrip('/')

if not TOKEN or not URL:
    print("COOLIFY_TOKEN or COOLIFY_URL not found — skip UUID detection")
else:
    # Derive app name from git remote
    try:
        repo = subprocess.check_output(['git', 'remote', 'get-url', 'origin'], text=True).strip()
        app_name = repo.split('/')[-1].replace('.git', '')
    except Exception:
        app_name = os.path.basename(os.getcwd())

    req = urllib.request.Request(f'{URL}/applications',
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'})
    apps = json.loads(urllib.request.urlopen(req).read().decode())

    match = next((a for a in apps if a.get('name', '').lower() == app_name.lower()), None)
    if match:
        # Handle multiple FQDNs (e.g. "https://a.com,https://www.a.com") — take first
        fqdn_raw = match.get('fqdn', '') or ''
        fqdn = fqdn_raw.split(',')[0].strip()
        print(f"name={match['name']} uuid={match['uuid']} fqdn={fqdn} status={match.get('status')}")
    else:
        print(f"No app named '{app_name}' found — will ask user")
```

### Step 3 — Show discovery summary before asking anything

```
Auto-discovered:
  ✅ COOLIFY_URL       https://coolify.example.com/api/v1   (.zshrc)
  ✅ COOLIFY_TOKEN     ••••••c0233                        (.zshrc)
  ✅ COOLIFY_APP_UUID  example-app-uuid          (Coolify API → example-app-lp)
  ✅ APP_URL_PROD      https://app.example.com                (Coolify FQDN, first of 2)
  ✅ PLANE_TOKEN       ••••••c915                         (sibling: example-app)
  ❌ PLANE_PROJECT     not found
  ❌ GLITCHTIP_DSN     not found
```

### Step 4 — Interview only for missing vars (one theme at a time)

---

## Themes

### Theme 1: Coolify

| Variable | Description | Default |
|----------|-------------|---------|
| `COOLIFY_URL` | API base URL | Discovered, else ask |
| `COOLIFY_TOKEN` | Bearer token | Discovered |
| `COOLIFY_PROJECT` | Project UUID | Auto-detected |
| `COOLIFY_APP_UUID` | App UUID | Auto-detected via API |

If `COOLIFY_URL` is unknown, offer:
> "[1] coolify.example.com (main) [2] coolify-secondary.example.com (secondary) [3] Other"

### Theme 2: Plane

| Variable | Description |
|----------|-------------|
| `PLANE_TOKEN` | API key — Plane → Settings → API Tokens |
| `PLANE_PROJECT` | Full URL to project issues page |

### Theme 3: Glitchtip

| Variable | Description | Default |
|----------|-------------|---------|
| `GLITCHTIP_URL` | Instance URL | `https://glitchtip.example.com` |
| `GLITCHTIP_TOKEN` | Management API token | Optional |
| `GLITCHTIP_DSN` | SDK DSN string — Project → Client Keys | Required |

### Theme 4: Database

| Variable | Description |
|----------|-------------|
| `DATABASE_URL_PROD` | Full PostgreSQL connection string (production) |

### Theme 5: App metadata

| Variable | Description | Source |
|----------|-------------|--------|
| `APP_URL_PROD` | Production URL | Auto from Coolify FQDN (first) |
| `APP_NAME` | Human name | From git repo name |

---

### Step 5 — Confirm then write both files

Show summary (mask tokens: `••••••<last6chars>`). Ask "Save? [Y/n]".

**File 1 — `.env`**:

```dotenv
COOLIFY_URL=https://coolify.example.com/api/v1
COOLIFY_TOKEN=...
COOLIFY_PROJECT=...
COOLIFY_APP_UUID=...
PLANE_TOKEN=...
PLANE_PROJECT=https://...
GLITCHTIP_URL=https://glitchtip.example.com
GLITCHTIP_TOKEN=...
GLITCHTIP_DSN=https://...
DATABASE_URL_PROD=postgres://...
APP_URL_PROD=https://...
APP_NAME=...
```

Merge, never overwrite: update or append only these keys; preserve comments, unrelated variables and quoting style.

**File 2 — `.codex/rules/infra.md`** (no tokens; `mkdir -p .codex/rules/` first):

```markdown
# Infrastructure & Déploiement

| Élément | Valeur |
|---------|--------|
| Plateforme | Coolify — https://coolify.example.com |
| App UUID | example-app-uuid |
| URL production | https://app.example.com |
| CI/CD | GitHub Actions (.github/workflows/) |
| Monitoring erreurs | Glitchtip — https://glitchtip.example.com |
| Monitoring uptime | Uptime Kuma — http://uptime-kuma.internal:3001 (SSH: ubuntu@monitoring.example.com) |
| Analytics | Umami — https://analytics.example.com |
| Plane | https://plane.example.com/... |

## Vérifier un déploiement

1. CI : `gh run list --branch main --limit 5`
2. Coolify : skill `/peaklab.coolify-api` → app UUID example-app-uuid
3. Site : `curl -I https://app.example.com`

## Credentials

Tokens dans `.env` (gitignored, jamais committé).
```

Ensure gitignore:

```bash
grep -q "^\\.env$" .gitignore 2>/dev/null || echo ".env" >> .gitignore
```

### Step 6 — Final output

Report the files written (`.env` var count, `infra.md`), which consumer skills are now ready
(`peaklab.coolify-api`, `peaklab.plane-api`, GlitchTip) with ✅/❌, and that re-running this skill updates values.

## Rules

- Scan every source before asking — never ask for something discoverable
- Auto-detect `COOLIFY_APP_UUID` (git repo name match) and `APP_URL_PROD` (first FQDN) — never ask manually
- `infra.md` holds context only, never tokens; `.env` stays gitignored and merged, never overwritten
