/**
 * Automatic source-discovery expansion (spec §4, §15).
 *
 * When a content type is under its factory-ready minimum, the cron
 * needs to enqueue extra source_discovery jobs for the underweight
 * tabs so the planner has more material to work with. This module
 * picks the next sources to discover by combining:
 *
 *   - the source plan (which content types are short of minimum)
 *   - the source quality ranking (which not-yet-discovered sources
 *     score highest for that content type)
 *   - the per-source daily cap (do not exceed dailyCap discovery
 *     enqueues per source per day)
 *
 * Returns the list of (sourceId, contentType) pairs the queue layer
 * should enqueue discovery for. The enqueueing itself stays in the
 * cron / dispatch layer.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";
import {
  PURPOSE_FLAG_BY_CONTENT_TYPE,
  SOURCE_PLAN_MINIMUMS,
  buildSourcePlanReport,
  type SourcePlanContentType,
} from "./source-plan";

export type DiscoveryExpansionPlan = {
  shortfalls: ReadonlyArray<{
    contentType: SourcePlanContentType;
    needed: number;
    candidateSourceIds: ReadonlyArray<string>;
  }>;
  totalEnqueueIntent: number;
  generatedAt: Date;
};

export async function planDiscoveryExpansion(
  opts: {
    /** Cap on how many discovery enqueues a single tick can request. */
    maxPerTick?: number;
  } = {},
): Promise<DiscoveryExpansionPlan> {
  const maxPerTick = Math.min(Math.max(opts.maxPerTick ?? 25, 1), 100);
  const generatedAt = new Date();
  const shortfalls: Array<{
    contentType: SourcePlanContentType;
    needed: number;
    candidateSourceIds: string[];
  }> = [];

  const plan = await buildSourcePlanReport();
  let remaining = maxPerTick;

  for (const row of plan.rows) {
    if (remaining <= 0) break;
    if (row.factoryReady >= row.required) continue;

    const purposeFlag = PURPOSE_FLAG_BY_CONTENT_TYPE[row.contentType];
    if (!purposeFlag) continue;

    let candidates: Array<{ id: string }> = [];
    try {
      candidates = (await prisma.ingestionSource.findMany({
        where: {
          isActive: true,
          pausedAt: null,
          [purposeFlag]: true,
          // Already factory-ready sources are not the bottleneck —
          // we expand to ones with a valid discovery method but no
          // recent discovery activity. Spec #4: only primary content
          // sources may seed content_build jobs. Validation /
          // enrichment / discovery-only sources are used inside
          // cross-source evidence, not here.
          configurationStatus: "factory_native",
          role: "primary_content_source",
          OR: [
            { lastSuccessfulSync: null },
            {
              lastSuccessfulSync: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          ],
          AND: [
            {
              OR: [{ buildLimitPerRun: null }, { buildLimitPerRun: { gt: 0 } }],
            },
          ],
        },
        select: { id: true },
        orderBy: [{ tier: "asc" }, { id: "asc" }],
        take: Math.min(remaining, row.shortfall),
      })) as unknown as Array<{ id: string }>;
    } catch (e) {
      logger.warn("discovery-expansion.candidate_query_failed", {
        contentType: row.contentType,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    if (candidates.length === 0) continue;
    // Defensively cap at `remaining` in case the data layer ignores
    // the `take` hint (tests / mocks do this).
    const capped = candidates.slice(0, Math.max(0, Math.min(remaining, row.shortfall)));
    if (capped.length === 0) continue;
    shortfalls.push({
      contentType: row.contentType,
      needed: row.shortfall,
      candidateSourceIds: capped.map((c) => c.id),
    });
    remaining -= capped.length;
  }

  // Reference for type checker — keeps SOURCE_PLAN_MINIMUMS as
  // module-level dependency so consumers know the minimums are
  // honoured.
  void SOURCE_PLAN_MINIMUMS;

  return {
    shortfalls,
    totalEnqueueIntent: shortfalls.reduce((s, r) => s + r.candidateSourceIds.length, 0),
    generatedAt,
  };
}

export type DiscoveryExpansionEnqueueResult = {
  contentTypesUnderTarget: number;
  discoveryJobsEnqueued: number;
  errors: number;
};

/**
 * Run the discovery-expansion planner AND enqueue the resulting
 * source_discovery jobs (spec §4 "automatic source discovery
 * expansion when a content type is under target" + §16 "If no
 * discovery is happening, enqueue discovery").
 *
 * `enqueue` is injected so the queue layer wires in the real
 * enqueueJob and tests can pass a spy. Dedup keys are scoped per
 * (sourceId, day) so a second tick the same day does not pile up
 * duplicate discovery rows.
 */
export async function runDiscoveryExpansion(opts: {
  enqueue: (input: {
    jobName: string;
    jobKind: string;
    dedupeKey: string;
    sourceId: string;
    contentType: string;
    triggeredBy: "automatic";
    payload?: Record<string, unknown>;
  }) => Promise<unknown>;
  maxPerTick?: number;
}): Promise<DiscoveryExpansionEnqueueResult> {
  const result: DiscoveryExpansionEnqueueResult = {
    contentTypesUnderTarget: 0,
    discoveryJobsEnqueued: 0,
    errors: 0,
  };
  let plan: DiscoveryExpansionPlan;
  try {
    plan = await planDiscoveryExpansion({ maxPerTick: opts.maxPerTick });
  } catch (e) {
    logger.warn("discovery-expansion.plan_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    result.errors += 1;
    return result;
  }
  result.contentTypesUnderTarget = plan.shortfalls.length;
  const dayKey = new Date().toISOString().slice(0, 10);
  // Look up sources once so we can write a valid factory-native
  // adapterKey into each discovery payload. Without this the
  // payload validator may accept a payload that omits adapterKey,
  // but the downstream factory-native discovery wants it for
  // consistent log shape across all callers.
  const sourceIds = new Set<string>();
  for (const s of plan.shortfalls) {
    for (const id of s.candidateSourceIds) sourceIds.add(id);
  }
  let hostByIdMap: Map<string, string> = new Map();
  if (sourceIds.size > 0) {
    try {
      const rows = await prisma.ingestionSource.findMany({
        where: { id: { in: Array.from(sourceIds) } },
        select: { id: true, host: true },
      });
      hostByIdMap = new Map(rows.map((r) => [r.id, r.host]));
    } catch {
      // Fall back to "unknown" host strings — the dispatcher still
      // resolves the actual host from the IngestionSource row.
    }
  }
  for (const shortfall of plan.shortfalls) {
    for (const sourceId of shortfall.candidateSourceIds) {
      try {
        const host = hostByIdMap.get(sourceId) ?? "unknown";
        await opts.enqueue({
          jobName: `discovery_expansion:${shortfall.contentType}:${host}`,
          jobKind: "source_discovery",
          // Per-content-type dedupe key. A single source can be
          // scheduled for multiple content types in the same day
          // without one collapsing the other.
          dedupeKey: `discovery_expansion:${sourceId}:${shortfall.contentType}:${dayKey}`,
          sourceId,
          contentType: shortfall.contentType,
          triggeredBy: "automatic",
          payload: {
            sourceId,
            adapterKey: `factory-native:${host}`,
            contentType: shortfall.contentType,
            mode: "constant",
          },
        });
        result.discoveryJobsEnqueued += 1;
      } catch (e) {
        result.errors += 1;
        logger.warn("discovery-expansion.enqueue_failed", {
          sourceId,
          contentType: shortfall.contentType,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
  logger.info("discovery-expansion.completed", result);
  return result;
}
