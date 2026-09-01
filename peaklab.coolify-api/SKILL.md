---
name: peaklab.coolify-api
description: Use when managing Coolify deployments, applications, databases, services, or servers. Triggers on "deploy", "redeploy", "restart", "check logs", "list apps", "manage env vars", or any reference to Coolify infrastructure. Routes to the Coolify MCP server when it covers the operation, REST otherwise.
effort: fast
allowed-tools: Bash(python3 :*), Read
argument-hint: "[operation] [resource] [args...]"
---

<objective>
Manage Coolify deployments, applications, databases, services, and servers safely. Two transports, one instance boundary:

- **MCP first** — the `coolify` MCP server (`mcp__coolify__*`, endpoint configured in the user environment, for example `https://coolify.example.com/mcp`) covers discovery, reads, logs, and deploy/start/stop/restart for the configured team. No bootstrap, no token handling, ownership enforced server-side.
- **REST fallback** — the bundled `scripts/coolify.py` helper (or ad hoc Python via the bootstrap block) for what MCP cannot do: env var **values** and writes, resource creation/deletion, deploy polling loops, and instances not covered by the configured MCP server.

Never reimplement in REST something MCP already exposes. When the helper lacks a needed non-destructive operation that MCP also lacks, add it to the helper.
</objective>

<constraints>
- Check the routing table before writing any REST call — MCP wins wherever it is listed
- REST path only: load credentials via the bootstrap block before any API call
- Credential priority: project `.env` → `~/.agents/.env` → legacy project `settings.local.json`
- Confirm destructive operations (delete, stop) with user before executing — MCP `control` also requires `confirm=true` to stop
- Never hardcode UUIDs — resolve them via `mcp__coolify__search_resources` or a list endpoint
- Never print secret values, tokenized Git URLs, private keys, or full env var payloads. MCP redaction is best-effort, not a guarantee — `get_logs` and `get_deployment(include_log_summary)` can still leak free-form log text
- For deploy/status/env workflows on the REST path, use `python3 skill://peaklab.coolify-api/scripts/coolify.py ...` so the user can safely approve that script prefix instead of broad `python3 *`
</constraints>

<routing>

| Task | Use |
|------|-----|
| "What exists / what's broken" | `mcp__coolify__get_infrastructure_overview`, `list_unhealthy_resources` |
| Find a resource by name/UUID/domain | `mcp__coolify__search_resources` |
| List/get apps, DBs, services, servers, projects | `mcp__coolify__list_*` / `get_*` |
| Container logs | `mcp__coolify__get_logs` (resource + uuid, ≤500 lines) |
| Deployment history / one deployment | `mcp__coolify__list_deployments`, `get_deployment` |
| Deploy, cancel a deployment | `mcp__coolify__deploy`, `cancel_deployment` |
| Start / stop / restart | `mcp__coolify__control` (stop needs `confirm=true`) |
| Env var **key names** only | `mcp__coolify__list_env_keys`, `list_shared_env_keys` |
| Env var **values**, create/update/delete | REST — helper `upsert-env`, or `api('GET'/'POST'/'PATCH'/'DELETE', …/envs)` |
| Deploy several apps and wait for green | REST — helper `deploy … --wait` (MCP has no polling loop) |
| Create/delete projects, apps, resources | REST — see `coolify-create-project` |
| Any instance ≠ `coolify.example.com` | REST — MCP is registered for that host only |

`coolify_help` returns the live MCP tool catalog by intent; prefer it over guessing a tool name.

</routing>

<instances>

| Instance | Token Var | URL | MCP | Notes |
|----------|-----------|-----|-----|-------|
| Primary example | `COOLIFY_TOKEN` | `https://coolify.example.com/api/v1` | yes — `coolify` | Main instance |
| Secondary example | `COOLIFY_TOKEN_SECONDARY` | `COOLIFY_URL_SECONDARY` | no | Optional second instance |
| Monitoring example | `COOLIFY_TOKEN_MONITORING` | `COOLIFY_URL_MONITORING` | no | Optional monitoring instance |

**One MCP server = one URL + one token = one team.** The MCP protocol has no notion of switching
credentials per project; whatever token the header resolves to at session start is the only team the
tools can see. `get_current_team` names it.

The `coolify` server is registered at user scope in `~/.claude.json` with the header
`Authorization: Bearer ${COOLIFY_TOKEN}` — the variable is expanded from the session environment, so the
server follows whatever `COOLIFY_TOKEN` the current project resolves (project `.env`, then
`~/.agents/.env`, then shell). Rotating a token only needs the env var updated, never the MCP config.

Two limits this does not solve:

- The **URL stays fixed** on the MCP server configured in the current session. A project on another instance needs its own server:
  `claude mcp add --scope local --transport http coolify-secondary https://coolify-secondary.example.com/mcp --header 'Authorization: Bearer ${COOLIFY_TOKEN_SECONDARY}'`
- A project with **no `COOLIFY_TOKEN` override** inherits the shell-level one. The
  tools then answer for the wrong team without erroring. When the target project matters, confirm with
  `get_current_team` before acting.

MCP also has to be enabled per team on the Coolify side (`is_mcp_server_enabled`) on top of a valid token.

Project `.env` (or legacy `.claude/settings.local.json`) pins the instance per project — set `COOLIFY_URL` and `COOLIFY_TOKEN` there to avoid specifying them manually.

</instances>

<bootstrap>
REST path only — skip it entirely when the routing table sends you to MCP. Run once per session before any REST call.

```python
import os, json, urllib.request

# 1. project .env  2. ~/.agents/.env  3. legacy project settings.local.json
for _p in ['.env', os.path.expanduser('~/.agents/.env')]:
    try:
        for _line in open(_p):
            if _line.startswith('COOLIFY') and '=' in _line:
                _k, _, _v = _line.strip().partition('=')
                os.environ.setdefault(_k.strip(), _v.strip().strip('"\''))
    except FileNotFoundError:
        pass
for _sl in ['.claude/settings.local.json', '.codex/settings.local.json']:
    try:
        for k, v in json.load(open(_sl)).get('env', {}).items():
            if k.startswith('COOLIFY'): os.environ.setdefault(k, v)
    except Exception:
        pass

URL   = os.environ.get('COOLIFY_URL', '').rstrip('/')
TOKEN = os.environ.get('COOLIFY_TOKEN', '')
if not URL or not TOKEN:
    import sys; print("Missing COOLIFY_URL or COOLIFY_TOKEN — run peaklab.infra-config", file=sys.stderr); sys.exit(1)

def api(method, path, data=None):
    req = urllib.request.Request(f'{URL}{path}', method=method,
        headers={'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'})
    if data: req.data = json.dumps(data).encode()
    return json.loads(urllib.request.urlopen(req).read().decode())
```
</bootstrap>

<quick_start>

Quick reference:

On `coolify.example.com`, every row marked *(MCP)* has a first-class MCP tool — use it instead. The REST
form stays documented for the other instances and for scripts that cannot call MCP.

| Operation | Call | MCP equivalent |
|-----------|------|----------------|
| List apps | `api('GET', '/applications')` | `list_applications` |
| Get app | `api('GET', f'/applications/{uuid}')` | `get_application` |
| Deploy | `api('GET', f'/deploy?uuid={uuid}&force=false')` | `deploy` |
| Start | `api('GET', f'/applications/{uuid}/start')` | `control action=start` |
| Stop | `api('GET', f'/applications/{uuid}/stop')` | `control action=stop confirm=true` |
| Restart | `api('GET', f'/applications/{uuid}/restart')` | `control action=restart` |
| Logs | `api('GET', f'/applications/{uuid}/logs?lines=100')` | `get_logs` |
| List servers | `api('GET', '/servers')` | `list_servers` |
| List databases | `api('GET', '/databases')` | `list_databases` |
| List services | `api('GET', '/services')` | `list_services` |
| List deployments | `api('GET', '/deployments')` | `list_deployments` |
| List projects | `api('GET', '/projects')` | `list_projects` |
| List env vars | `api('GET', f'/applications/{uuid}/envs')` | keys only via `list_env_keys` — REST for values |
| Create env var | `api('POST', f'/applications/{uuid}/envs', {'key':'K','value':'V','is_preview':False})` | none — REST only |
| Update env var | `api('PATCH', f'/applications/{uuid}/envs', {'key':'K','value':'new','is_preview':False})` | none — REST only |
| Delete env var | `api('DELETE', f'/applications/{uuid}/envs/{env_uuid}')` | none — REST only |

For full endpoint reference, see [references/endpoints.md](references/endpoints.md).

Safe helper:

Use the helper for common operations:

```bash
python3 skill://peaklab.coolify-api/scripts/coolify.py apps --filter example
python3 skill://peaklab.coolify-api/scripts/coolify.py deploy web api worker --wait
python3 skill://peaklab.coolify-api/scripts/coolify.py status <deployment_uuid>
python3 skill://peaklab.coolify-api/scripts/coolify.py upsert-env web NIXPACKS_NODE_VERSION 24 --both
```

App aliases come from `COOLIFY_APP_ALIASES`, a JSON object such as `{ "web": "my-web-app", "api": "my-api" }`.

</quick_start>

<gotchas>

| Trap | Fix |
|------|-----|
| Wrong instance targeted | MCP always hits `coolify.example.com`. For another instance, drop to REST and check `COOLIFY_URL` |
| `COOLIFY_TOKEN` is team-scoped | Both MCP and REST see one team only. `get_current_team` before acting on an unfamiliar project |
| MCP answers for the wrong team | The project has no `COOLIFY_TOKEN` override and inherited the shell one. Set it in the project `.env` |
| REST used where MCP exists | Costs a bootstrap and handles the token by hand for nothing — re-read the routing table |
| Env values wanted from MCP | `list_env_keys` returns key names only, by design. Values need REST |
| UUID unknown | `mcp__coolify__search_resources query=…`, or REST `api('GET', '/applications')` by `name` |
| Destructive without confirm | Always ask user before `stop`, `delete`, or `restart` |
| MCP tools absent from the session | The server is registered at user scope; a session started before registration must be restarted |

**See also:** `coolify-create-project` skill for creating projects and adding resources.

</gotchas>

<success_criteria>
- MCP is used for covered Coolify operations before any REST fallback
- REST helper output is redacted and never prints token, password, key, or env value payloads unnecessarily
- Resource UUIDs are resolved from names/domains before lifecycle actions
- Destructive operations are confirmed by the user at point of risk
</success_criteria>
