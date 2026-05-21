/**
 * Per-queue-row audit logger. Every lifecycle transition is captured
 * in QueueAuditLog so an admin can reconstruct the history of any
 * job: when it was enqueued, who triggered it, when it was leased,
 * by which worker, when it retried, when it was canceled, and so on.
 *
 * Audit writes are best-effort — a failure here never blocks the
 * surrounding state transition.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";

export type QueueAuditEvent =
  | "enqueued"
  | "leased"
  | "completed"
  | "retrying"
  | "failed"
  | "skipped"
  | "canceled"
  | "cancel_requested"
  | "paused"
  | "resumed"
  | "stale_recovered"
  | "scheduler.tick_completed"
  | "scheduler.tick_failed"
  | "chain.discovery_completed"
  | "chain.source_fetch_started"
  | "chain.source_document_created"
  | "chain.source_fetch_to_build"
  | "chain.content_build_started"
  | "chain.content_build_completed"
  | "chain.strict_qa_passed"
  | "chain.strict_qa_rejected"
  | "chain.persistence_succeeded"
  | "chain.persistence_failed"
  | "chain.public_gate_passed"
  | "chain.public_gate_failed"
  | "chain.sitemap_refreshed"
  | "chain.dashboard_updated"
  | "chain.deleted_with_log";

export type RecordQueueAuditInput = {
  jobQueueId: string | null;
  event: QueueAuditEvent;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUsername?: string | null;
  workerId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordQueueAudit(input: RecordQueueAuditInput): Promise<void> {
  try {
    await prisma.queueAuditLog.create({
      data: {
        jobQueueId: input.jobQueueId,
        event: input.event,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorUsername: input.actorUsername ?? null,
        workerId: input.workerId ?? null,
        reason: input.reason ?? null,
        metadata: (input.metadata as never) ?? undefined,
      },
    });
  } catch (e) {
    logger.warn("queue.audit.write_failed", {
      event: input.event,
      jobQueueId: input.jobQueueId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
