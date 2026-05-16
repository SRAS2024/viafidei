# Queue-first transition — rollout plan

How to migrate the Via Fidei ingestion system from the legacy in-process
scheduler (`runAllActiveJobs()`) to the durable Postgres-backed
queue + dedicated worker model.

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
   housekeeping             ┌────────────────────┐
                            │ worker process      │
                            │ npm run worker      │
                            │ (separate service)  │
                            └────────────────────┘
```

The cron route plans and enqueues; the worker executes. Both services
share the same production Postgres database.

## Required environment variables

| Variable                      | Web | Worker | Notes                                         |
| ----------------------------- | --- | ------ | --------------------------------------------- |
| `DATABASE_URL`                | ✅  | ✅     | Same production Postgres URL.                 |
| `SESSION_SECRET`              | ✅  | ✅     | Used by the cron-auth helper.                 |
| `ADMIN_EMAIL`                 | ✅  | ✅     | Worker needs it for source-auto-pause alerts. |
| `RESEND_API_KEY`              | ✅  | ✅     | Worker emits alerts on auto-pause.            |
| `USE_DURABLE_INGESTION_QUEUE` | ✅  | —      | Default `true`. Set `false` to rollback.      |

## Railway deployment

### Web service

- Service name: `viafidei-web`
- Start command: `npm run start` (Next.js standalone server)
- Health check: `/api/health`

### Worker service

- Service name: `viafidei-worker`
- Start command: `npm run worker`
- Shares the same Postgres reference as the web service.
- Optional: set `WORKER_ID` env if you want stable worker names; the
  default is `worker-${pid}` which is fine for ephemeral instances.
- Health check: not required — the `WorkerHeartbeat` table is the
  source of truth.

Both services run from the same image (the worker uses `tsx` which
is in `devDependencies`).

## Phased rollout

### Phase 1 — Planner + dedupe, legacy still primary

- Deploy the migration `0012_queue_transition`.
- Deploy the planner + worker code with `USE_DURABLE_INGESTION_QUEUE=false`.
- Cron still calls `runAllActiveJobs()` directly. The queue layer is
  built and tested but inactive.
- Verify: admin dashboard `/admin/ingestion/queue` loads cleanly with
  zero rows; `/admin/ingestion/workers` shows zero workers.

### Phase 2 — Queue-first in staging

- Set `USE_DURABLE_INGESTION_QUEUE=true` on the staging environment.
- Start the worker service: `npm run worker`.
- Validate:
  - Cron route logs `plannerSummary` with non-zero `jobsEnqueued`.
  - Worker dashboard shows the worker as healthy.
  - Content counts grow.
  - No backed-up pending jobs (oldestPendingAge < 5 minutes under
    normal load).

### Phase 3 — Two-service production

- Deploy worker as a separate Railway service in production.
- Keep `USE_DURABLE_INGESTION_QUEUE=false` while you confirm:
  - Worker boots and writes heartbeats.
  - Worker can read every adapter the registry exposes.

### Phase 4 — Flip the flag in production

- Set `USE_DURABLE_INGESTION_QUEUE=true` in production.
- Cron stops running adapters directly. Worker becomes the only
  execution layer.
- Pre-flip checklist:
  - [ ] Worker service deployed and healthy.
  - [ ] `WorkerHeartbeat` table populated.
  - [ ] At least one planner tick has run successfully in staging.
  - [ ] `/admin/ingestion/queue` shows the expected pending count.
  - [ ] `npm run migrate:jobs-to-queue` ran on a fresh deploy
        (optional — the planner will pick up new jobs on its own,
        but the migration script seeds the queue immediately).

### Phase 5 — Monitor

- Watch `/admin/ingestion/workers`, `/admin/ingestion/queue`, and
  `/admin/ingestion/progress` for the first 24h.
- Watch admin email for `threshold_check_failed`,
  `no_worker_alive`, or `source_auto_paused` alerts.
- Verify content growth resumes the same pace as the legacy path.

### Phase 6 — Disable legacy

- Remove `USE_DURABLE_INGESTION_QUEUE` override (relies on default
  `true`).
- Optionally set the flag to `true` explicitly and pin it in
  `appConfig.ingestionQueue.enabledByDefault`.

### Phase 7 — Remove legacy code

- Mark `runAllActiveJobs()` deprecated and remove the
  `else` branch in the cron route's queue-first guard.
- Remove the legacy fallback import in
  `src/app/api/admin/ingestion/run/route.ts`.
- Drop the `USE_DURABLE_INGESTION_QUEUE` env var.

## Rollback

If anything goes wrong in production:

1. Set `USE_DURABLE_INGESTION_QUEUE=false` in the web service env.
2. Redeploy the web service. The cron route immediately reverts to
   `runAllActiveJobs()`.
3. Stop the worker service.
4. The existing queue rows stay in the database — nothing is
   deleted. When the flag is flipped back on, the worker resumes
   exactly where it left off.

Rollback never deletes queue history. The `pruneQueueHistory()` pass
only removes completed/skipped rows older than 30 days and failed
rows older than 90 days.

## Data safety checklist (before Phase 4)

- [ ] Every active `IngestionJob` row has at least one
      `IngestionJobQueue` row (run `migrate:jobs-to-queue` if not).
- [ ] Every `IngestionSource` row has a `healthState` value (set
      by the 0011 migration default `active`).
- [ ] Large catalogs (parishes, saints) have `IngestionCursor`
      rows so a worker crash doesn't restart from scratch.
- [ ] The worker has processed at least one job per content type.
- [ ] `/admin/ingestion/queue` shows status counts.
- [ ] Biweekly admin report includes the ingestion health summary
      and content management table.
- [ ] Archive cleanup uses `archivedAt` (verified by the
      `ArchiveDeletionLog` rows from the last 30 days).
- [ ] `AdminNotificationState.milestone:*` rows update even with
      `ADMIN_EMAIL` unset.
- [ ] Constant mode continues while any threshold is unmet.
- [ ] Maintenance mode only starts once every target is reached.

## Inspecting queue health

```sh
# Sanitized public view (no payload bodies)
curl https://etviafidei.com/api/health | jq '.checks.queue'

# Full admin view (admin session required)
open https://etviafidei.com/admin/ingestion/queue
open https://etviafidei.com/admin/ingestion/workers
```

## Common operations

- **Retry a failed job** — `POST /api/admin/ingestion/queue/retry`.
- **Cancel a queue row** — `POST /api/admin/ingestion/queue/cancel`.
- **Pause a source** — `POST /api/admin/ingestion/sources/pause`.
- **Pause a content type** — `POST /api/admin/ingestion/content-types/pause`.
- **Reprocess a source** — `POST /api/admin/ingestion/sources/reprocess`.
- **Revalidate a content type** — `POST /api/admin/ingestion/revalidate`.
- **Run planner now** — `POST /api/cron/ingest` with the cron auth
  header (or click "Run ingestion now" in
  `/admin/ingestion`, which calls the planner under queue-first
  mode).

## Recovering from a stuck queue

If `/admin/ingestion/workers` shows pending jobs but no healthy
worker:

1. Check the worker service status in Railway.
2. Tail the worker logs for crash messages.
3. Restart the worker service.
4. If the worker is healthy but jobs are still stuck, run
   `recoverStaleJobs()` via `POST /api/cron/ingest` — this returns
   stale-leased jobs to `pending` so the worker can pick them up.

## Recovering from no active workers

```sh
# Locally, against the production DB:
DATABASE_URL=postgresql://... npm run worker:once
```

This drains the queue once and exits. Useful for emergency
catch-up.
