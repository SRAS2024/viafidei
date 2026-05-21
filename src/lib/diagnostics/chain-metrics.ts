/**
 * Full pipeline chain metrics.
 *
 * Reads the chain-stage events recorded in `QueueAuditLog` (written
 * by `chain-audit.ts`) and rolls them up into one row per pipeline
 * stage so the admin can see the visual chain:
 *
 *   Discovery → Fetch → Source Document → Build → Validation
 *   Evidence → Strict QA → Persist → Public → Search → Sitemap → Cache
 *
 * Stages that are not yet wired into the chain audit are surfaced
 * honestly (`instrumented: false`) rather than faked as zero counts.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type ChainStageMetric = {
  stage: string;
  label: string;
  /** QueueAuditLog event this stage counts, or null when not instrumented. */
  event: string | null;
  count: number;
  latestAt: Date | null;
  failureCount: number;
  failureEvent: string | null;
  instrumented: boolean;
};

export type ChainMetricsReport = {
  generatedAt: Date;
  stages: ChainStageMetric[];
  /** First instrumented stage that has zero events while its upstream stage has some. */
  blockerStage: string | null;
  errors: Record<string, string>;
};

const STAGES: ReadonlyArray<{
  stage: string;
  label: string;
  event: string | null;
  failureEvent: string | null;
}> = [
  {
    stage: "discovery",
    label: "Discovery",
    event: "chain.discovery_completed",
    failureEvent: null,
  },
  { stage: "fetch", label: "Fetch", event: "chain.source_fetch_started", failureEvent: null },
  {
    stage: "source_document",
    label: "Source Document",
    event: "chain.source_document_created",
    failureEvent: null,
  },
  {
    stage: "build",
    label: "Build",
    event: "chain.content_build_completed",
    failureEvent: null,
  },
  { stage: "validation_evidence", label: "Validation Evidence", event: null, failureEvent: null },
  {
    stage: "strict_qa",
    label: "Strict QA",
    event: "chain.strict_qa_passed",
    failureEvent: "chain.strict_qa_rejected",
  },
  {
    stage: "persist",
    label: "Persist",
    event: "chain.persistence_succeeded",
    failureEvent: "chain.persistence_failed",
  },
  {
    stage: "public",
    label: "Public",
    event: "chain.public_gate_passed",
    failureEvent: "chain.public_gate_failed",
  },
  { stage: "search", label: "Search", event: null, failureEvent: null },
  { stage: "sitemap", label: "Sitemap", event: "chain.sitemap_refreshed", failureEvent: null },
  { stage: "cache", label: "Cache", event: null, failureEvent: null },
];

export async function getChainMetrics(): Promise<ChainMetricsReport> {
  const generatedAt = new Date();
  const errors: Record<string, string> = {};

  type ChainEventGroup = {
    event: string;
    _count: { _all: number };
    _max: { createdAt: Date | null };
  };
  let grouped: ChainEventGroup[] = [];
  try {
    const rows = await prisma.queueAuditLog.groupBy({
      by: ["event"],
      where: { event: { startsWith: "chain." } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    grouped = rows as ChainEventGroup[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.chainEvents = msg;
    logger.warn("chain-metrics.query_failed", { error: msg });
  }

  const byEvent = new Map<string, { count: number; latestAt: Date | null }>();
  for (const row of grouped) {
    byEvent.set(row.event, { count: row._count._all, latestAt: row._max.createdAt });
  }

  const stages: ChainStageMetric[] = STAGES.map((s) => {
    const hit = s.event ? byEvent.get(s.event) : undefined;
    const failureHit = s.failureEvent ? byEvent.get(s.failureEvent) : undefined;
    return {
      stage: s.stage,
      label: s.label,
      event: s.event,
      count: hit?.count ?? 0,
      latestAt: hit?.latestAt ?? null,
      failureCount: failureHit?.count ?? 0,
      failureEvent: s.failureEvent,
      instrumented: s.event !== null,
    };
  });

  // The blocker is the first instrumented stage with zero events whose
  // nearest instrumented upstream stage has a non-zero count.
  let blockerStage: string | null = null;
  let upstreamCount = 0;
  for (const stage of stages) {
    if (!stage.instrumented) continue;
    if (stage.count === 0 && upstreamCount > 0) {
      blockerStage = stage.stage;
      break;
    }
    upstreamCount = stage.count;
  }

  return { generatedAt, stages, blockerStage, errors };
}
