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
import { recordBrainCall, recordDeveloperRequests } from "./intelligence/store";
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

/**
 * Reflection pass: the brain explains the real final decision it made this pass
 * (so the dashboard's self-explanations are live, not synthetic) and converts
 * recurring failures into ranked test-gap → regression-test developer requests.
 * Advisory + fail-open; records every brain call.
 */
async function runBrainReflection(
  prisma: PrismaClient,
  passId: string,
  failures: Array<{ category: string; message: string }>,
): Promise<void> {
  try {
    const { explainDecision, explainWhatWouldChangeMyMind, detectTestGap, rankMissingTests } =
      await import("./intelligence");

    // 1. Explain the actual final decision + what would change the brain's mind.
    const lastDecision = await prisma.adminWorkerDecision
      .findFirst({
        where: { decisionType: "brain_pass" },
        orderBy: { createdAt: "desc" },
        select: { missionStage: true, chosenAction: true, reason: true, confidence: true },
      })
      .catch(() => null);
    if (lastDecision) {
      const [explEnv, mindEnv] = await Promise.all([
        explainDecision({
          selectedAction: lastDecision.chosenAction,
          missionStage: lastDecision.missionStage ?? "UNKNOWN",
          reasoning: lastDecision.reason ?? "",
          confidenceScore: lastDecision.confidence,
        }),
        explainWhatWouldChangeMyMind({
          decision: lastDecision.chosenAction,
          deciding_factors: ["source authority", "duplicate score", "stage success rate"],
        }),
      ]);
      await Promise.all([
        recordBrainCall(prisma, "explain_decision", explEnv, { passId }),
        recordBrainCall(prisma, "explain_what_would_change_my_mind", mindEnv, { passId }),
      ]);
    }

    // 2. Test-gap detection from recurring failures → regression-test requests.
    if (failures.length > 0) {
      const gapEnv = await detectTestGap({
        failures: failures as unknown as Array<Record<string, unknown>>,
      });
      await recordBrainCall(prisma, "detect_test_gap", gapEnv, { passId });
      const gaps =
        (
          gapEnv?.result as {
            test_gaps?: Array<{ failure_kind: string; occurrences: number; missing_test: string }>;
          } | null
        )?.test_gaps ?? [];
      if (gaps.length > 0) {
        const rankEnv = await rankMissingTests(gaps as Array<Record<string, unknown>>);
        await recordBrainCall(prisma, "rank_missing_tests", rankEnv, { passId });
        await recordDeveloperRequests(
          prisma,
          gaps.slice(0, 5).map((g) => ({
            kind: "code" as const,
            title: `Add ${g.missing_test}`,
            detail: `Recurring ${g.failure_kind} failures (×${g.occurrences}) lack a regression test.`,
            severity: (g.occurrences >= 4 ? "high" : "medium") as "high" | "medium" | "low",
            evidence: `${g.failure_kind} ×${g.occurrences}`,
          })),
          "test_gaps",
        );
        // Durable test-gap records (Postgres owns test-gap records).
        for (const g of gaps) {
          await prisma.adminWorkerTestGapRecord
            .upsert({
              where: { failureKind: g.failure_kind },
              create: {
                failureKind: g.failure_kind,
                missingTest: g.missing_test,
                occurrences: g.occurrences,
              },
              update: { missingTest: g.missing_test, occurrences: g.occurrences, status: "OPEN" },
            })
            .catch(() => undefined);
        }
      }
    }
  } catch {
    // reflection is advisory — never break the pass
  }
}

/** Capability families → the brain ops that implement them (shared with the dashboard view). */
const CAPABILITY_FAMILIES: Array<{ name: string; ops: string[] }> = [
  { name: "Final action selection", ops: ["select_action", "compare_counterfactual_actions"] },
  { name: "Duplicate detection", ops: ["detect_duplicates"] },
  {
    name: "Source + communion intelligence",
    ops: [
      "assess_source",
      "detect_communion_risk",
      "compare_sources",
      "rank_catholic_source_authority",
    ],
  },
  {
    name: "Claim verification",
    ops: ["extract_claims", "compare_claims", "resolve_claim_with_authority"],
  },
  { name: "Quality + specialist review", ops: ["score_quality", "specialist_reviews"] },
  { name: "Repair intelligence", ops: ["classify_failure", "diagnose_fetch"] },
  {
    name: "Self-model + code awareness",
    ops: [
      "build_self_model",
      "ingest_codebase",
      "build_call_graph",
      "find_weak_modules",
      "rank_self_upgrades",
    ],
  },
  {
    name: "Mission control",
    ops: ["build_mission_tree", "rank_subgoals", "recommend_next_mission_action"],
  },
  {
    name: "Catholic extraction",
    ops: ["identify_document_type", "extract_structured_catholic_document"],
  },
  {
    name: "Replay + resilience",
    ops: [
      "compare_decisions",
      "detect_decision_drift",
      "check_replay_integrity",
      "recommend_circuit_break",
    ],
  },
];

/**
 * Persist capability scores + calibration history to their dedicated Postgres
 * tables (spec: "Postgres should own Capability scores, Calibration history").
 * Capability status/confidence/failures per family come from the brain-call
 * audit; calibration compares each family's avg confidence (predicted) against
 * its ok-rate (actual) and records whether it is calibrated.
 */
async function persistCapabilityAndCalibration(prisma: PrismaClient): Promise<void> {
  try {
    const byOp = (await prisma.adminWorkerBrainCall
      .groupBy({ by: ["op"], _count: { _all: true }, _avg: { confidence: true } })
      .catch(() => [])) as Array<{
      op: string;
      _count: { _all: number };
      _avg: { confidence: number | null };
    }>;
    const byOpOk = (await prisma.adminWorkerBrainCall
      .groupBy({ by: ["op", "ok"], _count: { _all: true } })
      .catch(() => [])) as Array<{ op: string; ok: boolean; _count: { _all: number } }>;
    const conf = new Map(
      byOp.map((r) => [r.op, { calls: r._count._all, confidence: r._avg.confidence ?? 0 }]),
    );
    const okByOp = new Map<string, number>();
    for (const r of byOpOk) if (r.ok) okByOp.set(r.op, (okByOp.get(r.op) ?? 0) + r._count._all);

    for (const fam of CAPABILITY_FAMILIES) {
      let calls = 0;
      let ok = 0;
      let confWeighted = 0;
      for (const op of fam.ops) {
        const c = conf.get(op);
        if (c) {
          calls += c.calls;
          confWeighted += c.confidence * c.calls;
        }
        ok += okByOp.get(op) ?? 0;
      }
      if (calls === 0) continue;
      const failures = Math.max(0, calls - ok);
      const okRate = ok / calls;
      const confidence = confWeighted / calls;
      const status =
        okRate >= 0.95 && failures === 0 ? "healthy" : okRate >= 0.8 ? "watch" : "degraded";
      await prisma.adminWorkerCapabilityScore
        .upsert({
          where: { capability: fam.name },
          create: { capability: fam.name, status, calls, failures, confidence },
          update: { status, calls, failures, confidence },
        })
        .catch(() => undefined);

      // Calibration history: predicted (avg confidence) vs actual (ok-rate).
      const gap = confidence - okRate;
      await prisma.adminWorkerCalibrationHistory
        .create({
          data: {
            op: fam.name,
            predicted: Number(confidence.toFixed(4)),
            actual: Number(okRate.toFixed(4)),
            sampleSize: calls,
            calibrated: Math.abs(gap) <= 0.1,
            gapDirection:
              gap > 0.1 ? "overconfident" : gap < -0.1 ? "underconfident" : "calibrated",
          },
        })
        .catch(() => undefined);
    }
  } catch {
    // capability/calibration persistence is advisory — never break the pass
  }
}

/**
 * Replay & resilience pass: the brain reasons over the event-sourced record in
 * Postgres — comparing the last two decisions and explaining any change,
 * detecting decision drift, checking stored brain-output integrity, and
 * recommending a per-stage circuit break for the worst-performing stage.
 * Advisory + fail-open; records every brain call.
 */
async function runReplayResilience(prisma: PrismaClient, passId: string): Promise<void> {
  try {
    const { compareDecisions, explainDecisionChange, checkReplayIntegrity, recommendCircuitBreak } =
      await import("./intelligence");
    const { replayLastPass, replayRecentPasses } = await import("./replay-runner");

    // 0. Replay the last pass + replay the last 50 passes in simulation
    //    (event-sourced, read-only). replayRecentPasses also runs decision-drift.
    await replayLastPass(prisma, { passId });
    await replayRecentPasses(prisma, 50, { passId });

    // 1. Compare the last two decisions; explain the change if any.
    const recent = await prisma.adminWorkerDecision
      .findMany({
        where: { decisionType: "brain_pass" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { missionStage: true, chosenAction: true, confidence: true },
      })
      .catch(
        () =>
          [] as Array<{ missionStage: string | null; chosenAction: string; confidence: number }>,
      );
    if (recent.length >= 2) {
      const [curr, prev] = recent;
      const cmpEnv = await compareDecisions(
        {
          missionStage: prev.missionStage ?? "",
          chosenAction: prev.chosenAction,
          confidence: prev.confidence,
        },
        {
          missionStage: curr.missionStage ?? "",
          chosenAction: curr.chosenAction,
          confidence: curr.confidence,
        },
      );
      await recordBrainCall(prisma, "compare_decisions", cmpEnv, { passId });
      if ((cmpEnv?.result as { changed?: boolean } | null)?.changed) {
        const expEnv = await explainDecisionChange({
          previous: { missionStage: prev.missionStage ?? "", confidence: prev.confidence },
          current: { missionStage: curr.missionStage ?? "", confidence: curr.confidence },
        });
        await recordBrainCall(prisma, "explain_decision_change", expEnv, { passId });
      }
    }

    // 2. Replay-integrity / corruption check over recent stored brain output.
    const calls = await prisma.adminWorkerBrainCall
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          ok: true,
          confidence: true,
          riskLevel: true,
          recommendedNextAction: true,
          safeToAutoExecute: true,
          reasoning: true,
          error: true,
        },
      })
      .catch(() => []);
    if (calls.length > 0) {
      const records = calls.map((c) => ({
        ok: c.ok,
        result: {},
        confidence: c.confidence,
        reasoning: c.reasoning ?? "",
        evidence: [],
        sources_used: [],
        risk_level: c.riskLevel,
        recommended_next_action: c.recommendedNextAction ?? "",
        safe_to_auto_execute: c.safeToAutoExecute,
        error: c.error,
      }));
      const intEnv = await checkReplayIntegrity(records);
      await recordBrainCall(prisma, "check_replay_integrity", intEnv, { passId });
    }

    // 4. Per-stage circuit breaker on the worst-performing stage.
    const { summarizeStageReliability } = await import("./stage-outcomes");
    const stages = await summarizeStageReliability(prisma, { sinceHours: 48 }).catch(() => []);
    const worst = stages
      .filter((s) => s.total >= 3)
      .sort((a, b) => a.successRate - b.successRate)[0];
    if (worst && worst.successRate < 0.5) {
      const cbEnv = await recommendCircuitBreak({
        scope: "stage",
        key: worst.stage,
        attempts: worst.total,
        failures: worst.failures,
      });
      await recordBrainCall(prisma, "recommend_circuit_break", cbEnv, { passId });
    }
  } catch {
    // replay/resilience analysis is advisory — never break the pass
  }
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

    // Unified higher-order reasoning: mission control (mission tree → subgoals →
    // blockers → next action) and stuckness detection (loop / no-growth → unblock
    // strategy → developer request). Both fail-open and record their brain calls.
    const { runMissionControlPass, runStucknessPass } = await import("./mission-control");
    await runMissionControlPass(prisma, { passId: opts.passId });
    await runStucknessPass(prisma, { passId: opts.passId });

    // Reflection: explain the actual final decision the brain made this pass,
    // and turn recurring failures into test-gap → regression-test developer
    // requests. Advisory + recorded so the dashboard's self-explanations and
    // the developer-request queue reflect real activity. Fail-open.
    await runBrainReflection(prisma, opts.passId, failures);

    // Replay & resilience: compare/explain decision changes, detect drift, check
    // stored-output integrity, and recommend per-stage circuit breaks.
    await runReplayResilience(prisma, opts.passId);

    // Persist capability scores + calibration history to their dedicated tables.
    await persistCapabilityAndCalibration(prisma);

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
