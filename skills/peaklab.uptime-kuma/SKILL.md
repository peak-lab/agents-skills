---
name: peaklab.uptime-kuma
description: "Manage PeakLab Uptime Kuma monitors, status pages and maintenance windows, or inspect uptime."
effort: standard
allowed-tools: Bash(python3 :*)
---

<overview>
Manage PeakLab's Uptime Kuma (v2.2.1) via the `uptime-kuma-api` Python library (socket.io). The library is installed on the monitoring server; scripts run locally and are piped to the remote host via SSH stdin. Set `UPTIME_KUMA_PYTHON` to the remote venv interpreter when the library is not installed for the default `python3`. `python3` is the only Bash tool needed — `ssh` is called from within the Python subprocess.
</overview>

<constraints>
- All operations execute on the monitoring host over SSH (`UPTIME_KUMA_SSH`) — never locally
- Confirm destructive operations (delete, pause, maintenance windows) with the user before executing
- Never hardcode credentials — load them with the bootstrap block; source precedence belongs to
  [peaklab.infra-config](../peaklab.infra-config/SKILL.md#credential-sources). Never print `UPTIME_KUMA_PASS`
- Resolve monitor IDs via `FIND` before any write — never copy IDs from examples
</constraints>

<bootstrap>
Load credentials once per session, then use `run(script)` for every operation.

```python
import json, os, shlex, subprocess, sys

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

SSH  = os.environ['UPTIME_KUMA_SSH']       # user@monitoring-host
URL  = os.environ['UPTIME_KUMA_INTERNAL']  # internal Uptime Kuma URL
USER = os.environ['UPTIME_KUMA_USER']
PASS = os.environ['UPTIME_KUMA_PASS']
PY   = os.environ.get('UPTIME_KUMA_PYTHON', 'python3')

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
    indented = '\n'.join('    ' + line for line in script.strip().splitlines())
    full = HEADER + indented + FOOTER
    r = subprocess.run(['ssh', SSH, shlex.quote(PY)], input=full.encode(), capture_output=True)
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

Every snippet below is a string passed to `run(...)`.

## List all monitors

```python
LIST = """
monitors = api.get_monitors()
for m in sorted(monitors, key=lambda x: x.get('id') or 0):
    active = 'ok' if m.get('active') else 'paused'
    mtype  = str(m.get('type', '')).split('.')[-1]
    line   = f"  [{str(m.get('id','?')):>3}] {active}  {m.get('name', '?'):<35} {mtype}"
    if m.get('parent'): line += f"  (parent:{m.get('parent')})"
    print(line)
"""
run(LIST)
```

## Find monitor by name

```python
NAME = 'soowe'   # substring to search (case-insensitive); change before running

FIND = """
monitors = api.get_monitors()
matches = [m for m in monitors if """ + repr(NAME.lower()) + """ in m.get('name', '').lower()]
for m in matches:
    print(m.get('id'), m.get('name'), 'active' if m.get('active') else 'paused')
"""
run(FIND)
```

## Add, update, delete

```python
ADD = """
print(api.add_monitor(type=MonitorType.HTTP, name="My Service", url="https://example.com",
                      interval=60, retryInterval=60, maxretries=3))
"""
# PORT: type=MonitorType.PORT, hostname=..., port=5432
# GROUP: type=MonitorType.GROUP, name=... (organizer, no check)
# Child of a group: add parent=<GROUP_MONITOR_ID> from FIND
UPDATE = "print(api.edit_monitor(id=<MONITOR_ID>, interval=120, maxretries=5))"
DELETE = "print(api.delete_monitor(id=<MONITOR_ID>))"   # confirm first; pause before deleting
run(ADD)
```

## Pause / Resume

```python
PAUSE  = "print(api.pause_monitor(id=<MONITOR_ID>))"
RESUME = "print(api.resume_monitor(id=<MONITOR_ID>))"
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
run(ADD_MAINTENANCE)   # after user confirmation
```

Other types: `MonitorType.PING`, `KEYWORD` (body contains text), `DNS`.

</operations>

<gotchas>

| Trap | Fix |
|------|-----|
| `KeyError` / `None` formatting on `id` | Use `m.get('id')` and `str(m.get('id','?')):>3` |
| Credentials with `"` or `\` | Bootstrap uses `json.dumps()` — never raw f-strings with creds |
| Delete without pause | Pause first; deletion is immediate and irreversible |
| `type` field is enum | Use `MonitorType.HTTP`, not `"http"` |
| Kwarg spelling | Library uses camelCase: `retryInterval`, `maxretries`, `upsideDown` |
| Script exits early | Bootstrap wraps scripts in `try/finally`; do not `exit()` inside them |
| `uk1_xxx` API key | Only valid for `/metrics` (Prometheus Basic Auth) — not for socket.io management |

</gotchas>
