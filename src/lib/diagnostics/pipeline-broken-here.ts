/**
 * Pipeline broken here diagnostic.
 *
 * For every stage of the content factory queue chain, this helper
 * detects rows that successfully reached one stage but never made
 * the next one — so the admin can see precisely WHERE the pipeline
 * has broken and what the automatic next action is.
 *
 * Stages:
 *
 *   1. Source discovery → DiscoveredSourceItem exists
 *   2. Source fetch     → SourceDocument exists for that URL
 *   3. Content build    → ContentPackageBuildLog exists for that doc
 *   4. Strict QA        → build outcome=built_complete_package +
 *                          downstream RejectedContentLog OR
 *                          persisted public row
 *   5. Persistence      → public-content row exists
 *   6. Public gate      → public row has publicRenderReady=true
 *                          + isThresholdEligible=true
 *
 * The diagnostic emits one entry per broken stage. The
 * `automaticNextAction` field tells the admin (and the future
 * auto-repair worker) exactly what to enqueue to unstick the
 * pipeline.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

const SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS = 10 * 60 * 1000;

export type BrokenStageId =
  | "source_document_waiting_for_build"
  | "build_succeeded_but_no_qa"
  | "qa_passed_but_no_persistence"
  | "persisted_but_public_gate_failed";

export type BrokenStageEntry = {
  stage: BrokenStageId;
  /** Display label for the admin card. */
  label: string;
  /** Sample rows (capped) so the admin can drill in. */
  samples: Array<{
    sourceUrl?: string;
    sourceDocumentId?: string;
    contentType?: string;
    slug?: string;
    detail?: string;
  }>;
  /** Total count of broken rows for this stage. */
  count: number;
  /** Threshold age in ms after which a row is considered "stuck". */
  thresholdMs: number;
  /** The automatic next action that will unstick this stage. */
  automaticNextAction: string;
};

export type PipelineBrokenHereReport = {
  generatedAt: Date;
  entries: BrokenStageEntry[];
  /** Total number of broken rows across all stages. */
  totalBroken: number;
};

/**
 * Source documents that exist but have no ContentPackageBuildLog
 * after the SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS window.
 */
async function detectSourceDocumentsWaitingForBuild(): Promise<BrokenStageEntry> {
  const cutoff = new Date(Date.now() - SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS);
  const documents = await prisma.sourceDocument
    .findMany({
      where: {
        fetchedAt: { lt: cutoff },
        fetchStatus: "ok",
      },
      select: { id: true, sourceUrl: true, fetchedAt: true },
      take: 200,
    })
    .catch((e) => {
      logger.warn("pipeline-broken-here.docs_waiting_query_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [] as Array<{ id: string; sourceUrl: string; fetchedAt: Date }>;
    });

  const samples: BrokenStageEntry["samples"] = [];
  let count = 0;
  for (const doc of documents) {
    const hasBuild = await prisma.contentPackageBuildLog
      .findFirst({ where: { sourceDocumentId: doc.id }, select: { id: true } })
      .catch(() => null);
    if (hasBuild) continue;
    count += 1;
    if (samples.length < 10) {
      samples.push({
        sourceDocumentId: doc.id,
        sourceUrl: doc.sourceUrl,
        detail: `fetched ${doc.fetchedAt.toISOString()}, no build attempt yet`,
      });
    }
  }
  return {
    stage: "source_document_waiting_for_build",
    label: "Source documents fetched but never built",
    count,
    samples,
    thresholdMs: SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS,
    automaticNextAction: "enqueue_content_build_for_each_allowed_content_type",
  };
}

/**
 * Build logs with outcome=built_complete_package that have no
 * RejectedContentLog AND no persisted public row. This is the
 * "build succeeded but QA never ran" case.
 */
async function detectBuildsWithoutQA(): Promise<BrokenStageEntry> {
  const cutoff = new Date(Date.now() - SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS);
  const builds = await prisma.contentPackageBuildLog
    .findMany({
      where: {
        buildStatus: "built_complete_package",
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        sourceDocumentId: true,
        sourceUrl: true,
        contentType: true,
        candidateSlug: true,
        createdAt: true,
      },
      take: 200,
    })
    .catch((e) => {
      logger.warn("pipeline-broken-here.builds_query_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    });

  const samples: BrokenStageEntry["samples"] = [];
  let count = 0;
  for (const b of builds) {
    if (!b.candidateSlug) continue;
    // A "QA happened" signal is: a RejectedContentLog row for the
    // same slug+contentType, OR an existing public row at the slug.
    const rejected = await prisma.rejectedContentLog
      .findFirst({
        where: { slug: b.candidateSlug, contentType: b.contentType },
        select: { id: true },
      })
      .catch(() => null);
    if (rejected) continue;
    const exists = await checkPublicRowExists(b.contentType, b.candidateSlug);
    if (exists.exists) continue;
    count += 1;
    if (samples.length < 10) {
      samples.push({
        contentType: b.contentType,
        slug: b.candidateSlug,
        sourceUrl: b.sourceUrl,
        detail: `built ${b.createdAt.toISOString()}, no QA result observed`,
      });
    }
  }
  return {
    stage: "build_succeeded_but_no_qa",
    label: "Builds succeeded but strict QA never ran",
    count,
    samples,
    thresholdMs: SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS,
    automaticNextAction: "rerun_combined_content_build_stage_for_each_orphan",
  };
}

/**
 * QA passes (RejectedContentLog decision=publish/update is not
 * stored — RejectedContentLog only records rejections; so we infer
 * "QA passed but persistence failed" by looking for build logs with
 * built_complete_package outcome whose target slug is not present in
 * the public content table AND has no rejection row).
 *
 * In practice this overlaps with detectBuildsWithoutQA above; we
 * narrow this signal to rows where a same-source-URL public row
 * EXISTS but was created BEFORE the latest build — meaning the
 * latest build never produced an update.
 *
 * For now the helper returns count=0 + automaticNextAction so the
 * admin card still appears; full inference requires a
 * PersistenceLog table that the spec calls out as a later step.
 */
async function detectQAPassedButNotPersisted(): Promise<BrokenStageEntry> {
  return {
    stage: "qa_passed_but_no_persistence",
    label: "Strict QA passed but persistence did not record a public row",
    count: 0,
    samples: [],
    thresholdMs: SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS,
    automaticNextAction: "retry_persistence_with_exact_error",
  };
}

/**
 * Persisted public rows where the strict public gate is NOT set.
 * These are rows that should not be visible on the public site but
 * are reachable via direct queries. The spec calls this the
 * "persistence succeeded but public gates failed" case.
 */
async function detectPersistedButGateFailed(): Promise<BrokenStageEntry> {
  const samples: BrokenStageEntry["samples"] = [];
  let count = 0;
  const checks: Array<{ name: string; query: () => Promise<{ slug: string; reason: string }[]> }> =
    [
      {
        name: "Prayer",
        query: async () => {
          const rows = await prisma.prayer.findMany({
            where: {
              status: "PUBLISHED",
              OR: [{ publicRenderReady: false }, { isThresholdEligible: false }],
            },
            select: { slug: true, publicRenderReady: true, isThresholdEligible: true },
            take: 20,
          });
          return rows.map((r) => ({
            slug: r.slug,
            reason: `publicRenderReady=${r.publicRenderReady} isThresholdEligible=${r.isThresholdEligible}`,
          }));
        },
      },
      {
        name: "Saint",
        query: async () => {
          const rows = await prisma.saint.findMany({
            where: {
              status: "PUBLISHED",
              OR: [{ publicRenderReady: false }, { isThresholdEligible: false }],
            },
            select: { slug: true, publicRenderReady: true, isThresholdEligible: true },
            take: 20,
          });
          return rows.map((r) => ({
            slug: r.slug,
            reason: `publicRenderReady=${r.publicRenderReady} isThresholdEligible=${r.isThresholdEligible}`,
          }));
        },
      },
    ];
  for (const c of checks) {
    try {
      const rows = await c.query();
      count += rows.length;
      for (const r of rows) {
        if (samples.length >= 10) break;
        samples.push({ contentType: c.name, slug: r.slug, detail: r.reason });
      }
    } catch (e) {
      logger.warn("pipeline-broken-here.gate_check_failed", {
        contentType: c.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return {
    stage: "persisted_but_public_gate_failed",
    label: "Persisted as PUBLISHED but strict public gate failed",
    count,
    samples,
    thresholdMs: 0,
    automaticNextAction: "run_strict_revalidation",
  };
}

async function checkPublicRowExists(
  contentType: string,
  slug: string,
): Promise<{ exists: boolean }> {
  const lookups: Record<string, () => Promise<{ id: string } | null>> = {
    Prayer: () => prisma.prayer.findUnique({ where: { slug }, select: { id: true } }),
    Saint: () => prisma.saint.findUnique({ where: { slug }, select: { id: true } }),
    MarianApparition: () =>
      prisma.marianApparition.findUnique({ where: { slug }, select: { id: true } }),
    Parish: () => prisma.parish.findUnique({ where: { slug }, select: { id: true } }),
    Devotion: () => prisma.devotion.findUnique({ where: { slug }, select: { id: true } }),
    Liturgy: () => prisma.liturgyEntry.findUnique({ where: { slug }, select: { id: true } }),
    LiturgyEntry: () => prisma.liturgyEntry.findUnique({ where: { slug }, select: { id: true } }),
    History: () => prisma.liturgyEntry.findUnique({ where: { slug }, select: { id: true } }),
    SpiritualGuidance: () =>
      prisma.spiritualLifeGuide.findUnique({ where: { slug }, select: { id: true } }),
    Sacrament: () =>
      prisma.spiritualLifeGuide.findUnique({ where: { slug }, select: { id: true } }),
    Novena: () => prisma.devotion.findUnique({ where: { slug }, select: { id: true } }),
    Rosary: () => prisma.devotion.findUnique({ where: { slug }, select: { id: true } }),
    Consecration: () =>
      prisma.spiritualLifeGuide.findUnique({ where: { slug }, select: { id: true } }),
  };
  const fn = lookups[contentType];
  if (!fn) return { exists: false };
  try {
    const row = await fn();
    return { exists: row !== null };
  } catch {
    return { exists: false };
  }
}

/**
 * Generate the full Pipeline-broken-here report. Each entry tells
 * the admin and the auto-repair worker what to do next.
 */
export async function getPipelineBrokenHereReport(): Promise<PipelineBrokenHereReport> {
  const generatedAt = new Date();
  const entries = await Promise.all([
    detectSourceDocumentsWaitingForBuild(),
    detectBuildsWithoutQA(),
    detectQAPassedButNotPersisted(),
    detectPersistedButGateFailed(),
  ]);
  const totalBroken = entries.reduce((acc, e) => acc + e.count, 0);
  return { generatedAt, entries, totalBroken };
}

/**
 * Count of source documents that have been fetched but never built —
 * a single metric for the admin dashboard. Different from the
 * pipeline-broken-here report in that it gives the headline number
 * only.
 */
export async function countSourceDocumentsWaitingForBuild(): Promise<{
  count: number;
  thresholdMs: number;
}> {
  const cutoff = new Date(Date.now() - SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS);
  const documents = await prisma.sourceDocument
    .findMany({
      where: { fetchedAt: { lt: cutoff }, fetchStatus: "ok" },
      select: { id: true },
      take: 500,
    })
    .catch(() => []);
  let count = 0;
  for (const d of documents) {
    const built = await prisma.contentPackageBuildLog
      .findFirst({ where: { sourceDocumentId: d.id }, select: { id: true } })
      .catch(() => null);
    if (!built) count += 1;
  }
  return { count, thresholdMs: SOURCE_DOCUMENT_WAITING_BUILD_THRESHOLD_MS };
}
