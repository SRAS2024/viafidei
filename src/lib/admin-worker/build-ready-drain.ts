/**
 * BUILD_READY drain + per-item gate triage (adaptive-worker Phase A).
 *
 * The pipeline advances one artifact per pass (cross-source verification and
 * publish are single-oldest; strict-QA is a batch of 10). When built artifacts
 * pile up, that's too slow and — worse — there was no logic to EXPLAIN why a
 * given built item wasn't publishing or to ROUTE a stuck item to a resolution.
 * That is the "15 artifacts built but none QA-passed or published" stall.
 *
 * This module fixes both:
 *   1. `diagnoseArtifactGate` (pure, unit-tested) inspects one artifact + its
 *      context and returns the EXACT gate blocking it and the outcome it should
 *      be routed to (publish · run QA · run verification · create evidence ·
 *      repair · review · duplicate · block).
 *   2. `runBuildReadyDrain` triages EVERY stuck artifact — recording the gate on
 *      the artifact (`gateDiagnosis`) so the operator can see why each item is
 *      not publishing — then (a) routes terminal/repairable items directly and
 *      (b) DRIVES the real gate handlers (cross-source verification → strict QA
 *      → publish) in a bounded loop to drain the backlog, prioritising the
 *      downstream drain over more upstream extraction.
 *
 * It never bypasses a gate: draining just runs the SAME handlers repeatedly over
 * the backlog. Publishing runs the DETERMINISTIC funnel (verify → strict QA →
 * publish) regardless of the Python brain — content at QA_PASSED has already
 * cleared strict QA + the publish orchestrator's own gates, so it must not be
 * held hostage to brain availability (that stall is the EXTRACTING_WITHOUT_
 * PUBLISHING escalation). The only safe-degraded carve-out is doctrinally-
 * sensitive content, which still requires the active brain (`allowSensitive =
 * opts.active`). Fail-open throughout.
 */

import type { PrismaClient } from "@prisma/client";

import { runChecklistAndCitationOrchestrator } from "./checklist-citation-orchestrator";
import { writeAdminWorkerLog } from "./logs";
import { filePlan } from "./repair-plans";
import { runCrossSourceVerification, runStrictQA, runPersistAndPublish } from "./dispatcher";

/** The exact gate blocking an artifact from advancing. */
export type GateKind =
  | "READY_TO_PUBLISH"
  | "AWAITING_QA"
  | "AWAITING_VERIFICATION"
  | "VERIFICATION_INCOMPLETE"
  | "MISSING_REQUIRED_FIELDS"
  | "MISSING_CITATIONS"
  | "LOW_CONFIDENCE"
  | "DUPLICATE"
  | "MALFORMED"
  | "UNKNOWN";

/** What the drain should do with the artifact. */
export type GateOutcome =
  | "publish"
  | "run_qa"
  | "run_verification"
  | "create_evidence"
  | "repair"
  | "review"
  | "duplicate"
  | "block";

export interface ArtifactGateDiagnosis {
  gate: GateKind;
  outcome: GateOutcome;
  explanation: string;
  recommendedAction: string;
}

/** The minimal artifact shape the diagnosis needs (subset of the row). */
export interface DrainArtifact {
  id: string;
  contentType: string;
  normalizedSlug: string;
  status: string;
  missingFields: string[];
  validationNeeds: string[];
  confidenceScore: number;
  extractedFields: unknown;
}

export interface GateContext {
  /** Cross-source verification evidence rows already recorded for this artifact. */
  evidenceCount: number;
  /** A DIFFERENT already-published item shares this (contentType, slug). */
  hasPublishedDuplicate: boolean;
  /** Confidence below this is treated as too weak to publish as-is. */
  confidenceFloor: number;
}

/** True when the payload carries no provenance (citations / source URL). */
function lacksCitations(extractedFields: unknown): boolean {
  if (!extractedFields || typeof extractedFields !== "object") return true;
  const f = extractedFields as Record<string, unknown>;
  const citations = f.citations;
  const hasCitations = Array.isArray(citations) && citations.length > 0;
  const hasSource =
    (typeof f.sourceUrl === "string" && f.sourceUrl.length > 0) ||
    (typeof f.sourceHost === "string" && f.sourceHost.length > 0);
  return !hasCitations && !hasSource;
}

/**
 * Diagnose the single gate blocking one artifact and the outcome to route it
 * to. Pure + deterministic — the order encodes priority (terminal/repairable
 * checks before "just needs the next handler"). Exported for unit testing.
 */
export function diagnoseArtifactGate(a: DrainArtifact, ctx: GateContext): ArtifactGateDiagnosis {
  // Already through QA — the only thing left is publishing.
  if (a.status === "QA_PASSED") {
    return {
      gate: "READY_TO_PUBLISH",
      outcome: "publish",
      explanation: "Passed strict QA; awaiting the publish step.",
      recommendedAction: "Run the publish orchestrator.",
    };
  }

  // A duplicate of an already-published item must not publish again.
  if (ctx.hasPublishedDuplicate) {
    return {
      gate: "DUPLICATE",
      outcome: "duplicate",
      explanation: `Another published item already occupies ${a.contentType}/${a.normalizedSlug}.`,
      recommendedAction: "Reject as a duplicate of the live item.",
    };
  }

  // Required fields absent → the record is incomplete; re-extract / repair.
  if (a.missingFields.length > 0) {
    return {
      gate: "MISSING_REQUIRED_FIELDS",
      outcome: "repair",
      explanation: `Missing required field(s): ${a.missingFields.join(", ")}.`,
      recommendedAction: "File a repair plan to re-extract or source the missing fields.",
    };
  }

  // No provenance at all → cannot verify; repair to attach a source.
  if (lacksCitations(a.extractedFields)) {
    return {
      gate: "MISSING_CITATIONS",
      outcome: "repair",
      explanation: "No citations or source URL on the payload — provenance is required to verify.",
      recommendedAction: "File a repair plan to attach an authoritative source/citation.",
    };
  }

  // Doctrinally-sensitive facts need cross-source evidence before QA.
  if (a.validationNeeds.length > 0) {
    if (ctx.evidenceCount === 0) {
      return {
        gate: "AWAITING_VERIFICATION",
        outcome: "run_verification",
        explanation: `Needs cross-source evidence for: ${a.validationNeeds.join(", ")}.`,
        recommendedAction: "Run cross-source verification to gather evidence.",
      };
    }
    return {
      gate: "VERIFICATION_INCOMPLETE",
      outcome: "create_evidence",
      explanation: `Verification ran (${ctx.evidenceCount} row(s)) but ${a.validationNeeds.join(", ")} still lack a confirming match.`,
      recommendedAction: "File a validation-evidence repair to fetch a confirming source.",
    };
  }

  // Confidence too low to publish as-is → repair (re-extract from a better source).
  if (a.confidenceScore < ctx.confidenceFloor) {
    return {
      gate: "LOW_CONFIDENCE",
      outcome: "repair",
      explanation: `Package confidence ${a.confidenceScore.toFixed(2)} is below the floor ${ctx.confidenceFloor.toFixed(2)}.`,
      recommendedAction: "File a repair plan to re-extract from a stronger source.",
    };
  }

  // Nothing blocking — it just hasn't been QA'd yet.
  return {
    gate: "AWAITING_QA",
    outcome: "run_qa",
    explanation: "No blocking gate; the artifact is ready for strict QA.",
    recommendedAction: "Run strict QA.",
  };
}

export interface DrainResult {
  ran: boolean;
  stuck: number;
  byGate: Record<string, number>;
  byOutcome: Record<string, number>;
  /** CHECKLIST_READY artifacts promoted into the built funnel this drain. */
  bridged: number;
  published: number;
  advanced: number;
  repaired: number;
  reviewed: number;
  rejectedDuplicate: number;
}

const REPAIR_KIND_BY_GATE: Partial<
  Record<GateKind, "EXTRACT_FAILED" | "VALIDATION_EVIDENCE_MISSING">
> = {
  MISSING_REQUIRED_FIELDS: "EXTRACT_FAILED",
  MISSING_CITATIONS: "EXTRACT_FAILED",
  LOW_CONFIDENCE: "EXTRACT_FAILED",
  VERIFICATION_INCOMPLETE: "VALIDATION_EVIDENCE_MISSING",
};

/**
 * Triage every stuck built artifact, record its blocking gate, route
 * terminal/repairable items, and drive the real gate handlers to drain the
 * backlog. `active` gates the publishing drive (safe-degraded contract).
 * Fail-open — a drain error never breaks the pass.
 */
export async function runBuildReadyDrain(
  prisma: PrismaClient,
  opts: { passId?: string; active: boolean; limit?: number; driveRounds?: number },
): Promise<DrainResult> {
  const out: DrainResult = {
    ran: false,
    stuck: 0,
    byGate: {},
    byOutcome: {},
    bridged: 0,
    published: 0,
    advanced: 0,
    repaired: 0,
    reviewed: 0,
    rejectedDuplicate: 0,
  };
  const limit = opts.limit ?? 100;
  const driveRounds = opts.driveRounds ?? 6;
  const confidenceFloor = Number(process.env.ADMIN_WORKER_DRAIN_CONF_FLOOR ?? "0.4") || 0.4;

  try {
    const stuck = await prisma.adminWorkerPackageArtifact.findMany({
      where: { status: { in: ["BUILD_READY", "VERIFICATION_READY", "QA_PASSED"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        contentType: true,
        normalizedSlug: true,
        status: true,
        missingFields: true,
        validationNeeds: true,
        confidenceScore: true,
        extractedFields: true,
      },
    });
    // Complete-but-unbridged artifacts: the EXTRACTION stage stamps a fully
    // populated package CHECKLIST_READY, but the CHECKLIST_READY → BUILD_READY
    // bridge (checklist/citation orchestrator) is otherwise only brain-dispatched
    // one-stage-per-pass. If the brain fixates elsewhere, complete artifacts sit
    // at CHECKLIST_READY forever — extraction succeeding while nothing publishes
    // (the EXTRACTING_WITHOUT_PUBLISHING escalation). The drain must own that
    // bridge too, so it drains the WHOLE downstream funnel every pass.
    const checklistReady = await prisma.adminWorkerPackageArtifact
      .count({ where: { status: "CHECKLIST_READY", checklistItemId: null } })
      .catch(() => 0);

    if (stuck.length === 0 && checklistReady === 0) return out;
    out.ran = true;
    out.stuck = stuck.length;

    // Batch context: evidence counts + published-duplicate slugs.
    const ids = stuck.map((a) => a.id);
    const slugs = [...new Set(stuck.map((a) => a.normalizedSlug))];
    const [evidenceRows, publishedRows] = await Promise.all([
      prisma.adminWorkerCrossSourceVerification
        .groupBy({ by: ["contentId"], where: { contentId: { in: ids } }, _count: { _all: true } })
        .catch(() => [] as Array<{ contentId: string | null; _count: { _all: number } }>),
      prisma.publishedContent
        .findMany({
          where: { slug: { in: slugs }, isPublished: true },
          select: { contentType: true, slug: true },
        })
        .catch(() => [] as Array<{ contentType: string; slug: string }>),
    ]);
    const evidenceByArtifact = new Map<string, number>();
    for (const r of evidenceRows)
      if (r.contentId) evidenceByArtifact.set(r.contentId, r._count._all);
    const publishedKeys = new Set(publishedRows.map((r) => `${r.contentType}:${r.slug}`));

    // Triage + route each stuck artifact.
    for (const a of stuck) {
      const diag = diagnoseArtifactGate(
        {
          id: a.id,
          contentType: a.contentType,
          normalizedSlug: a.normalizedSlug,
          status: a.status,
          missingFields: a.missingFields ?? [],
          validationNeeds: a.validationNeeds ?? [],
          confidenceScore: a.confidenceScore ?? 0,
          extractedFields: a.extractedFields,
        },
        {
          evidenceCount: evidenceByArtifact.get(a.id) ?? 0,
          hasPublishedDuplicate: publishedKeys.has(`${a.contentType}:${a.normalizedSlug}`),
          confidenceFloor,
        },
      );
      out.byGate[diag.gate] = (out.byGate[diag.gate] ?? 0) + 1;
      out.byOutcome[diag.outcome] = (out.byOutcome[diag.outcome] ?? 0) + 1;

      // Record the gate on the artifact so the UI can show WHY it's stuck.
      await prisma.adminWorkerPackageArtifact
        .update({
          where: { id: a.id },
          data: { gateDiagnosis: diag.gate, gateCheckedAt: new Date() },
        })
        .catch(() => undefined);

      // Terminal / repairable routing (the advanceable outcomes are handled by
      // the drive phase below).
      if (diag.outcome === "duplicate") {
        await prisma.adminWorkerPackageArtifact
          .update({
            where: { id: a.id },
            data: { status: "REJECTED", rejectionReason: `duplicate: ${diag.explanation}` },
          })
          .catch(() => undefined);
        out.rejectedDuplicate += 1;
      } else if (diag.outcome === "repair" || diag.outcome === "create_evidence") {
        const kind = REPAIR_KIND_BY_GATE[diag.gate] ?? "EXTRACT_FAILED";
        await filePlan(prisma, {
          kind,
          failedEntity: a.id,
          repairAction: diag.recommendedAction,
          metadata: { artifactId: a.id, gate: diag.gate, contentType: a.contentType },
        }).catch(() => undefined);
        await prisma.adminWorkerPackageArtifact
          .update({
            where: { id: a.id },
            data: { status: "NEEDS_REPAIR", rejectionReason: diag.explanation },
          })
          .catch(() => undefined);
        out.repaired += 1;
      } else if (diag.outcome === "review") {
        await prisma.humanReviewQueue
          .create({
            data: {
              contentType: a.contentType,
              contentTitle: a.normalizedSlug,
              proposedAction: "resolve_stuck_artifact",
              reason: diag.explanation,
              confidence: a.confidenceScore ?? 0,
              blockingGate: diag.gate,
              neededAction: diag.recommendedAction,
              repairSuggestion: diag.recommendedAction,
              nextAutomatedAction: "await_human_judgment",
            },
          })
          .catch(() => undefined);
        await prisma.adminWorkerPackageArtifact
          .update({ where: { id: a.id }, data: { status: "NEEDS_REVIEW" } })
          .catch(() => undefined);
        out.reviewed += 1;
      }
      // publish / run_qa / run_verification → left for the drive phase.
    }

    // Drive phase: run the real gate handlers over the remaining backlog until
    // no further progress or the round cap. This is the "prioritise draining
    // the backlog" behaviour. Publishing only runs in active (python) mode.
    for (let round = 0; round < driveRounds; round++) {
      let progressed = false;

      // 0. Bridge complete CHECKLIST_READY artifacts into the built funnel. This
      //    is the fix for EXTRACTING_WITHOUT_PUBLISHING: a fully-extracted
      //    artifact must not depend on the brain happening to pick the checklist
      //    stage — the always-on drain promotes it (creates its checklist item +
      //    citations → BUILD_READY) so it can be QA'd and published this same
      //    pass. Bounded per round; `checklistItemId: null` guarantees no reloop.
      const pendingChecklist = await prisma.adminWorkerPackageArtifact
        .count({ where: { status: "CHECKLIST_READY", checklistItemId: null } })
        .catch(() => 0);
      if (pendingChecklist > 0) {
        const outcomes = await runChecklistAndCitationOrchestrator(prisma, {
          passId: opts.passId ?? "drain",
          limit: 100,
        }).catch(() => []);
        const promoted = outcomes.filter(
          (o) => o.status === "created" || o.status === "updated",
        ).length;
        if (promoted > 0) {
          progressed = true;
          out.bridged += promoted;
        }
      }

      // 1. Gather evidence for BUILD_READY items that still need it.
      const needVerify = await prisma.adminWorkerPackageArtifact
        .count({ where: { status: "BUILD_READY", validationNeeds: { isEmpty: false } } })
        .catch(() => 0);
      if (needVerify > 0) {
        const r = await runCrossSourceVerification(prisma, opts.passId ?? "drain").catch(
          () => null,
        );
        if (r && r.kind !== "idle") progressed = true;
      }

      // 2. Strict-QA the ready ones (batch of 10 internally).
      const needQA = await prisma.adminWorkerPackageArtifact
        .count({
          where: {
            OR: [
              { status: "VERIFICATION_READY" },
              { status: "BUILD_READY", validationNeeds: { isEmpty: true } },
            ],
          },
        })
        .catch(() => 0);
      if (needQA > 0) {
        const r = await runStrictQA(prisma, opts.passId ?? "drain").catch(() => null);
        if (r && r.kind !== "idle") {
          progressed = true;
          out.advanced += r.built ?? r.advancedCount ?? 0;
        }
      }

      // 3. Publish QA-passed items. Deterministic publish is NOT gated on the
      //    Python brain: an artifact at QA_PASSED has cleared strict 7-dimension
      //    QA + (for sensitive types) stored cross-source evidence, and the
      //    publish orchestrator independently enforces its own gates — so
      //    already-vetted content must publish even when the brain is degraded
      //    (otherwise a Python outage silently stalls ALL publishing → the
      //    EXTRACTING_WITHOUT_PUBLISHING escalation). The one carve-out honoring
      //    the safe-degraded contract: doctrinally-sensitive content still waits
      //    for the active brain, so we pass allowSensitive = opts.active.
      const readyToPublish = await prisma.adminWorkerPackageArtifact
        .count({ where: { status: "QA_PASSED" } })
        .catch(() => 0);
      if (readyToPublish > 0) {
        const r = await runPersistAndPublish(prisma, "drain", opts.passId ?? "drain", {
          allowSensitive: opts.active,
        }).catch(() => null);
        if (r && r.kind !== "idle") {
          progressed = true;
          out.published += r.published ?? 0;
        }
      }

      if (!progressed) break;
    }

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "VALIDATION",
      severity: "INFO",
      eventName: "build_ready_drain",
      message: `BUILD_READY drain: ${out.bridged} bridged from CHECKLIST_READY, ${out.stuck} stuck triaged → ${out.published} published, ${out.advanced} QA-advanced, ${out.repaired} repaired, ${out.reviewed} to review, ${out.rejectedDuplicate} duplicate. Gates: ${Object.entries(
        out.byGate,
      )
        .map(([g, n]) => `${g}=${n}`)
        .join(", ")}.`,
      safeMetadata: {
        stuck: out.stuck,
        byGate: out.byGate,
        byOutcome: out.byOutcome,
        bridged: out.bridged,
        published: out.published,
        advanced: out.advanced,
        repaired: out.repaired,
        reviewed: out.reviewed,
        rejectedDuplicate: out.rejectedDuplicate,
        active: opts.active,
      },
    }).catch(() => undefined);

    return out;
  } catch (err) {
    // A schema/DB error must not silently look like "nothing to drain" — that is
    // the invisible publish stall. Log it loudly (the schema-integrity rating
    // names the exact column); still fail open so the pass never crashes.
    const { reportQueryError } = await import("./schema-integrity");
    reportQueryError("BUILD_READY drain", err);
    return out;
  }
}
