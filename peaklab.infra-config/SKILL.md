---
name: peaklab.infra-config
description: Use when starting or configuring a project that needs infrastructure, deployment, or service credentials discovered from local env files and shell config.
effort: standard
allowed-tools: Read, Write, Bash
---

# infra-config

Auto-discover deployment and integration credentials from all available sources, fill gaps interactively, then persist in **two files with distinct purposes**:

| File | Purpose | Gitignored |
|------|---------|------------|
| `.env` | Machine-readable project config — shared by Claude, Codex, local app scripts, and skills. Contains project infra vars including tokens. | ✅ Yes — never committed |
| `.codex/rules/infra.md` | Human-readable context — auto-loaded by Codex each session so it knows where to look for deployments, logs, monitoring. No tokens. | ❌ No — versioned |

**Key distinction**: `.env` is the shared source of truth for project/service variables used by both Claude and Codex. `infra.md` is context only. Both are needed — one makes tools work, the other tells agents where to look without exposing secrets.

## Known Infrastructure (PeakLab)

| Instance | Token Var | URL | Notes |
|----------|-----------|-----|-------|
| Coolify PeakLab (pro) | `COOLIFY_TOKEN` | `https://coolify.example.com/api/v1` | Main — most PeakLab projects |
| Coolify Fahari (clf) | `COOLIFY_TOKEN_CLF` | `https://coolify-secondary.example.com/api/v1` | Personal instance |
| Coolify Monitoring | `COOLIFY_MONITORING_TOKEN` | `https://coolify-monitoring.example.com/api/v1` | Monitoring only |
| Glitchtip | — | `https://glitchtip.example.com` | Error tracking |
| Uptime Kuma | — | `http://uptime-kuma.internal:3001` (SSH: `ubuntu@monitoring.example.com`) | Uptime monitoring |
| Umami | — | `https://analytics.example.com` | Analytics |
| Plane | — | `https://plane.example.com` | Project management |

## Workflow

### Step 1 — Auto-discover from all sources (run in parallel)

```bash
# Source 1: .zshrc — richest, has all PeakLab tokens
grep -E "^export (COOLIFY|PLANE|GLITCHTIP|DATABASE|APP_|OPENROUTER|HCLOUD)" ~/.zshrc 2>/dev/null

# Source 2: shared global agent env
grep -E "^(COOLIFY|PLANE|GLITCHTIP|DATABASE|APP_|OPENROUTER|HCLOUD)" ~/.agents/.env.local 2>/dev/null

# Source 3: existing infra.md (already configured?)
cat .codex/rules/infra.md 2>/dev/null

# Source 4: project .env
grep -E "^[A-Z_]+=.+" .env 2>/dev/null | grep -v "^#"

# Source 5: sibling projects
ls ../*/.env 2>/dev/null | head -10
```

For each sibling `.env` found, read and extract relevant infra vars — projects in the same family often share `COOLIFY_URL`, `PLANE_TOKEN`, `GLITCHTIP_URL`, etc. Never print secret values directly.

### Step 2 — Auto-detect Coolify APP UUID + FQDN

If `COOLIFY_TOKEN` is known but `COOLIFY_APP_UUID` is missing, query the API. Read credentials directly from env files (not from `os.environ` only — shell grep doesn't export):

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
env.update(load_env("~/.agents/.env.local"))
env.update(load_env(".env"))  # project overrides global

# Also check zshrc as fallback
if 'COOLIFY_TOKEN' not in env:
    zshrc = open(os.path.expanduser('~/.zshrc')).read()
    m = re.search(r'^export COOLIFY_TOKEN="?([^"\n]+)"?', zshrc, re.MULTILINE)
    if m: env['COOLIFY_TOKEN'] = m.group(1)

TOKEN = env.get('COOLIFY_TOKEN', '')
URL = env.get('COOLIFY_URL', 'https://coolify.example.com/api/v1').rstrip('/')

if not TOKEN:
    print("COOLIFY_TOKEN not found — skip UUID detection")
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
  ✅ COOLIFY_APP_UUID  example-app-uuid          (Coolify API → pushrank-lp)
  ✅ APP_URL_PROD      https://app.example.com                (Coolify FQDN, first of 2)
  ✅ PLANE_TOKEN       ••••••c915                         (sibling: pushrank)
  ❌ PLANE_PROJECT     not found
  ❌ GLITCHTIP_DSN     not found
```

### Step 4 — Interview only for missing vars (one theme at a time)

---

## Themes

### Theme 1: Coolify

| Variable | Description | Default |
|----------|-------------|---------|
| `COOLIFY_URL` | API base URL | `https://coolify.example.com/api/v1` for PeakLab |
| `COOLIFY_TOKEN` | Bearer token | From `.zshrc` |
| `COOLIFY_PROJECT` | Project UUID | Auto-detected |
| `COOLIFY_APP_UUID` | App UUID | Auto-detected via API |

If `COOLIFY_URL` is unknown, offer:
> "[1] coolify.example.com (PeakLab main) [2] coolify-secondary.example.com (Fahari) [3] Other"

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

**File 1 — `.env`** (all project infra vars, read by Claude, Codex, local app scripts, and skills; gitignored):

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

Merge with existing `.env` — update or append only the relevant keys. Preserve comments, unrelated app variables, quoting style where practical, and existing values not part of this workflow.

**File 2 — `.codex/rules/infra.md`** (no tokens, auto-loaded by Codex as context):

Create directory first: `mkdir -p .codex/rules/`

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
2. Coolify : skill `/coolify-api` → app UUID example-app-uuid
3. Site : `curl -I https://app.example.com`

## Credentials

Tokens dans `.env` (gitignored, jamais committé).
```

Ensure gitignore:

```bash
grep -q "^\\.env$" .gitignore 2>/dev/null || echo ".env" >> .gitignore
```

### Step 6 — Final output

```
✅ infra-config complete

  .env                    — 10 vars (Claude/Codex/app ready)
  .codex/rules/infra.md   — context written (auto-loaded by Codex)

  coolify-api / deploy-check   ✅  pushrank-lp → https://app.example.com
  plane-api / peaklab.ship-pr  ✅ / ❌
  glitchtip-api                ✅ / ❌

Re-run /peaklab.infra-config to update any value.
```

## Rules

- Scan all sources before asking anything — never ask for something already discoverable
- Auto-detect `COOLIFY_APP_UUID` via API (match git repo name) — never ask manually
- Auto-fill `APP_URL_PROD` from Coolify FQDN — take first value if comma-separated
- Default `COOLIFY_URL` for PeakLab projects: `https://coolify.example.com/api/v1`
- Load credentials in Python directly from `.env` files, not from `os.environ` only (bash grep doesn't export)
- `.env` → all project vars needed by Claude, Codex, app scripts, and skills (tokens + URLs + UUIDs)
- `~/.agents/.env.local` → optional global fallback for shared agent/service tokens
- `infra.md` → human-readable context only, no tokens
- Always mask tokens to `••••••<last6>` in output
- Always merge (not overwrite) `.env` — preserve comments and unrelated variables
- Create `.codex/rules/` with `mkdir -p` before writing `infra.md`
- Always enforce `.env` in `.gitignore`
