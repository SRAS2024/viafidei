/**
 * Post-pass intelligence (spec: "at the end of every major worker run,
 * generate a developer report ... worker request section").
 *
 * Runs after each worker pass. Supplementary and non-blocking: wrapped so
 * it can never break the loop, and a no-op when the Python brain is offline.
 * This is the periodic self-awareness + reporting layer — the pass's final
 * action was already selected by the Python brain. It:
 *   - self-inspects recent failures / blocked actions / pass outcomes and
 *     persists structured developer requests (deduped), and
 *   - computes worker-IQ metrics from the brain-call audit trail + memory.
 *
 * The richer per-decision intelligence (communion screen, duplicate gate,
 * quality scoring) lives at the decision sites themselves; this hook is
 * the periodic self-awareness + reporting layer.
 */

import type { PrismaClient } from "@prisma/client";

import {
  analyzeGraph,
  compareSources,
  inferRelationships,
  isBrainEnabled,
  scanContent,
} from "./intelligence";
import {
  applyLearningFromOutcome,
  computeIqMetrics,
  inspectAndRecordRequests,
} from "./intelligence/service";
import { recordBrainCall } from "./intelligence/store";
import { writeAdminWorkerLog } from "./logs";

/**
 * Supplementary brain analyses run once per pass (best-effort, non-blocking):
 *   - infer_relationships over recent published content, and
 *   - analyze_graph over the knowledge graph.
 * These produce scores/suggestions that TypeScript records (the brain call is
 * stored) so they appear in IQ diagnostics + the Developer Audit. They are
 * not the final-action brain — the Python brain selects the action elsewhere.
 */
async function runGraphAndRelationshipAnalysis(
  prisma: PrismaClient,
  passId: string,
): Promise<void> {
  try {
    const published = await prisma.publishedContent
      .findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        take: 12,
        select: { id: true, contentType: true, title: true },
      })
      .catch(() => [] as Array<{ id: string; contentType: string; title: string }>);
    if (published.length >= 2) {
      const nodes = published.map((p) => ({
        id: p.id,
        contentType: p.contentType,
        title: p.title,
      }));
      const env = await inferRelationships(nodes[0], nodes.slice(1), { max: 5 }).catch(() => null);
      await recordBrainCall(prisma, "infer_relationships", env, { passId }).catch(() => undefined);
    }

    const [graphNodes, graphEdges] = await Promise.all([
      prisma.adminWorkerGraphNode
        .findMany({
          take: 60,
          orderBy: { updatedAt: "desc" },
          select: { id: true, nodeType: true, label: true },
        })
        .catch(() => [] as Array<{ id: string; nodeType: string; label: string }>),
      prisma.adminWorkerGraphEdge
        .findMany({
          take: 120,
          orderBy: { updatedAt: "desc" },
          select: { fromNodeId: true, toNodeId: true, edgeType: true },
        })
        .catch(() => [] as Array<{ fromNodeId: string; toNodeId: string; edgeType: string }>),
    ]);
    if (graphNodes.length > 0) {
      const env = await analyzeGraph(
        graphNodes.map((n) => ({ id: n.id, type: n.nodeType, label: n.label })),
        graphEdges.map((e) => ({ source: e.fromNodeId, target: e.toNodeId, type: e.edgeType })),
        { maxSuggestions: 5 },
      ).catch(() => null);
      await recordBrainCall(prisma, "analyze_graph", env, { passId }).catch(() => undefined);
    }

    // Source comparison: let the brain compare recent source hosts.
    const reads = await prisma.adminWorkerSourceRead
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          sourceHost: true,
          sourceUrl: true,
          extractedText: true,
          detectedContentType: true,
        },
      })
      .catch(
        () =>
          [] as Array<{
            sourceHost: string;
            sourceUrl: string;
            extractedText: string | null;
            detectedContentType: string | null;
          }>,
      );
    if (reads.length >= 2) {
      const env = await compareSources(
        reads.map((r) => ({
          id: r.sourceHost,
          url: r.sourceUrl,
          text: (r.extractedText ?? "").slice(0, 400),
        })),
        { topic: reads[0].detectedContentType ?? undefined },
      ).catch(() => null);
      await recordBrainCall(prisma, "compare_sources", env, { passId }).catch(() => undefined);
    }

    // Content safety scan: a supplementary brain scan of a recent read's text
    // (the publish path still enforces the communion + quality gates).
    const sample = reads.find((r) => (r.extractedText ?? "").length > 0);
    if (sample) {
      const env = await scanContent((sample.extractedText ?? "").slice(0, 2000), {
        context: sample.detectedContentType ?? undefined,
      }).catch(() => null);
      await recordBrainCall(prisma, "scan_content", env, { passId }).catch(() => undefined);
    }
  } catch {
    // supplementary only — never break the pass
  }
}

async function gatherIqStats(prisma: PrismaClient): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};
  try {
    const [dupCandidates, dupPrevented, preventedBadPublishes, learningRecords, published] =
      await Promise.all([
        prisma.adminWorkerBrainCall.count({ where: { op: "detect_duplicates" } }),
        prisma.adminWorkerBrainCall.count({
          where: { op: "detect_duplicates", recommendedNextAction: "block-as-duplicate" },
        }),
        prisma.adminWorkerBrainCall.count({
          where: {
            op: { in: ["score_quality", "detect_communion_risk", "assess_source"] },
            riskLevel: { in: ["high", "critical"] },
          },
        }),
        prisma.adminWorkerMemory.count().catch(() => 0),
        prisma.publishedContent.count().catch(() => 0),
      ]);
    stats.duplicateCandidates = dupCandidates;
    stats.duplicatesPrevented = dupPrevented;
    stats.preventedBadPublishes = preventedBadPublishes;
    stats.learningRecords = learningRecords;
    stats.contentQualityNow = published; // proxy: more published content == more value delivered
  } catch {
    // leave stats partial; iqMetrics tolerates missing keys
  }
  return stats;
}

export async function runPostPassIntelligence(
  prisma: PrismaClient,
  opts: { passId: string; workerId: string },
): Promise<{ ran: boolean; developerRequests: number }> {
  if (!isBrainEnabled()) return { ran: false, developerRequests: 0 };
  try {
    const [errorLogs, blockedLogs, recentPasses] = await Promise.all([
      prisma.adminWorkerLog.findMany({
        where: { severity: { in: ["ERROR", "WARN"] } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { category: true, eventName: true, message: true },
      }),
      prisma.adminWorkerLog.findMany({
        where: { eventName: { contains: "block" } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { eventName: true, message: true },
      }),
      prisma.adminWorkerPass.findMany({
        orderBy: { startedAt: "desc" },
        take: 25,
        select: { status: true },
      }),
    ]);

    const failures = errorLogs.map((l) => ({ category: l.category, message: l.message }));
    const blocked = blockedLogs.map((l) => ({ reason: l.message }));
    const jobs = recentPasses.map((p) => ({ status: p.status }));

    const inspection = await inspectAndRecordRequests(
      prisma,
      { failures, blocked, jobs },
      { passId: opts.passId },
    );

    // Close the learning loop: turn the dominant repeated failure into a
    // learning signal that adjusts future behaviour (source ranking + memory).
    const topPattern = inspection.report?.failure_patterns?.find((p) => p.count >= 2);
    if (topPattern) {
      await applyLearningFromOutcome(
        prisma,
        { type: "failure", detail: topPattern.pattern },
        { passId: opts.passId },
      ).catch(() => undefined);
    }

    // Supplementary brain analyses: relationship inference + graph analysis.
    await runGraphAndRelationshipAnalysis(prisma, opts.passId);

    const stats = await gatherIqStats(prisma);
    const iq = await computeIqMetrics(prisma, stats, { passId: opts.passId });

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "intelligence_pass",
      message: inspection.available
        ? `Brain self-inspection: ${inspection.persisted.created} new + ${inspection.persisted.bumped} bumped developer request(s); IQ index ${iq.metrics?.iq_index ?? "n/a"}.`
        : "Intelligence brain offline this pass; used deterministic fallbacks.",
      safeMetadata: {
        available: inspection.available,
        developerRequestsCreated: inspection.persisted.created,
        developerRequestsBumped: inspection.persisted.bumped,
        repeatedPatterns: inspection.report?.summary?.repeated_patterns ?? 0,
        iqIndex: iq.metrics?.iq_index ?? null,
      },
    }).catch(() => undefined);

    return {
      ran: inspection.available,
      developerRequests: inspection.persisted.created + inspection.persisted.bumped,
    };
  } catch {
    // Intelligence must never break a worker pass.
    return { ran: false, developerRequests: 0 };
  }
}
