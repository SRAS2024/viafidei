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

    if (qa.recommendation === "publish" && !qa.needsHumanReview) {
      const result = await publish(prisma, {
        checklistItemId: job.checklistItemId,
        pkg,
        qa,
        buildJobId: job.id,
      });
      if (result.published) {
        return {
          kind: "ran",
          jobId: job.id,
          checklistItemId: job.checklistItemId,
          status: "published",
          qaScore: qa.overallScore,
        };
      }
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
      if (options.onIdle) options.onIdle();
      if (maxCycles !== Infinity) break;
      await new Promise((resolve) => setTimeout(resolve, idleSleepMs));
      continue;
    }
    cycle++;
  }
}
