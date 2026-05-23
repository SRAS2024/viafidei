/**
 * Viafidei checklist-first worker — public entry points.
 *
 * Everything important the worker does is exposed here. Code outside
 * src/lib/worker/ should import from this index and never reach into
 * submodules directly.
 *
 * The flow is:
 *
 *   1. Ingestion (admin or scheduler) calls `discoverChecklistItem(...)`
 *      or `addCitation(...)` to record a candidate item and its sources.
 *
 *   2. An admin reviews the item in the dashboard and calls
 *      `approveForBuild(...)`.
 *
 *   3. The worker calls `runOneBuildCycle(...)` (or `runWorkerLoop(...)`)
 *      to drain the build queue.
 *
 *   4. Each build runs the engine, scores QA, persists logs, version,
 *      relations, and (if QA passes) calls `publish(...)`.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import {
  enqueueBuild,
  leaseNextBuildJob,
  markBuildFailedOrRetry,
  markBuildPartial,
  markBuildSucceeded,
} from "./build/queue";
import { runBuildEngine } from "./build/engine";
import { runQA } from "./qa";
import { publish } from "./publishing";
import { extractRelationCandidates, persistRelations } from "./relations";
import { authorityLevelForHost, isApprovedAuthorityHost } from "./sources/authority-registry";
import { canonicalizeSlug } from "./slugs";
import { detectChecklistDuplicate } from "./duplicates";
import { BuildLogger } from "./logs";
import type { BuiltContentPackage } from "./types";

export * from "./types";
export { CONTENT_SCHEMAS, getContentSchema, validatePayload } from "./schemas";
export { MASTER_CHECKLISTS, totalChecklistItems, checklistSummary } from "./checklists";
export {
  AUTHORITY_SOURCES,
  authorityLevelForHost,
  isApprovedAuthorityHost,
  findAuthoritySource,
} from "./sources/authority-registry";
export { fetchApprovedSource, UnapprovedSourceError } from "./sources/fetcher";
export { canonicalizeSlug, normalizeForComparison, suggestSlug } from "./slugs";
export { detectChecklistDuplicate, packagesAreDuplicates } from "./duplicates";
export { runQA, type QAReport } from "./qa";
export { publish, unpublish, type PublishResult } from "./publishing";
export {
  enqueueBuild,
  leaseNextBuildJob,
  markBuildSucceeded,
  markBuildPartial,
  markBuildFailedOrRetry,
  cancelBuild,
} from "./build/queue";
export { runBuildEngine } from "./build/engine";
export {
  extractRelationCandidates,
  persistRelations,
  type RelationType,
  type RelationCandidate,
} from "./relations";
export { BuildLogger, listBuildLogs } from "./logs";
export {
  scanForJanitorFindings,
  filterByAction,
  type JanitorAction,
  type JanitorFinding,
} from "./janitor";

// =============================================================================
// High-level checklist operations
// =============================================================================

export interface DiscoverInput {
  contentType: ChecklistContentType;
  canonicalName: string;
  aliases?: string[];
  summary?: string;
  priority?: number;
  authorityLevelHint?: import("@prisma/client").SourceAuthorityLevel;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a new candidate checklist item. Does duplicate detection and
 * returns the existing item if a match is found.
 */
export async function discoverChecklistItem(
  prisma: PrismaClient,
  input: DiscoverInput,
): Promise<{
  item: Awaited<ReturnType<PrismaClient["checklistItem"]["findUnique"]>>;
  created: boolean;
}> {
  const slug = canonicalizeSlug(input.canonicalName);
  const duplicate = await detectChecklistDuplicate(prisma, {
    contentType: input.contentType,
    canonicalName: input.canonicalName,
    canonicalSlug: slug,
    aliases: input.aliases,
  });
  if (duplicate) {
    const existing = await prisma.checklistItem.findUnique({
      where: { id: duplicate.matchedItemId },
    });
    return { item: existing, created: false };
  }
  const created = await prisma.checklistItem.create({
    data: {
      contentType: input.contentType,
      canonicalName: input.canonicalName,
      canonicalSlug: slug,
      aliases: input.aliases ?? [],
      summary: input.summary,
      priority: input.priority ?? 100,
      authorityLevelHint: input.authorityLevelHint,
      notes: input.notes,
      metadata: input.metadata as never,
      approvalStatus: "DISCOVERED",
    },
  });
  return { item: created, created: true };
}

export interface AddCitationInput {
  checklistItemId: string;
  sourceUrl: string;
  title?: string;
  excerpt?: string;
  validationNotes?: string;
}

/**
 * Attach a source citation to a checklist item. Refuses URLs whose host is
 * not in the authority registry. Looks up the authority level from the
 * registry.
 */
export async function addCitation(
  prisma: PrismaClient,
  input: AddCitationInput,
): Promise<{ ok: boolean; reason?: string; citation?: { id: string } }> {
  let host: string;
  try {
    host = new URL(input.sourceUrl).host;
  } catch {
    return { ok: false, reason: `Invalid URL: ${input.sourceUrl}` };
  }
  const level = authorityLevelForHost(host);
  if (!level) {
    return {
      ok: false,
      reason: `Host "${host}" is not in the authority registry. Add the source first.`,
    };
  }
  const authoritySource = await prisma.authoritySource.findUnique({
    where: { host },
  });

  const citation = await prisma.checklistCitation.upsert({
    where: {
      checklistItemId_sourceUrl: {
        checklistItemId: input.checklistItemId,
        sourceUrl: input.sourceUrl,
      },
    },
    update: {
      title: input.title,
      excerpt: input.excerpt,
      validationNotes: input.validationNotes,
      authorityLevel: level,
      authoritySourceId: authoritySource?.id,
    },
    create: {
      checklistItemId: input.checklistItemId,
      sourceUrl: input.sourceUrl,
      sourceHost: host,
      authorityLevel: level,
      authoritySourceId: authoritySource?.id,
      title: input.title,
      excerpt: input.excerpt,
      validationNotes: input.validationNotes,
    },
  });
  return { ok: true, citation: { id: citation.id } };
}

/**
 * Promote an item from DISCOVERED → SOURCE_VERIFIED.
 */
export async function markSourceVerified(
  prisma: PrismaClient,
  checklistItemId: string,
  _actorUsername?: string,
): Promise<void> {
  const item = await prisma.checklistItem.findUnique({
    where: { id: checklistItemId },
    include: { citations: true },
  });
  if (!item) throw new Error(`ChecklistItem ${checklistItemId} not found.`);
  const allApproved = item.citations.every((c) => isApprovedAuthorityHost(c.sourceHost));
  if (!allApproved) {
    throw new Error(
      "One or more citations point to non-approved sources. Cannot mark source_verified.",
    );
  }
  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: {
      approvalStatus: "SOURCE_VERIFIED",
      sourceVerifiedAt: new Date(),
    },
  });
  await prisma.checklistCitation.updateMany({
    where: { checklistItemId },
    data: { validated: true, validatedAt: new Date() },
  });
}

/**
 * Approve a verified item for the worker to build.
 */
export async function approveForBuild(
  prisma: PrismaClient,
  checklistItemId: string,
  actorUsername?: string,
): Promise<{ jobId: string }> {
  const item = await prisma.checklistItem.findUnique({
    where: { id: checklistItemId },
    include: { citations: true },
  });
  if (!item) throw new Error(`ChecklistItem ${checklistItemId} not found.`);
  if (item.approvalStatus !== "SOURCE_VERIFIED") {
    throw new Error(
      `Item must be SOURCE_VERIFIED before approval. Current: ${item.approvalStatus}`,
    );
  }
  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: {
      approvalStatus: "APPROVED_FOR_BUILD",
      approvedForBuildAt: new Date(),
      approvedByUsername: actorUsername,
    },
  });
  const job = await enqueueBuild(prisma, {
    checklistItemId,
    triggeredBy: "manual",
    actorUsername,
  });
  return { jobId: job.id };
}

export async function rejectItem(
  prisma: PrismaClient,
  checklistItemId: string,
  reason: string,
  actorUsername?: string,
): Promise<void> {
  await prisma.checklistItem.update({
    where: { id: checklistItemId },
    data: {
      approvalStatus: "REJECTED",
      rejectedAt: new Date(),
      rejectedReason: reason,
      rejectedByUsername: actorUsername,
    },
  });
}

/**
 * Run one build cycle: lease the next job, run the engine, score QA,
 * persist logs/version/relations, and publish if QA passes.
 */
export async function runOneBuildCycle(
  prisma: PrismaClient,
  workerId: string,
): Promise<
  | { kind: "idle" }
  | {
      kind: "ran";
      jobId: string;
      checklistItemId: string;
      status: "succeeded" | "partial" | "retrying" | "failed" | "published" | "qa_review";
      reason?: string;
      qaScore?: number;
    }
> {
  const job = await leaseNextBuildJob(prisma, workerId);
  if (!job) return { kind: "idle" };

  const logger = new BuildLogger(prisma, job.id);
  await prisma.checklistItem
    .update({
      where: { id: job.checklistItemId },
      data: { approvalStatus: "BUILT", builtAt: new Date() },
    })
    .catch(() => undefined); // best effort; engine will guard.

  try {
    const result = await runBuildEngine(
      { prisma },
      {
        buildJobId: job.id,
        checklistItemId: job.checklistItemId,
      },
    );

    if (!result.ok || !result.package) {
      if (result.partial) {
        await markBuildPartial(
          prisma,
          job.id,
          { warnings: result.warnings },
          result.errorMessage ?? "Partial build",
          result.confidence,
        );
        return {
          kind: "ran",
          jobId: job.id,
          checklistItemId: job.checklistItemId,
          status: "partial",
          reason: result.errorMessage,
        };
      }
      const outcome = await markBuildFailedOrRetry(
        prisma,
        job.id,
        result.errorMessage ?? "Build failed.",
      );
      return {
        kind: "ran",
        jobId: job.id,
        checklistItemId: job.checklistItemId,
        status: outcome.status === "failed" ? "failed" : "retrying",
        reason: result.errorMessage,
      };
    }

    const pkg: BuiltContentPackage = result.package;
    const qa = runQA(pkg);

    await prisma.checklistQAReport.create({
      data: {
        checklistItemId: job.checklistItemId,
        buildJobId: job.id,
        passed: qa.passed,
        completenessScore: qa.completenessScore,
        accuracyScore: qa.accuracyScore,
        sourceCoverageScore: qa.sourceCoverageScore,
        formattingScore: qa.formattingScore,
        readabilityScore: qa.readabilityScore,
        appCompatScore: qa.appCompatScore,
        overallScore: qa.overallScore,
        issues: qa.issues,
        warnings: qa.warnings,
        fieldsValidated: qa.fieldsValidated,
        recommendation: qa.recommendation,
        needsHumanReview: qa.needsHumanReview,
      },
    });

    await markBuildSucceeded(prisma, job.id, pkg.payload, pkg.confidence);

    const relCandidates = extractRelationCandidates({
      fromItemId: job.checklistItemId,
      fromType: pkg.contentType,
      payload: pkg.payload,
    });
    const rels = await persistRelations(prisma, job.checklistItemId, relCandidates);
    if (rels.created || rels.skipped) {
      await logger.info(
        "relations",
        `Recorded ${rels.created} relations (${rels.skipped} skipped — target not in checklist).`,
      );
    }

    await prisma.checklistItem.update({
      where: { id: job.checklistItemId },
      data: {
        approvalStatus: qa.needsHumanReview ? "QA_PENDING" : "APPROVED",
        qaPendingAt: qa.needsHumanReview ? new Date() : null,
        approvedAt: qa.needsHumanReview ? null : new Date(),
        needsHumanReview: qa.needsHumanReview,
        humanReviewReason: pkg.humanReviewReason,
      },
    });

    // Autonomous publishing: every successful build attempts to publish.
    // The publishing gate still refuses packages that hard-fail QA. Packages
    // that only "need human review" are auto-published when QA passed and
    // the worker is confident (>=0.75) — this is the "intelligent custodian"
    // mode the system was designed for. Anything below that bar stays in
    // QA_PENDING for an admin to review.
    const autoBypass = qa.passed && pkg.confidence >= 0.75;
    if (qa.recommendation !== "reject") {
      const publishResult = await publish(prisma, {
        checklistItemId: job.checklistItemId,
        pkg,
        qa,
        buildJobId: job.id,
        forceReviewBypass: autoBypass,
        changeSummary: autoBypass
          ? `Autonomous publish (confidence ${pkg.confidence.toFixed(2)}).`
          : "Worker publish.",
      });
      if (publishResult.published) {
        await logger.info("publish", publishResult.reason);
        return {
          kind: "ran",
          jobId: job.id,
          checklistItemId: job.checklistItemId,
          status: "published",
          qaScore: qa.overallScore,
        };
      }
      await logger.info("publish", `Did not publish: ${publishResult.reason}`);
    }
    return {
      kind: "ran",
      jobId: job.id,
      checklistItemId: job.checklistItemId,
      status: "qa_review",
      qaScore: qa.overallScore,
      reason: qa.recommendation,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logger.error("crash", msg);
    const outcome = await markBuildFailedOrRetry(prisma, job.id, msg);
    return {
      kind: "ran",
      jobId: job.id,
      checklistItemId: job.checklistItemId,
      status: outcome.status === "failed" ? "failed" : "retrying",
      reason: msg,
    };
  }
}

export interface WorkerLoopOptions {
  workerId: string;
  maxCycles?: number;
  idleSleepMs?: number;
  onIdle?: () => void;
}

export async function runWorkerLoop(
  prisma: PrismaClient,
  options: WorkerLoopOptions,
): Promise<void> {
  const maxCycles = options.maxCycles ?? Infinity;
  const idleSleepMs = options.idleSleepMs ?? 10_000;
  let cycle = 0;
  while (cycle < maxCycles) {
    const result = await runOneBuildCycle(prisma, options.workerId);
    if (result.kind === "idle") {
      // The autonomous custodian keeps the pipeline flowing: when the
      // build queue is empty, the worker auto-promotes items it can
      // confidently move forward (DISCOVERED → SOURCE_VERIFIED →
      // APPROVED_FOR_BUILD) so the next cycle has work.
      const advanced = await autonomousPromote(prisma).catch(() => 0);
      if (advanced > 0) {
        cycle++;
        continue;
      }
      if (options.onIdle) options.onIdle();
      if (maxCycles !== Infinity) break;
      await new Promise((resolve) => setTimeout(resolve, idleSleepMs));
      continue;
    }
    cycle++;
  }
}

/**
 * Autonomous promotion. The worker scans for items it can safely advance:
 *
 *   - DISCOVERED items with at least one validated approved-source citation
 *     → SOURCE_VERIFIED
 *   - SOURCE_VERIFIED items whose schema requires no human review and whose
 *     citation count meets the schema minimum → APPROVED_FOR_BUILD (and
 *     enqueued)
 *
 * Items that the schema marks `requiresHumanReview: true` (e.g. APPARITION)
 * are left in their current state for an admin to inspect.
 *
 * Returns the number of items it moved.
 */
export async function autonomousPromote(prisma: PrismaClient): Promise<number> {
  const { getContentSchema } = await import("./schemas");
  let moved = 0;

  const discovered = await prisma.checklistItem.findMany({
    where: { approvalStatus: "DISCOVERED", needsHumanReview: false },
    include: { citations: true },
    take: 50,
  });
  for (const item of discovered) {
    const approvedCount = item.citations.filter((c) =>
      isApprovedAuthorityHost(c.sourceHost),
    ).length;
    if (approvedCount === 0) continue;
    await prisma.checklistItem.update({
      where: { id: item.id },
      data: { approvalStatus: "SOURCE_VERIFIED", sourceVerifiedAt: new Date() },
    });
    await prisma.checklistCitation.updateMany({
      where: { checklistItemId: item.id },
      data: { validated: true, validatedAt: new Date() },
    });
    moved++;
  }

  const verified = await prisma.checklistItem.findMany({
    where: { approvalStatus: "SOURCE_VERIFIED", needsHumanReview: false },
    include: { citations: true },
    take: 50,
  });
  for (const item of verified) {
    const instruction = getContentSchema(item.contentType).instruction;
    if (instruction.requiresHumanReview) continue;
    if (item.citations.length < instruction.minCitations) continue;
    await prisma.checklistItem.update({
      where: { id: item.id },
      data: {
        approvalStatus: "APPROVED_FOR_BUILD",
        approvedForBuildAt: new Date(),
        approvedByUsername: "autonomous-worker",
      },
    });
    await enqueueBuild(prisma, {
      checklistItemId: item.id,
      triggeredBy: "autonomous",
    });
    moved++;
  }

  return moved;
}

// =============================================================================
// Bulk operations
// =============================================================================

export interface BulkResult {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

/**
 * Bulk-verify every DISCOVERED item that has at least one citation pointing
 * to an approved authority host.
 */
export async function bulkVerifyAll(
  prisma: PrismaClient,
  options: {
    contentType?: ChecklistContentType;
    actorUsername?: string;
  } = {},
): Promise<BulkResult> {
  const items = await prisma.checklistItem.findMany({
    where: {
      approvalStatus: "DISCOVERED",
      ...(options.contentType ? { contentType: options.contentType } : {}),
    },
    include: { citations: true },
  });
  const out: BulkResult = { attempted: items.length, succeeded: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      const approvedCount = item.citations.filter((c) =>
        isApprovedAuthorityHost(c.sourceHost),
      ).length;
      if (approvedCount === 0) {
        out.failed++;
        out.errors.push(`${item.canonicalSlug}: no approved citations`);
        continue;
      }
      await markSourceVerified(prisma, item.id, options.actorUsername);
      out.succeeded++;
    } catch (err) {
      out.failed++;
      out.errors.push(`${item.canonicalSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/**
 * Bulk-approve and enqueue every SOURCE_VERIFIED item whose schema does not
 * mandate human review.
 */
export async function bulkBuildAll(
  prisma: PrismaClient,
  options: {
    contentType?: ChecklistContentType;
    actorUsername?: string;
    includeReview?: boolean;
  } = {},
): Promise<BulkResult> {
  const { getContentSchema } = await import("./schemas");
  const items = await prisma.checklistItem.findMany({
    where: {
      approvalStatus: "SOURCE_VERIFIED",
      ...(options.contentType ? { contentType: options.contentType } : {}),
    },
  });
  const out: BulkResult = { attempted: items.length, succeeded: 0, failed: 0, errors: [] };
  for (const item of items) {
    const instruction = getContentSchema(item.contentType).instruction;
    if (instruction.requiresHumanReview && !options.includeReview) {
      out.failed++;
      out.errors.push(
        `${item.canonicalSlug}: requires human review (use includeReview to override)`,
      );
      continue;
    }
    try {
      await approveForBuild(prisma, item.id, options.actorUsername);
      out.succeeded++;
    } catch (err) {
      out.failed++;
      out.errors.push(`${item.canonicalSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/**
 * Bulk-reject items matching the supplied filter.
 */
export async function bulkReject(
  prisma: PrismaClient,
  options: {
    approvalStatus?: import("@prisma/client").ChecklistApprovalStatus;
    contentType?: ChecklistContentType;
    reason: string;
    actorUsername?: string;
  },
): Promise<BulkResult> {
  const items = await prisma.checklistItem.findMany({
    where: {
      ...(options.approvalStatus ? { approvalStatus: options.approvalStatus } : {}),
      ...(options.contentType ? { contentType: options.contentType } : {}),
    },
  });
  const out: BulkResult = { attempted: items.length, succeeded: 0, failed: 0, errors: [] };
  for (const item of items) {
    try {
      await rejectItem(prisma, item.id, options.reason, options.actorUsername);
      out.succeeded++;
    } catch (err) {
      out.failed++;
      out.errors.push(`${item.canonicalSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/**
 * Counts of items that can be acted on in bulk right now. Used to drive the
 * dashboard "verify all / build all" button visibility and "highlight after
 * all verified" state.
 */
export async function bulkActionCounts(
  prisma: PrismaClient,
): Promise<{ discoveredReadyToVerify: number; verifiedReadyToBuild: number }> {
  const discovered = await prisma.checklistItem.findMany({
    where: { approvalStatus: "DISCOVERED" },
    include: { citations: true },
  });
  const verified = await prisma.checklistItem.count({
    where: { approvalStatus: "SOURCE_VERIFIED" },
  });
  const discoveredReady = discovered.filter((i) =>
    i.citations.some((c) => isApprovedAuthorityHost(c.sourceHost)),
  ).length;
  return { discoveredReadyToVerify: discoveredReady, verifiedReadyToBuild: verified };
}
