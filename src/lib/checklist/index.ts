/**
 * Viafidei checklist-first content foundation — public entry points.
 *
 * This module defines WHAT content the site is responsible for and the raw
 * material the Admin Worker builds it from:
 *
 *   - the master checklists (the canonical list of every item to build),
 *   - the curated knowledge base (trusted seed facts + citations),
 *   - the Zod content schemas (the shape every payload must satisfy),
 *   - the authority-source registry (which hosts may be cited),
 *   - the janitor (content-hygiene scanner),
 *   - the build-intent queue (`enqueueBuild`), and
 *   - the checklist lifecycle CRUD (discover → cite → verify → approve).
 *
 * The autonomous build/QA/publish pipeline lives entirely in
 * `src/lib/admin-worker/` (brain → dispatcher → … → runPublishOrchestrator).
 * Code outside this module should import from this index and never reach
 * into submodules directly.
 *
 * The checklist lifecycle is:
 *
 *   1. Ingestion records a candidate item and attaches source citations
 *      (`addCitation`).
 *   2. Sources are verified (`markSourceVerified`).
 *   3. The item is approved for build (`approveForBuild`), which enqueues a
 *      build-intent the Admin Worker picks up.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { enqueueBuild } from "./build/queue";
import { authorityLevelForHost, isApprovedAuthorityHost } from "./sources/authority-registry";

export { CONTENT_SCHEMAS, getContentSchema, validatePayload } from "./schemas";
export { MASTER_CHECKLISTS, totalChecklistItems, checklistSummary } from "./checklists";
export {
  AUTHORITY_SOURCES,
  authorityLevelForHost,
  isApprovedAuthorityHost,
  isFetchableHost,
  openInternetEnabled,
  classifyHostAuthority,
  findAuthoritySource,
} from "./sources/authority-registry";
export { canonicalizeSlug, normalizeForComparison, suggestSlug } from "./slugs";
export { unpublish, type PublishResult } from "./publishing";
export { enqueueBuild } from "./build/queue";
export {
  scanForJanitorFindings,
  filterByAction,
  type JanitorAction,
  type JanitorFinding,
} from "./janitor";
export {
  findCuratedEntry,
  curatedKnowledgeSize,
  curatedKnowledgeByType,
  ALL_CURATED_ENTRIES,
  type CuratedEntry,
} from "./knowledge";

// =============================================================================
// Checklist lifecycle operations
// =============================================================================

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
 * Approve a verified item for the worker to build. Enqueues a build-intent
 * (`WorkerBuildJob`) the Admin Worker dispatcher acts on.
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
 * dashboard "verify all" button visibility and "highlight after all verified"
 * state.
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
