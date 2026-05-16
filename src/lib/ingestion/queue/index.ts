/**
 * Durable Postgres-backed ingestion job queue.
 *
 * Replaces the in-process scheduler with a persistent queue that
 * survives restarts, deploys, crashes, and timeouts. A worker process
 * (separate from the web server) leases pending jobs, executes them,
 * and either marks them completed or schedules a retry with
 * exponential backoff.
 *
 * Lifecycle:
 *   pending → running → completed
 *                     → failed (terminal — sent to admin review)
 *                     → skipped (terminal — content paused / no adapter)
 *                     → retrying → pending (when lease released after a
 *                                  recoverable error)
 *
 * Priority: lower numbers run first. Unmet content thresholds enqueue
 * jobs with priority 10–50; maintenance refreshes get 200+.
 */

export {
  enqueueJob,
  enqueueJobs,
  leaseNextJob,
  releaseLease,
  completeJob,
  failJob,
  skipJob,
  recoverStaleJobs,
  countQueueByStatus,
  listQueueJobs,
  retryFailedJob,
  countFailedNeedingReview,
  type EnqueueJobInput,
  type QueueJobRow,
  type LeaseOptions,
  type QueueStatus,
  PRIORITY_CONTENT_THRESHOLD_UNMET,
  PRIORITY_NORMAL,
  PRIORITY_MAINTENANCE,
  DEFAULT_LEASE_DURATION_MS,
  DEFAULT_STALE_LEASE_GRACE_MS,
} from "./queue";

export {
  backoffDelayForAttempt,
  calculateRunAt,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
  DEFAULT_BACKOFF_JITTER,
} from "./backoff";

export { processNextJob, runWorkerLoop, type WorkerOptions } from "./worker";
