/**
 * Strict queue chain audit helpers.
 *
 * The factory's queue chain is:
 *
 *   discovery → fetch → source_document_created → build → strict_qa
 *     → persistence → public_gate → sitemap_refresh → dashboard_update
 *
 * Every URL/SourceDocument MUST be traceable through this chain so
 * the admin can answer: "Where did this URL stop in the pipeline?"
 *
 * The audit log lives in `QueueAuditLog` (event + metadata JSON).
 * This module is a thin typed wrapper that records the chain-stage
 * events with a stable shape and reads them back for the admin
 * dashboard's chain tracer.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import { recordQueueAudit } from "./audit";

/**
 * The canonical chain stages. Each event corresponds to one stage
 * being entered by a specific URL or SourceDocument.
 */
export type ChainStageEvent =
  | "chain.discovery_started"
  | "chain.discovery_completed"
  | "chain.discovery_url_skipped"
  | "chain.source_fetch_started"
  | "chain.source_fetch_completed"
  | "chain.source_document_created"
  | "chain.source_fetch_to_build"
  | "chain.build_enqueued"
  | "chain.build_skipped"
  | "chain.content_build_started"
  | "chain.content_build_completed"
  | "chain.content_build_terminal_reject"
  | "chain.content_build_infra_failed"
  | "chain.strict_qa_passed"
  | "chain.strict_qa_rejected"
  | "chain.persistence_started"
  | "chain.persistence_succeeded"
  | "chain.persistence_failed"
  | "chain.public_gate_passed"
  | "chain.public_gate_failed"
  | "chain.sitemap_refreshed"
  | "chain.dashboard_updated"
  | "chain.deleted_with_log";

export type RecordChainStageInput = {
  event: ChainStageEvent;
  /** Optional queue row that triggered the chain event. */
  jobQueueId?: string | null;
  /** SourceDocument id when the event is about a fetched page. */
  sourceDocumentId?: string | null;
  /** Source URL — present for every chain event. */
  sourceUrl?: string | null;
  /** Content type produced at this stage. */
  contentType?: string | null;
  /** Slug of the produced package (after build). */
  slug?: string | null;
  /** Free-form metadata payload — counts, error message, IDs, etc. */
  metadata?: Record<string, unknown>;
};

/**
 * Record one chain-stage event. Writes through to QueueAuditLog so
 * the audit page can render the chain transitions inline with the
 * regular lifecycle audit entries.
 */
export async function recordChainStage(input: RecordChainStageInput): Promise<void> {
  await recordQueueAudit({
    jobQueueId: input.jobQueueId ?? null,
    event: input.event,
    metadata: {
      sourceDocumentId: input.sourceDocumentId ?? undefined,
      sourceUrl: input.sourceUrl ?? undefined,
      contentType: input.contentType ?? undefined,
      slug: input.slug ?? undefined,
      ...(input.metadata ?? {}),
    },
  });
}

export type ChainTrace = {
  sourceUrl: string;
  sourceDocumentId: string | null;
  /** Last observed chain stage. */
  lastStage: ChainStageEvent | null;
  /** All chain events observed for this URL, oldest first. */
  events: Array<{
    event: ChainStageEvent;
    createdAt: Date;
    metadata: Record<string, unknown> | null;
  }>;
};

const CHAIN_EVENT_PREFIX = "chain.";

/**
 * Read back the chain trace for a given source URL. Returns the
 * full series of chain events recorded against the URL so the
 * admin can answer "where did this URL stop?" at a glance.
 */
export async function getChainTrace(sourceUrl: string): Promise<ChainTrace> {
  const rows = await prisma.queueAuditLog
    .findMany({
      where: {
        event: { startsWith: CHAIN_EVENT_PREFIX },
      },
      orderBy: { createdAt: "asc" },
      take: 1000,
    })
    .catch((e) => {
      logger.warn("chain-audit.read_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [] as Array<{
        id: string;
        event: string;
        metadata: Record<string, unknown> | null;
        createdAt: Date;
      }>;
    });

  let sourceDocumentId: string | null = null;
  const matches: ChainTrace["events"] = [];
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta.sourceUrl !== sourceUrl) continue;
    if (typeof meta.sourceDocumentId === "string") sourceDocumentId = meta.sourceDocumentId;
    matches.push({
      event: row.event as ChainStageEvent,
      createdAt: row.createdAt,
      metadata: meta,
    });
  }
  return {
    sourceUrl,
    sourceDocumentId,
    lastStage: matches.length > 0 ? matches[matches.length - 1]!.event : null,
    events: matches,
  };
}

/**
 * Which chain stages a URL has reached. Used by the "pipeline
 * broken here" diagnostic to flag URLs that reached one stage but
 * never the next.
 */
export function chainStagesReached(
  events: ReadonlyArray<{ event: ChainStageEvent }>,
): Set<ChainStageEvent> {
  return new Set(events.map((e) => e.event));
}
