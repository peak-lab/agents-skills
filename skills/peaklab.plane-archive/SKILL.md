---
name: "peaklab.plane-archive"
description: "Archive completed Plane issues using a dry run and an age threshold."
effort: fast
argument-hint: "[--dry-run] [--days N]"
---

# peaklab.plane-archive

Archive completed Plane issues to clean up the board.

## Usage

```bash
/peaklab.plane-archive              # Archive Done issues created > 14 days ago (default)
/peaklab.plane-archive --dry-run    # Preview what would be archived
/peaklab.plane-archive --days 30    # Archive only issues created > 30 days ago
```

## Configuration

Load [peaklab.plane-api](../peaklab.plane-api/SKILL.md) for its shared client and atomic
configuration. It resolves `PLANE_TOKEN` and `PLANE_PROJECT` from the configured project/global
sources; do not implement another credential loader here.

## Behavior

- Targets only issues in the "Done/completed" state
- Filters by `created_at` (Plane does not set `completed_at`, so creation date is the proxy)
- Default threshold: 14 days
- Deduplicates paginated results to avoid double-archiving
- Rate limiting: 1.5s delay between requests + exponential backoff on 429 (5→10→20→40s)
- Reports count of archived issues
