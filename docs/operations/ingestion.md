# Ingestion operational runbook

How to inspect ingestion health, retry failed jobs, pause sources,
and verify content thresholds in production.

## Inspecting ingestion health

The admin console exposes three dashboards specifically for
ingestion health. All three require an authenticated admin session.

### Source health — `/admin/ingestion/health`

Shows a row per upstream source with its current health label:

| Label         | Meaning                                                           |
| ------------- | ----------------------------------------------------------------- |
| `active`      | Last fetch succeeded; recent content detected.                    |
| `stale`       | Last successful fetch was OK but no content updates for 21+ days. |
| `failing`     | 3+ consecutive failures without a successful fetch in between.    |
| `blocked`     | Last fetch returned 403/451 — admin should investigate.           |
| `exhausted`   | Adapter reports no more pages (large catalogs only).              |
| `low_quality` | Recent items mostly REVIEW or REJECT (ratio ≥ 60%).               |
| `paused`      | Admin paused the source (see "Pausing a source" below).           |

Per source you also see:

- `last ok` — most recent successful fetch.
- `last fail` — most recent failed fetch.
- `last content update` — most recent detected upstream change
  (checksum diff or new row).
- HTTP status code of the last fetch.
- Consecutive failure counter.
- Low-quality ratio (smoothed) — share of recent items that fell
  to REVIEW or REJECT.

### Content type progress — `/admin/ingestion/progress`

Shows the six tracked content buckets:

- Prayers
- Saints
- Parishes
- Church Documents
- Sacraments
- Consecrations

For each: current count, target, percent complete, last successful
ingestion timestamp, last detected upstream update, failed source
count, review queue size. The page also surfaces the scheduler's
current **CONSTANT** vs **MAINTENANCE** mode and warns when the
threshold check itself failed (DB error).

### Queue dashboard — `/admin/ingestion/queue`

Per-status counts (pending / running / completed / failed / skipped /
retrying), the list of failed jobs awaiting admin review, and the
currently-retrying jobs with their next-run timestamp.

## Retrying failed jobs

A queue row that exhausts its retry budget (`attempts ≥ maxAttempts`)
is marked `failed` and shows up on `/admin/ingestion/queue` with a
"Retry" button. Click the button to:

1. Reset `attempts` to 0.
2. Flip the row back to `pending` with `runAt = now`.
3. Tag the row `triggeredBy = "manual"` and record the admin's
   username in `actorUsername`.

The retry endpoint is also callable from CI / scripts:

```sh
curl -X POST https://etviafidei.com/api/admin/ingestion/queue/retry \
  -H "content-type: application/json" \
  -H "cookie: session=<admin-session-cookie>" \
  -d '{"jobQueueId":"clk1..."}'
```

## Reprocessing a single source

Re-enqueues every active job for a source at normal priority:

```sh
curl -X POST https://etviafidei.com/api/admin/ingestion/sources/reprocess \
  -H "content-type: application/json" \
  -H "cookie: session=<admin-session-cookie>" \
  -d '{"sourceId":"src..."}'
```

## Revalidating a content type

Runs the catalog janitor (format + clean + validate) against every
PUBLISHED row:

```sh
curl -X POST https://etviafidei.com/api/admin/ingestion/revalidate \
  -H "content-type: application/json" \
  -H "cookie: session=<admin-session-cookie>" \
  -d '{"contentType":"all"}'
```

`contentType` accepts `Prayer`, `Saint`, `MarianApparition`,
`Devotion`, `LiturgyEntry`, `SpiritualLifeGuide`, `Parish`, or
`all`.

## Pausing a source

Workers honour `IngestionSource.pausedAt`. A paused source returns
`skipped` (not `retrying`) so the retry budget is preserved.

```sh
curl -X POST https://etviafidei.com/api/admin/ingestion/sources/pause \
  -H "content-type: application/json" \
  -H "cookie: session=<admin-session-cookie>" \
  -d '{"sourceId":"src...","action":"pause","reason":"investigating low quality"}'
```

Resume with `"action":"resume"`. The audit trail records both
operations.

### Pausing a specific job

When only one job on a source is problematic, pause the job (not
the source):

```sh
curl -X POST https://etviafidei.com/api/admin/ingestion/jobs/pause \
  -H "content-type: application/json" \
  -H "cookie: session=<admin-session-cookie>" \
  -d '{"jobId":"job...","action":"pause"}'
```

### Pausing an entire content type

When every saint job (across multiple sources) is producing noise
and you want to halt Saint ingestion catalog-wide:

```sh
curl -X POST https://etviafidei.com/api/admin/ingestion/content-types/pause \
  -H "content-type: application/json" \
  -H "cookie: session=<admin-session-cookie>" \
  -d '{"contentType":"Saint","action":"pause","reason":"audit in progress"}'
```

Workers consult `ContentTypePause` before leasing and mark paused
content-type rows SKIPPED so no retry budget is spent. Resume with
`"action":"resume"`.

## Reviewing content changes

`/admin/ingestion/changes` lists every recent `ContentVersion`. For
rows marked `reviewRequired = true` (theology, saints, Church
documents, sacraments), approve / reject via the review endpoint:

```sh
curl -X POST https://etviafidei.com/api/admin/ingestion/changes/review \
  -H "content-type: application/json" \
  -H "cookie: session=<admin-session-cookie>" \
  -d '{"contentVersionId":"clk...","decision":"APPROVED","notes":"matches encyclical"}'
```

Decisions: `APPROVED`, `REJECTED`, `REVISION_REQUESTED`. APPROVED
clears the `reviewRequired` flag on the `ContentVersion` row.

## Verifying content thresholds

Two ways to check threshold progress:

1. **Admin dashboard** — `/admin/ingestion/progress` shows the
   live count and percentage per bucket. The page warns when the
   DB threshold check itself fails (the scheduler stays in
   constant mode in that case — see "Mode safety" below).
2. **Direct query** — `getBacklogProgress()` in
   `src/lib/ingestion/scheduler.ts` returns the full counts +
   targets + mode + dbError flag. The cron route logs the result on
   every tick (`cron.completed` log line, fields `mode`, `summary`,
   `backlogDbError`).

### Mode safety

The scheduler never enters **maintenance** mode if the threshold
check fails:

- If `prisma.prayer.count()` throws, the scheduler stays in
  **constant** mode and `dbError: true` is set on the progress
  result.
- A `threshold_check_failed` admin warning is sent on the first
  tick where this happens (subject to the 24h cooldown so the
  inbox isn't flooded).
- `backlogMet()` in `auto-seed.ts` returns `false` on any error so
  the in-process scheduler keeps ticking aggressively.

## Worker process

The dedicated worker is `scripts/run-worker.ts`. Run it directly
with `tsx`:

```sh
npm run worker          # long-running
npm run worker:once     # drain queue once and exit (cron-friendly)

# With options
tsx scripts/run-worker.ts --worker-id worker-A
tsx scripts/run-worker.ts --max-jobs 100 --one-shot
```

Multiple workers can run in parallel safely — the
`UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED)` claim guarantees
no two workers ever lease the same row.

### Stale job recovery

Workers reclaim their own stale leases on every iteration; the
cron route does the same on every tick. A worker that crashes
loses its in-flight job back to the queue within ~1 minute (lease
duration 10 min minus 1 min grace).

## Threshold milestone state

Threshold milestones (25 / 50 / 75 / 100 percent of each target)
are tracked in `AdminNotificationState` and **state advances even
when `ADMIN_EMAIL` is unset**. This prevents the "flood when
ADMIN_EMAIL is configured later" surprise where a freshly
configured admin email would receive every previously-crossed
milestone all at once.

If you want to re-send a specific milestone, delete the matching
row:

```sql
DELETE FROM "AdminNotificationState"
  WHERE flow = 'milestone:prayers';
```

The next cron tick will re-cross the milestone (because state was
reset) and re-send the email (if `ADMIN_EMAIL` is configured).

## Useful logs

The cron route emits a single `cron.completed` log line per tick
with everything the operator needs:

```json
{
  "level": "info",
  "msg": "cron.completed",
  "durationMs": 12345,
  "mode": "constant",
  "backlogDbError": false,
  "summary": { "totalJobs": 42, "runs": [...] },
  "staleRecovered": 0,
  "miscategorisedArchived": 0,
  "duplicatePrayersArchived": 0,
  "hardDeleted": 5,
  "janitor": { "repackaged": 0, "hardDeleted": 0, "divertedToReview": 0 },
  "alerts": { "stalledGrowth": 0, "sourceFailures": 0, "lowQualitySources": 0, "reviewQueueLarge": false },
  "adminNotifications": {
    "biweeklySent": false,
    "monthlyArchiveSent": false,
    "monthlyErrorReportSent": false,
    "milestonesSent": 0,
    "milestonesRecordedWithoutSend": 0
  }
}
```

Look for `mode === "constant"` + `backlogDbError === true` to spot
DB-error mode safety kicks; look for non-zero `alerts.sourceFailures`
to find sources flooding the retry queue.
