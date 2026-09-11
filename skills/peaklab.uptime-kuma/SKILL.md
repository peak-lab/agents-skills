---
name: peaklab.uptime-kuma
description: Use when managing Uptime Kuma monitors, status pages, or maintenance windows for PeakLab — adding, removing, pausing, resuming monitors, checking uptime, or saying "add monitor", "Uptime Kuma", "status page", "monitoring.example.com".
effort: standard
allowed-tools: Bash(python3 :*)
---

<overview>
Manage PeakLab's Uptime Kuma (v2.2.1) via the `uptime-kuma-api` Python library (socket.io). The library is installed on the monitoring server; scripts run locally and are piped to the remote host via SSH stdin. `python3` is the only Bash tool needed — `ssh` is called from within the Python subprocess.
</overview>

<constraints>
- All operations execute on `ubuntu@monitoring.example.com` — never locally
- Confirm destructive operations (delete) with user before executing
- Never hardcode credentials — load from the bootstrap block
- Always use `try/finally` to guarantee `api.disconnect()` even on exceptions
- Resolve monitor IDs via `FIND` first — never copy IDs from examples
</constraints>

<bootstrap>
Load credentials once per session, then use `run(script)` for every operation.

```python
import json, os, subprocess, sys

# Load from project .env first, then ~/.agents/.env global fallback
for _p in ['.env', os.path.expanduser('~/.agents/.env')]:
    try:
        for _line in open(_p):
            if _line.startswith('UPTIME_KUMA_') and '=' in _line:
                _k, _, _v = _line.strip().partition('=')
                os.environ.setdefault(_k.strip(), _v.strip().strip('"\''))
    except FileNotFoundError:
        pass
for _sl in ['.claude/settings.local.json', '.codex/settings.local.json',
            os.path.expanduser('~/.claude/settings.local.json'),
            os.path.expanduser('~/.codex/settings.local.json')]:
    try:
        for _k, _v in json.load(open(_sl)).get('env', {}).items():
            if _k.startswith('UPTIME_KUMA_'): os.environ.setdefault(_k, _v)
    except Exception:
        pass

SSH  = os.environ['UPTIME_KUMA_SSH']       # ubuntu@monitoring.example.com
URL  = os.environ['UPTIME_KUMA_INTERNAL']  # http://uptime-kuma.internal:3001
USER = os.environ['UPTIME_KUMA_USER']
PASS = os.environ['UPTIME_KUMA_PASS']

# json.dumps safely escapes quotes, backslashes, and special chars in credentials
_url  = json.dumps(URL)
_user = json.dumps(USER)
_pass = json.dumps(PASS)

HEADER = f"""
from uptime_kuma_api import UptimeKumaApi, MonitorType, AuthMethod
api = UptimeKumaApi({_url})
api.login({_user}, {_pass})
try:
"""
FOOTER = """
finally:
    api.disconnect()
"""

def run(script):
    # Indent user script inside the try block
    indented = '\n'.join('    ' + line for line in script.strip().splitlines())
    full = HEADER + indented + FOOTER
    r = subprocess.run(['ssh', SSH, 'python3'], input=full.encode(), capture_output=True)
    out = r.stdout.decode().strip()
    err = r.stderr.decode().strip()
    if out: print(out)
    if err: print(err, file=sys.stderr)
    if r.returncode != 0:
        raise RuntimeError(f"Remote script failed (exit {r.returncode}): {err}")
    return r.returncode
```
</bootstrap>

<operations>

## Quick Reference

| Operation | Script snippet |
|-----------|----------------|
| List monitors | `run(LIST)` |
| Find by name | `run(FIND)` |
| Add HTTP monitor | `run(ADD_HTTP)` |
| Add PORT monitor | `run(ADD_PORT)` |
| Add GROUP | `run(ADD_GROUP)` |
| Add monitor in group | `run(ADD_CHILD)` |
| Update monitor | `run(UPDATE)` |
| Delete monitor | `run(DELETE)` |
| Pause / Resume | `run(PAUSE)` / `run(RESUME)` |
| List status pages | `run(STATUS_PAGES)` |
| Add maintenance window | `run(ADD_MAINTENANCE)` |

## List all monitors

```python
LIST = """
monitors = api.get_monitors()
for m in sorted(monitors, key=lambda x: x.get('id') or 0):
    active = 'ok' if m.get('active') else 'paused'
    mtype  = str(m.get('type', '')).split('.')[-1]
    mname  = m.get('name', '?')
    parent = m.get('parent')
    line   = f"  [{str(m.get('id','?')):>3}] {active}  {mname:<35} {mtype}"
    if parent: line += f"  (parent:{parent})"
    print(line)
"""
run(LIST)
```

## Find monitor by name

```python
NAME = 'soowe'   # substring to search (case-insensitive); change before running

FIND = """
monitors = api.get_monitors()
matches = [m for m in monitors if '""" + NAME + """' in m.get('name', '').lower()]
for m in matches:
    print(m.get('id'), m.get('name'), 'active' if m.get('active') else 'paused')
"""
run(FIND)
```

## Add HTTP monitor

```python
ADD_HTTP = """
result = api.add_monitor(
    type=MonitorType.HTTP,
    name="My Service",
    url="https://example.com",
    interval=60,
    retryInterval=60,
    maxretries=3,
)
print(result)
"""
run(ADD_HTTP)
```

## Add PORT (TCP) monitor

```python
ADD_PORT = """
result = api.add_monitor(
    type=MonitorType.PORT,
    name="DB Port",
    hostname="db.example.com",
    port=5432,
    interval=60,
)
print(result)
"""
run(ADD_PORT)
```

## Add GROUP (organizer)

```python
ADD_GROUP = """
result = api.add_monitor(
    type=MonitorType.GROUP,
    name="My Project",
)
print(result)
"""
run(ADD_GROUP)
```

## Add monitor inside a group

```python
ADD_CHILD = """
result = api.add_monitor(
    type=MonitorType.HTTP,
    name="App",
    url="https://app.example.com",
    parent=<GROUP_MONITOR_ID>,   # replace with ID from FIND
    interval=60,
)
print(result)
"""
run(ADD_CHILD)
```

## Update monitor

```python
UPDATE = """
result = api.edit_monitor(
    id=<MONITOR_ID>,     # replace with ID from FIND
    interval=120,
    maxretries=5,
)
print(result)
"""
run(UPDATE)
```

## Delete monitor

```python
DELETE = """
result = api.delete_monitor(id=<MONITOR_ID>)   # replace with ID from FIND
print(result)
"""
run(DELETE)
```

## Pause / Resume

```python
PAUSE  = "result = api.pause_monitor(id=<MONITOR_ID>); print(result)"
RESUME = "result = api.resume_monitor(id=<MONITOR_ID>); print(result)"
run(PAUSE)
run(RESUME)
```

## List status pages

```python
STATUS_PAGES = """
pages = api.get_status_pages()
for p in pages:
    print(p.get('id'), p.get('title'), p.get('slug'))
"""
run(STATUS_PAGES)
```

## Add maintenance window

```python
ADD_MAINTENANCE = """
result = api.add_maintenance(
    title="Scheduled maintenance",
    strategy="single",            # single | recurring-interval | recurring-weekday | recurring-day-of-month
    active=True,
    intervalDay=1,
    dateRange=["2025-01-01 02:00", "2025-01-01 04:00"],
    timeRange=[{"hours": 2, "minutes": 0}, {"hours": 4, "minutes": 0}],
    weekdays=[],
    daysOfMonth=[],
    monitors=[<MONITOR_ID>],      # list of monitor IDs to include
)
print(result)
"""
run(ADD_MAINTENANCE)
```

## Monitor types

| Type | `MonitorType.X` | Use case |
|------|-----------------|----------|
| HTTP/HTTPS | `HTTP` | Web endpoint |
| TCP port | `PORT` | DB, SMTP, etc. |
| Ping | `PING` | Server reachability |
| Keyword | `KEYWORD` | Response body contains text |
| DNS | `DNS` | DNS resolution |
| Group | `GROUP` | Organizer (no check) |

</operations>

<gotchas>

| Trap | Fix |
|------|-----|
| `KeyError: <built-in function id>` | Use `m.get('id')` — `m['id']` shadows the Python builtin |
| Credentials with `"` or `\` | Bootstrap uses `json.dumps()` for safe escaping — never use raw f-strings with creds |
| `{m.get('id'):3}` crashes when id is None | Use `str(m.get('id','?')):>3` in format strings |
| Monitor not found | Use `FIND` before any write operation — never copy IDs from examples |
| Delete without pause | Pause first; deletion is immediate and irreversible |
| `type` field is enum | Use `MonitorType.HTTP`, not `"http"` |
| Kwarg spelling | Library uses camelCase: `retryInterval`, `maxretries`, `upsideDown` |
| `api.disconnect()` not called | Bootstrap wraps every script in `try/finally` — still verify your script doesn't exit() early |
| `uk1_xxx` API key | Only valid for `/metrics` (Prometheus Basic Auth) — not for socket.io management |

</gotchas>
