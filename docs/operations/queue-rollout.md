# Queue-first ingestion — deployment and operations

How the Via Fidei ingestion system is deployed, operated, and
recovered. The queue-first transition is complete: cron plans,
worker executes, and there is no legacy fallback.

## Architecture summary

```
┌──────────────────┐         ┌────────────────────┐
│  /api/cron/ingest│ planner │ IngestionJobQueue  │
│                  ├────────►│ (Postgres)         │
│  (web service)   │         │                    │
│                  │         │                    │
└────────┬─────────┘         └─────────┬──────────┘
         │ cleanup, alerts             │ FOR UPDATE SKIP LOCKED
         │ admin emails                │
         ▼                             ▼
   housekeeping             ┌─────────────────────┐
                            │ worker process      │
                            │ npm run worker      │
                            │ (separate service)  │
                            └─────────────────────┘
```

- The cron route is plan-only. It calls
  `enqueueDueIngestionJobs()` (the planner) which writes new
  `IngestionJobQueue` rows. It never executes adapters.
- The worker service is the sole adapter executor. It leases queue
  rows with `FOR UPDATE SKIP LOCKED` so multiple workers can run
  in parallel without claiming the same row.
- Both services share the same production Postgres database.

## Required environment variables

| Variable         | Web | Worker | Notes                                        |
| ---------------- | --- | ------ | -------------------------------------------- |
| `DATABASE_URL`   | ✅  | ✅     | Same production Postgres URL.                |
| `SESSION_SECRET` | ✅  | ✅     | Used by the cron-auth helper.                |
| `ADMIN_EMAIL`    | ✅  | ✅     | Worker uses it for source-auto-pause alerts. |
| `RESEND_API_KEY` | ✅  | ✅     | Worker emits alerts on auto-pause.           |
| `ADMIN_USERNAME` | ✅  | —      | Admin login.                                 |
| `ADMIN_PASSWORD` | ✅  | —      | Admin login.                                 |

There is no `USE_DURABLE_INGESTION_QUEUE` flag. The queue-first
path is the only path.

## Railway deployment

Two services run from the same image:

### Web service (`viafidei-web`)

- Start command: `./scripts/start.sh` (Next.js standalone server).
- Health check: `/api/health` (`/api/health/live` for liveness).
- Hosts every page, every API route, and the cron entry point at
  `POST /api/cron/ingest`.

### Worker service (`viafidei-worker`)

- Start command: `npm run worker`.
- Shares the same Postgres reference as the web service.
- Optional: set a stable `WORKER_ID` env if you want predictable
  worker names; the default is `worker-${pid}`.
- Health check: not required — `WorkerHeartbeat` is the source of
  truth (admin dashboard at `/admin/ingestion/workers` shows live
  vs stale workers).

Both services run from the same Docker image. The worker uses
`tsx` which is in `devDependencies` — the production image keeps
devDependencies installed for this reason.

## CLI reference

```sh
npm run worker         # long-running worker loop
npm run worker:once    # drain queue once and exit (cron-friendly)
npm run worker:status  # one-shot CLI status snapshot
npm run migrate:jobs-to-queue  # idempotent: seed queue from active IngestionJob rows
```

## Inspecting queue health

```sh
# Sanitized public view (no payload bodies)
curl https://etviafidei.com/api/health | jq '.checks.queue'

# Local CLI snapshot
npm run worker:status

# Full admin view (admin session required)
open https://etviafidei.com/admin/ingestion/queue
open https://etviafidei.com/admin/ingestion/workers
open https://etviafidei.com/admin/ingestion/health
open https://etviafidei.com/admin/ingestion/progress
```

The cron route's `cron.completed` log line contains the planner
summary, prune counts, archive cleanup totals, alert outcomes, and
admin notification deliveries. Look for `mode=constant` with
`backlogDbError=true` to spot threshold-check failures, and
non-zero `alerts.sourceFailures` for sources flooding the retry
queue.

## Common admin operations

| Action                  | Endpoint or UI                                  |
| ----------------------- | ----------------------------------------------- |
| Retry a failed job      | `POST /api/admin/ingestion/queue/retry`         |
| Cancel a queue row      | `POST /api/admin/ingestion/queue/cancel`        |
| Pause a source          | `POST /api/admin/ingestion/sources/pause`       |
| Pause a job             | `POST /api/admin/ingestion/jobs/pause`          |
| Pause a content type    | `POST /api/admin/ingestion/content-types/pause` |
| Reprocess a source      | `POST /api/admin/ingestion/sources/reprocess`   |
| Revalidate content type | `POST /api/admin/ingestion/revalidate`          |
| Change source tier      | `POST /api/admin/ingestion/sources/tier`        |
| Review content version  | `POST /api/admin/ingestion/changes/review`      |
| Restore version         | `POST /api/admin/ingestion/changes/restore`     |
| Filter queue rows       | `GET  /api/admin/ingestion/queue/list?status=…` |

All manual actions write `AdminAuditLog` + `DataManagementLog`
rows and record the actor's username.

## Recovery procedures

### Stuck queue — pending jobs, no progress

If `/admin/ingestion/workers` shows pending jobs but no healthy
worker:

1. Check the worker service status in Railway.
2. Tail the worker logs for crash messages.
3. Restart the worker service.
4. If the worker is healthy but jobs are still stuck, hit
   `POST /api/cron/ingest` (or wait for the next tick) — the cron
   route's `recoverStaleJobs()` returns stale-leased jobs to
   `pending` so the worker picks them up.

### No active workers — emergency drain

Drain the queue once from a local shell against the production DB:

```sh
DATABASE_URL=postgresql://... npm run worker:once
```

This processes pending jobs and exits.

### Threshold check failed — DB error

The cron route fires a `threshold_check_failed` admin warning when
`getBacklogProgress()` cannot count content totals. The planner
stays in **constant mode** so ingestion does NOT silently
downgrade to maintenance. Inspect the DB connection, then watch
for the next successful tick to clear the alert.

### Auto-paused source

When a source crosses the consecutive-failure or low-quality
threshold, it is auto-paused and an admin email is sent. Resume
via the admin dashboard at `/admin/ingestion/health` or hit
`POST /api/admin/ingestion/sources/pause` with `action: "resume"`.

## Data safety checks

Run before any major maintenance window:

- [ ] `/admin/ingestion/queue` shows status counts.
- [ ] `/admin/ingestion/workers` shows ≥ 1 healthy worker.
- [ ] `/admin/ingestion/progress` shows expected content counts.
- [ ] Every active `IngestionJob` has a corresponding
      `IngestionJobQueue` entry (or one will be created on the
      next planner tick).
- [ ] Every `IngestionSource` row has a `healthState` value.
- [ ] Large catalogs (parishes, saints) have `IngestionCursor`
      rows so a worker crash doesn't restart from scratch.
- [ ] `ArchiveDeletionLog` shows recent rows from the
      `archivedAt`-based purge.
- [ ] `AdminNotificationState.milestone:*` rows update even with
      `ADMIN_EMAIL` unset (no flood when ADMIN_EMAIL is added).
- [ ] Constant mode continues while any threshold is unmet.
- [ ] Maintenance mode starts only after every target is reached.

## Interpreting queue statuses

| Status      | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| `pending`   | Waiting for a worker to lease.                                 |
| `running`   | Leased by a worker; in-flight.                                 |
| `completed` | Finished successfully. Pruned after 30 days.                   |
| `failed`    | Hit `maxAttempts`; `sentToReviewAt` set; awaits admin retry.   |
| `skipped`   | Paused source/job/content type, missing adapter, or cancelled. |
| `retrying`  | Failed once; will retry with exponential backoff.              |

## Interpreting source health statuses

| State         | Meaning                                                               |
| ------------- | --------------------------------------------------------------------- |
| `active`      | Last fetch succeeded; recent content detected.                        |
| `stale`       | Last successful fetch was OK but no content updates for 21+ days.     |
| `failing`     | 3+ consecutive failures without a successful fetch in between.        |
| `blocked`     | Last fetch returned 403/451 — admin should investigate.               |
| `exhausted`   | Adapter signalled `exhausted: true`. Skipped until maintenance probe. |
| `low_quality` | Recent items mostly REVIEW or REJECT (ratio ≥ 60%).                   |
| `paused`      | Admin or auto-pause flipped `pausedAt`.                               |

## Reading planner logs

Every cron tick emits a `cron.completed` log line with the
planner summary embedded:

```json
{
  "level": "info",
  "msg": "cron.completed",
  "durationMs": 12345,
  "plannerSummary": {
    "jobsScanned": 42,
    "jobsEnqueued": 12,
    "jobsSkippedAlreadyQueued": 30,
    "jobsSkippedSourcePaused": 0,
    "jobsSkippedJobPaused": 0,
    "jobsSkippedContentTypePaused": 0,
    "jobsSkippedSourceUnhealthy": 0,
    "jobsSkippedSourceExhausted": 0,
    "jobsSkippedDailyCap": 0,
    "jobsSkippedFillCap": 0,
    "promotedToConstant": 8,
    "assignedToMaintenance": 4,
    "mode": "constant",
    "dbError": false
  },
  "alerts": {
    "stalledGrowth": 0,
    "sourceFailures": 0,
    "lowQualitySources": 0,
    "reviewQueueLarge": false
  },
  "autoPausedSources": 0,
  "stallAlertsSent": [],
  "prunedQueueHistory": { "completed": 0, "skipped": 0, "failed": 0 }
}
```

Look for:

- `plannerSummary.dbError === true` → threshold check failed; the
  planner is in constant mode by safety guard.
- `plannerSummary.jobsSkippedSourceUnhealthy > 0` → blocked sources.
- `plannerSummary.jobsSkippedFillCap > 0` → planner hit the
  per-tick fill cap (configurable; default 200).
- `alerts.sourceFailures > 0` → repeated upstream failures.
- `stallAlertsSent` non-empty → see `docs/operations/ingestion.md`
  for the per-stall-class diagnosis.
