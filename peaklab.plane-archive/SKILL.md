---
name: "peaklab.plane-archive"
description: "Use when archiving completed Plane issues from the board, with dry-run and age threshold options using shared Plane API credentials."
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

Requires `PLANE_TOKEN` and `PLANE_PROJECT` in project `.env` or `~/.agents/.env` (see peaklab.plane-api skill).

## Behavior

- Targets only issues in the "Done/completed" state
- Filters by `created_at` (Plane does not set `completed_at`, so creation date is the proxy)
- Default threshold: 14 days
- Deduplicates paginated results to avoid double-archiving
- Rate limiting: 1.5s delay between requests + exponential backoff on 429 (5→10→20→40s)
- Reports count of archived issues
