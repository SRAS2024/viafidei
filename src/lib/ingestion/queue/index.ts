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
  cancelJob,
  isCancelRequested,
  recoverStaleJobs,
  countQueueByStatus,
  listQueueJobs,
  retryFailedJob,
  pruneQueueHistory,
  queueLatencySnapshot,
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
  JOB_KINDS,
  PRIORITY_DEFAULTS,
  JOB_PAYLOAD_SCHEMAS,
  validatePayload,
  sanitizePayload,
  isJobKind,
  type JobKind,
  type SourceIngestPayload,
  type SourceFreshnessPayload,
  type SourceDiscoveryPayload,
  type ContentRevalidatePayload,
} from "./job-kinds";

export { recordQueueAudit, type QueueAuditEvent } from "./audit";

export { enqueueDueIngestionJobs, type PlannerSummary, type PlannerOptions } from "./planner";

export {
  writeHeartbeat,
  listWorkerHealth,
  hasHealthyWorker,
  removeHeartbeat,
  type WorkerHealthRow,
  type WorkerStatus,
} from "./heartbeat";

export {
  backoffDelayForAttempt,
  calculateRunAt,
  DEFAULT_BACKOFF_BASE_MS,
  DEFAULT_BACKOFF_MAX_MS,
  DEFAULT_BACKOFF_JITTER,
} from "./backoff";

export { processNextJob, runWorkerLoop, type WorkerOptions } from "./worker";
