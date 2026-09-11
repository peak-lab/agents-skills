#!/usr/bin/env python3
import os, json, re, sys, time, datetime, urllib.request

def _load(path):
    try:
        for k, v in json.load(open(path)).get('env', {}).items():
            if k in ('PLANE_TOKEN', 'PLANE_PROJECT'): os.environ.setdefault(k, v)
    except Exception: pass

_load('.claude/settings.local.json')
if not (os.environ.get('PLANE_TOKEN') and os.environ.get('PLANE_PROJECT')):
    if os.path.exists('.env'):
        for line in open('.env'):
            if line.startswith('PLANE_') and '=' in line:
                k, _, v = line.strip().partition('=')
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))
if not (os.environ.get('PLANE_TOKEN') and os.environ.get('PLANE_PROJECT')):
    _load(os.path.expanduser('~/.claude/settings.local.json'))

url       = os.environ['PLANE_PROJECT']
TOKEN     = os.environ['PLANE_TOKEN']
HOST      = re.search(r'https://([^/]+)/', url).group(1)
WORKSPACE = re.search(r'https://[^/]+/([^/]+)/', url).group(1)
PROJECT_ID = re.search(r'/projects/([^/]+)/', url).group(1)
BASE      = f'https://{HOST}/api/v1'
WP        = f'/workspaces/{WORKSPACE}/projects/{PROJECT_ID}'

def api(method, path, data=None, _retry=0):
    req = urllib.request.Request(f'{BASE}{path}', method=method,
        headers={
            'x-api-key': TOKEN,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        })
    if data is not None: req.data = json.dumps(data).encode()
    try:
        raw = re.sub(r'[\x00-\x1f]', '', urllib.request.urlopen(req).read().decode())
        return json.loads(raw)
    except urllib.error.HTTPError as e:
        if e.code == 429 and _retry < 4:
            wait = 5 * (2 ** _retry)  # 5, 10, 20, 40s
            print(f"  rate limited, waiting {wait}s...")
            time.sleep(wait)
            return api(method, path, data, _retry + 1)
        raise

def results(path):
    r = api('GET', path)
    return r if isinstance(r, list) else r.get('results', [])

# Parse args
dry_run = '--dry-run' in sys.argv
days_threshold = 14  # default: archive Done issues older than 14 days
for arg in sys.argv[1:]:
    if arg.startswith('--days'):
        days_threshold = int(arg.split('=')[-1]) if '=' in arg else (int(sys.argv[sys.argv.index(arg)+1]) if sys.argv.index(arg)+1 < len(sys.argv) else 14)

PREFIX = api('GET', f'{WP}/')['identifier']
states = results(f'{WP}/states/')
done_state = next((s for s in states if s['group'] == 'completed'), None)

if not done_state:
    print("No completed state found")
    sys.exit(1)

# Fetch all done issues (deduplicated)
seen = set()
all_done = []
page = 1
while page <= 10:
    batch = results(f'{WP}/issues/?state={done_state["id"]}&per_page=100&page={page}')
    if not batch: break
    new_ids = {i['id'] for i in batch} - seen
    if not new_ids: break  # same page returned again — stop
    for i in batch:
        if i['id'] not in seen:
            seen.add(i['id'])
            all_done.append(i)
    page += 1

print(f"Found {len(all_done)} completed issues\n")

# Filter by creation date (completed_at is null in Plane — created_at is the best proxy)
cutoff = datetime.date.today() - datetime.timedelta(days=days_threshold)
to_archive = sorted(
    [i for i in all_done
     if datetime.datetime.fromisoformat(i['created_at'].replace('Z', '+00:00')).date() < cutoff],
    key=lambda x: x['created_at']
)

print(f"To archive: {len(to_archive)} (created before {cutoff})")
print(f"(Note: using created_at as proxy — completed_at is not set by Plane)\n")

# Preview or archive
if dry_run:
    for issue in to_archive[:20]:
        print(f"  {PREFIX}-{issue['sequence_id']:3} | {issue['created_at'][:10]} | {issue['name'][:60]}")
    if len(to_archive) > 20:
        print(f"  ... and {len(to_archive)-20} more")
    print(f"\nRun without --dry-run to archive.")
else:
    archived = 0
    failed = 0
    today = datetime.date.today().isoformat()
    for i, issue in enumerate(to_archive):
        try:
            api('PATCH', f'{WP}/issues/{issue["id"]}/', {'archived_at': today})
            archived += 1
            print(f"  [{i+1}/{len(to_archive)}] ✓ {PREFIX}-{issue['sequence_id']} | {issue['name'][:55]}")
        except Exception as e:
            failed += 1
            print(f"  ✗ {PREFIX}-{issue['sequence_id']}: {str(e)[:60]}")
        time.sleep(1.5)

    print(f"\n✓ Archived {archived}/{len(to_archive)}")
    if failed:
        print(f"✗ Failed: {failed}")
