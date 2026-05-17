/**
 * Automatic content_revalidate enqueue helpers. These hooks make the
 * cleanup loop fully automatic — admin manual intervention becomes
 * optional, not required.
 *
 * Trigger points:
 *
 *   - `autoEnqueuePostIngestionCleanup` — called from the worker
 *     after a successful source_ingest job. Enqueues a low-priority
 *     content_revalidate scoped to the content type just ingested.
 *   - `autoEnqueueScheduledCleanup`     — called by the planner on a
 *     cadence so the catalog never drifts even when no ingestion is
 *     happening.
 *   - `autoEnqueueRenderGateCleanup`    — called by the public render
 *     gate when a slug page hits an invalid row. Enqueues a targeted
 *     cleanup so the bad row is removed within seconds.
 *   - `autoEnqueueContractVersionCleanup` — called once at startup if
 *     the configured packageContractVersion does not match the
 *     dataManagementLog's last-known sweep version; ensures every row
 *     is re-validated after a contract bump.
 *   - `autoEnqueueRejectionSpikeCleanup` — called when the
 *     rejection-rate alert fires; pre-empts an extra sweep so the
 *     bad rows do not pile up.
 *
 * Every helper dedupes by a stable key so a flurry of triggers does
 * not flood the queue.
 */

import { logger } from "../../observability/logger";
import { enqueueJob } from "./queue";
import { PRIORITY_MAINTENANCE, PRIORITY_NORMAL } from "./queue";

const DEDUPE_PREFIX = "auto_cleanup";

export type AutoCleanupTrigger =
  | "post_ingestion"
  | "scheduled"
  | "render_gate"
  | "package_version_change"
  | "rejection_spike"
  | "growth_stall"
  | "manual";

function buildDedupeKey(args: {
  trigger: AutoCleanupTrigger;
  contentType?: string | null;
}): string {
  const ct = args.contentType ?? "all";
  // Bucket by 5-minute slot so consecutive triggers collapse without
  // permanently blocking new ones.
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `${DEDUPE_PREFIX}:${args.trigger}:${ct}:${bucket}`;
}

/**
 * Enqueue a content_revalidate immediately after a successful
 * source_ingest. Scoped to the ingested content type. Dedupes within
 * a 5-minute window so a burst of source_ingest jobs only fires one
 * cleanup.
 */
export async function autoEnqueuePostIngestionCleanup(args: {
  sourceId?: string | null;
  contentType?: string | null;
  workerJobId?: string | null;
}): Promise<void> {
  await enqueueJob({
    jobName: "content_revalidate",
    jobKind: "content_revalidate",
    dedupeKey: buildDedupeKey({ trigger: "post_ingestion", contentType: args.contentType }),
    sourceId: args.sourceId ?? null,
    contentType: args.contentType ?? null,
    priority: PRIORITY_MAINTENANCE,
    payload: {
      sweepReason: "post_ingestion",
      triggeredBy: "automatic",
      sourceId: args.sourceId ?? null,
      contentType: args.contentType ?? null,
      workerJobId: args.workerJobId ?? null,
    },
    triggeredBy: "automatic",
  });
}

/**
 * Enqueue a content_revalidate as a scheduled keep-the-catalog-clean
 * task. Should be called by the planner on the
 * `appConfig.contentQA.scheduledCleanupIntervalMs` cadence.
 */
export async function autoEnqueueScheduledCleanup(): Promise<void> {
  await enqueueJob({
    jobName: "content_revalidate",
    jobKind: "content_revalidate",
    dedupeKey: buildDedupeKey({ trigger: "scheduled" }),
    priority: PRIORITY_MAINTENANCE,
    payload: { sweepReason: "scheduled", triggeredBy: "automatic" },
    triggeredBy: "automatic",
  });
}

/**
 * Enqueue a targeted cleanup when the public render gate blocks a
 * page. The row that caused the 404 is logged at the call site; this
 * just kicks the cleanup loop so a subsequent visit no longer hits
 * the bad row.
 */
export async function autoEnqueueRenderGateCleanup(args: {
  contentType: string;
  slug: string;
}): Promise<void> {
  logger.info("public.render_gate.cleanup_enqueued", {
    contentType: args.contentType,
    slug: args.slug,
  });
  await enqueueJob({
    jobName: "content_revalidate",
    jobKind: "content_revalidate",
    dedupeKey: buildDedupeKey({ trigger: "render_gate", contentType: args.contentType }),
    contentType: args.contentType,
    priority: PRIORITY_NORMAL,
    payload: {
      sweepReason: "render_gate",
      triggeredBy: "automatic",
      contentType: args.contentType,
      slug: args.slug,
    },
    triggeredBy: "automatic",
  });
}

/**
 * Enqueue a full cleanup after a package contract version bump. The
 * loop will re-validate every row against the new contract; failing
 * rows are deleted with a `package_version_change` sweep reason.
 */
export async function autoEnqueueContractVersionCleanup(args: {
  previousVersion: string | null;
  newVersion: string;
}): Promise<void> {
  await enqueueJob({
    jobName: "content_revalidate",
    jobKind: "content_revalidate",
    dedupeKey: buildDedupeKey({ trigger: "package_version_change" }),
    priority: PRIORITY_NORMAL,
    payload: {
      sweepReason: "package_version_change",
      triggeredBy: "automatic",
      previousVersion: args.previousVersion,
      newVersion: args.newVersion,
    },
    triggeredBy: "automatic",
  });
}

/**
 * Enqueue a cleanup after a rejection-rate spike. Lets the loop catch
 * a wave of newly broken rows quickly.
 */
export async function autoEnqueueRejectionSpikeCleanup(args: {
  windowMinutes: number;
  spikeFactor: number;
}): Promise<void> {
  await enqueueJob({
    jobName: "content_revalidate",
    jobKind: "content_revalidate",
    dedupeKey: buildDedupeKey({ trigger: "rejection_spike" }),
    priority: PRIORITY_NORMAL,
    payload: {
      sweepReason: "rejection_spike",
      triggeredBy: "automatic",
      windowMinutes: args.windowMinutes,
      spikeFactor: args.spikeFactor,
    },
    triggeredBy: "automatic",
  });
}
