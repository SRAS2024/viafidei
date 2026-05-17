/**
 * Worker-side job-kind dispatch. Routes a leased queue row to the
 * matching execution function based on `jobKind`. New kinds slot in
 * by extending the switch — no other worker changes needed.
 */

import { logger } from "../../observability/logger";
import { getAdapter } from "../registry";
import { runAdapter } from "../runner";
import { prisma } from "../../db/client";
import { recordSourceFreshness, recordSourceQuality } from "../../data/source-health";
import { purgeArchivedByArchivedAt } from "../../data/archive-cleanup";
import { runCatalogJanitor } from "../../data/catalog-janitor";
import { validatePayload, isJobKind, isRemovedJobKind, type JobKind } from "./job-kinds";
import { runContentFactory, getSourceDocument, recordSourceDocument } from "../../content-factory";
import type { ContentTypeKey } from "../../content-factory";
import type { QueueJobRow } from "./queue";

export type DispatchResult = {
  ok: boolean;
  errorMessage?: string;
  contentSeen?: number;
  contentReview?: number;
};

export async function runJobByKind(job: QueueJobRow): Promise<DispatchResult> {
  // Removed kinds (legacy `source_ingest`) are translated into the
  // modern factory chain by enqueueing an equivalent `source_discovery`
  // job and marking the legacy row as completed. This keeps in-flight
  // rows from a pre-migration deploy from breaking the worker.
  if (isRemovedJobKind(job.jobKind)) {
    return translateRemovedJobKind(job);
  }
  // Strict payload validation at execution time. Bad payloads fail
  // the job permanently (not retried) so a malformed row doesn't
  // crash the worker on every retry.
  const validation = validatePayload(job.jobKind, job.payload ?? {});
  if (!validation.ok) {
    return { ok: false, errorMessage: `Invalid payload: ${validation.error}` };
  }
  if (!isJobKind(job.jobKind)) {
    return { ok: false, errorMessage: `Unknown job kind: ${job.jobKind}` };
  }
  const kind = job.jobKind as JobKind;
  const payload = validation.data as Record<string, unknown>;

  switch (kind) {
    case "source_freshness":
    case "source_discovery":
      return runSourceJob(job, payload, kind);
    case "source_fetch":
      return runSourceFetch(job, payload);
    case "content_build":
    case "content_validate":
    case "content_persist":
      return runContentFactoryStage(job, payload, kind);
    case "content_revalidate":
      return runContentRevalidate(job, payload);
    case "strict_cleanup":
      return runStrictCleanup(job, payload);
    case "archive_cleanup":
      return runArchiveCleanup(job, payload);
    case "dedupe_cleanup":
      return runDedupeCleanup(job);
    case "sitemap_refresh":
      return runSitemapRefresh(job);
    case "report_generate":
      return runReportGenerate(job, payload);
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return { ok: false, errorMessage: `Unhandled job kind: ${job.jobKind}` };
    }
  }
}

/**
 * In-flight legacy `source_ingest` rows are translated into the
 * modern `source_discovery` factory entry-point. The legacy row
 * completes successfully so the planner can re-enqueue at the new
 * kind on its next tick.
 */
async function translateRemovedJobKind(job: QueueJobRow): Promise<DispatchResult> {
  logger.warn("worker.removed_job_kind_translated", {
    jobQueueId: job.id,
    legacyKind: job.jobKind,
    translatedTo: "source_discovery",
    sourceId: job.sourceId,
    jobName: job.jobName,
  });
  const { enqueueJob } = await import("./queue");
  const adapterKey =
    (job.payload as Record<string, unknown> | null)?.adapterKey ?? job.jobName;
  try {
    await enqueueJob({
      jobName: job.jobName,
      jobKind: "source_discovery",
      dedupeKey: `translated:${job.id}`,
      sourceId: job.sourceId,
      jobId: job.jobId,
      contentType: job.contentType,
      payload: {
        sourceId: job.sourceId,
        adapterKey,
        contentType: job.contentType ?? undefined,
        mode: "constant" as const,
      },
      triggeredBy: job.triggeredBy === "manual" ? "manual" : "automatic",
      actorUsername: job.actorUsername ?? null,
    });
  } catch (e) {
    return {
      ok: false,
      errorMessage: `Could not translate removed job kind '${job.jobKind}': ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
  return {
    ok: true,
    errorMessage: `Legacy '${job.jobKind}' translated to source_discovery`,
  };
}

async function runSourceFetch(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const sourceUrl = payload.sourceUrl as string | undefined;
  if (!sourceUrl) {
    return { ok: false, errorMessage: "source_fetch missing sourceUrl" };
  }
  let hostname: string;
  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    return { ok: false, errorMessage: `source_fetch: invalid url ${sourceUrl}` };
  }
  // Minimal fetcher — the worker is allowed to read the real network in
  // production. In the test environment a fixture-bound mock can shadow
  // this. We use the global `fetch` (Node 20+) directly.
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "ViaFideiContentFactory/1.0" },
    });
    const text = await res.text();
    const source = job.sourceId
      ? await prisma.ingestionSource.findUnique({ where: { id: job.sourceId } })
      : null;
    const sourcePurposes: Record<string, boolean> = source
      ? {
          canIngestPrayers: source.canIngestPrayers,
          canIngestSaints: source.canIngestSaints,
          canIngestApparitions: source.canIngestApparitions,
          canIngestParishes: source.canIngestParishes,
          canIngestDevotions: source.canIngestDevotions,
          canIngestNovenas: source.canIngestNovenas,
          canIngestSacraments: source.canIngestSacraments,
          canIngestRosaryGuides: source.canIngestRosaryGuides,
          canIngestConsecrations: source.canIngestConsecrations,
          canIngestSpiritualGuides: source.canIngestSpiritualGuides,
          canIngestLiturgy: source.canIngestLiturgy,
          canIngestHistory: source.canIngestHistory,
          canProvideScriptureText: source.canProvideScriptureText,
        }
      : {};
    await recordSourceDocument({
      sourceUrl,
      sourceHost: hostname,
      sourceId: job.sourceId ?? null,
      workerJobId: job.id,
      sourceTier: source?.tier ?? null,
      rawBody: text,
      httpStatus: res.status,
      etag: res.headers.get("etag"),
      lastModifiedHeader: res.headers.get("last-modified"),
      fetchStatus: res.ok ? "ok" : `http_${res.status}`,
      sourcePurposes,
    });
    return { ok: true, contentSeen: 1 };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runContentFactoryStage(
  job: QueueJobRow,
  payload: Record<string, unknown>,
  kind: "content_build" | "content_validate" | "content_persist",
): Promise<DispatchResult> {
  const sourceDocumentId = payload.sourceDocumentId as string | undefined;
  const sourceUrl = payload.sourceUrl as string | undefined;
  let document = null;
  if (sourceDocumentId) {
    document = await prisma.sourceDocument.findUnique({ where: { id: sourceDocumentId } });
  } else if (sourceUrl) {
    document = await prisma.sourceDocument.findUnique({ where: { sourceUrl } });
  }
  if (!document) {
    return { ok: false, errorMessage: `${kind} could not find SourceDocument` };
  }
  const contentType = payload.contentType as ContentTypeKey | undefined;
  if (!contentType) {
    return { ok: false, errorMessage: `${kind} missing contentType` };
  }
  const snapshot = await getSourceDocument(document.sourceUrl);
  if (!snapshot) {
    return { ok: false, errorMessage: `${kind} snapshot read failed` };
  }
  const result = await runContentFactory({
    contentType,
    document: snapshot,
    sourceId: job.sourceId ?? null,
    workerJobId: job.id,
    triggeredBy: job.triggeredBy === "manual" ? "manual" : "automatic",
  });
  return {
    ok:
      result.decision === "persisted-created" ||
      result.decision === "persisted-updated" ||
      result.decision === "persist-skipped",
    errorMessage: `factory decision=${result.decision}`,
  };
}

async function runStrictCleanup(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  try {
    const { runStrictContentCleanup } = await import("../../content-qa/cleanup");
    const { pruneOrphanedSaves } = await import("../../data/saved");
    const sweepReason = (payload.sweepReason as string) ?? "scheduled";
    const result = await runStrictContentCleanup({ sweepReason });
    // Sweep orphaned saves so a user's saved list never contains a
    // reference to content the factory just removed from public view.
    const orphans = await pruneOrphanedSaves().catch(() => ({
      prayers: 0,
      saints: 0,
      apparitions: 0,
      parishes: 0,
      devotions: 0,
    }));
    const orphanTotal =
      orphans.prayers + orphans.saints + orphans.apparitions + orphans.parishes + orphans.devotions;
    return {
      ok: true,
      errorMessage: `strict-cleanup deleted=${result.totalHardDeleted}, flaggedReady=${result.totalFlaggedReady}, flaggedUnready=${result.totalFlaggedUnready}, mode=${result.mode}, orphanSavesPruned=${orphanTotal}`,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runSourceJob(
  job: QueueJobRow,
  payload: Record<string, unknown>,
  kind: "source_freshness" | "source_discovery",
): Promise<DispatchResult> {
  const adapterKey = (payload.adapterKey as string) ?? job.jobName;
  const adapter = getAdapter(adapterKey);
  if (!adapter) {
    return { ok: false, errorMessage: `No registered adapter for ${adapterKey}` };
  }
  const source = job.sourceId
    ? await prisma.ingestionSource.findUnique({ where: { id: job.sourceId } })
    : null;
  const sourceHost = source?.host ?? job.jobName;
  try {
    const summary = await runAdapter(adapter, job.jobId, sourceHost, {
      triggeredBy: job.triggeredBy === "manual" ? "manual" : "automatic",
      actorUsername: job.actorUsername ?? null,
      // Stamp the queue-row id onto every RejectedContentLog row this
      // run produces so the deleted-log page can trace each rejection
      // back to the worker job that ingested it.
      workerJobId: job.id,
    });
    if (job.sourceId) {
      await recordSourceFreshness(job.sourceId, { ok: true }).catch(() => undefined);
      if (summary.recordsSeen > 0) {
        const reviewOrRejected = summary.recordsReviewRequired + summary.recordsFailed;
        await recordSourceQuality(job.sourceId, {
          totalItems: summary.recordsSeen,
          reviewOrRejected,
        }).catch(() => undefined);
      }
    }
    // Emit a synthetic SourceDocument + ContentPackageBuildLog row
    // for the run so the Content Factory dashboard sees activity even
    // from legacy source_ingest paths. The factory-native source_fetch
    // → content_build pipeline writes these rows per-item; the
    // legacy adapter path writes one aggregate row per run.
    if (summary.recordsSeen > 0) {
      const synthUrl = `legacy-runner://${adapterKey}/${job.id}`;
      try {
        await recordSourceDocument({
          sourceUrl: synthUrl,
          sourceHost: sourceHost,
          sourceId: job.sourceId ?? null,
          adapterKey,
          workerJobId: job.id,
          sourceTier: source?.tier ?? null,
          rawBody: `Legacy adapter run summary — ${summary.recordsSeen} items seen, ${summary.recordsCreated} created, ${summary.recordsUpdated} updated.`,
          fetchStatus: "ok",
          sourcePurposes: source
            ? buildLegacySourcePurposes(source)
            : ({} as Record<string, boolean>),
        });
        const aggregateStatus =
          summary.recordsCreated + summary.recordsUpdated > 0
            ? "built_complete_package"
            : summary.recordsFailed > 0
              ? "build_failed_missing_required_fields"
              : "duplicate";
        const { recordBuildLog } = await import("../../content-factory");
        await recordBuildLog({
          result: {
            outcome: aggregateStatus as never,
            contentType: (job.contentType ?? "Prayer") as never,
            builderName: `LegacyAdapter:${adapterKey}`,
            builderVersion: "legacy",
            ...(aggregateStatus === "built_complete_package"
              ? {
                  package: {
                    contentType: (job.contentType ?? "Prayer") as never,
                    slug: `legacy-run-${job.id}`,
                    title: `Legacy adapter ${adapterKey}`,
                    sourceUrl: synthUrl,
                    sourceHost: sourceHost,
                    payload: {
                      recordsCreated: summary.recordsCreated,
                      recordsUpdated: summary.recordsUpdated,
                    },
                    provenance: {},
                  },
                  missingFields: [],
                }
              : {
                  failureReason: `Legacy adapter run produced no valid rows (failed=${summary.recordsFailed})`,
                  missingFields: [],
                }),
          } as never,
          sourceUrl: synthUrl,
          sourceHost: sourceHost,
          workerJobId: job.id,
        });
      } catch (e) {
        logger.warn("worker.legacy_run_build_log_failed", {
          jobQueueId: job.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    const errorMessage = summary.errorMessage ?? undefined;
    if (summary.recordsFailed > 0 && summary.recordsSeen === 0) {
      return {
        ok: false,
        errorMessage: errorMessage ?? "adapter returned no records",
        contentSeen: 0,
      };
    }
    // Auto-trigger post-ingestion cleanup. The strict QA policy says
    // "every newly ingested batch must be revalidated immediately so
    // a bad row never lingers". We enqueue (not run inline) so the
    // discovery job stays fast and the cleanup is workable in parallel
    // by another worker.
    if (kind === "source_discovery" && summary.recordsSeen > 0) {
      const { autoEnqueuePostIngestionCleanup } = await import("./auto-cleanup");
      await autoEnqueuePostIngestionCleanup({
        sourceId: job.sourceId,
        contentType: job.contentType,
        workerJobId: job.id,
      }).catch((e) => {
        logger.warn("worker.post_ingestion_cleanup_enqueue_failed", {
          jobQueueId: job.id,
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      });
    }
    return {
      ok: true,
      errorMessage,
      contentSeen: summary.recordsSeen,
      contentReview: summary.recordsReviewRequired,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (job.sourceId) {
      await recordSourceFreshness(job.sourceId, {
        ok: false,
        errorMessage: message,
      }).catch(() => undefined);
    }
    return { ok: false, errorMessage: message };
  }
}

async function runContentRevalidate(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  try {
    // Two passes:
    //   1. catalog janitor — legacy text-shape cleanup (format / clean /
    //      classify against existing PUBLISHED rows). Repackages noise,
    //      diverts soft-fails to REVIEW, hard-deletes clear cruft.
    //   2. strict content QA cleanup — validates every catalog row
    //      against its package contract under the active cleanup
    //      policy (production: deleteAllInvalid=true,
    //      mode=all_catalog_rows). Rows that pass are flagged
    //      publicRenderReady + isThresholdEligible; rows that fail
    //      are deleted + logged.
    const { runStrictContentCleanup } = await import("../../content-qa/cleanup");
    const sweepReason = (payload.sweepReason as string) ?? "catalog_revalidate";
    const [janitor, strict] = await Promise.all([
      runCatalogJanitor().catch((e) => ({
        error: e instanceof Error ? e.message : String(e),
        totalRepackaged: 0,
        totalDivertedToReview: 0,
        totalHardDeleted: 0,
        buckets: [],
      })),
      runStrictContentCleanup({ sweepReason }).catch((e) => ({
        error: e instanceof Error ? e.message : String(e),
        totalInspected: 0,
        totalFlaggedReady: 0,
        totalFlaggedUnready: 0,
        totalHardDeleted: 0,
        totalLogFailures: 0,
        buckets: [],
        mode: "all_catalog_rows" as const,
        deleteAllInvalid: true,
        packageContractVersion: "unknown",
        ranAt: new Date(),
      })),
    ]);
    return {
      ok: true,
      errorMessage:
        `Repackaged ${janitor.totalRepackaged}, ` +
        `diverted ${janitor.totalDivertedToReview}, ` +
        `strict-QA flagged ${strict.totalFlaggedReady} ready, ` +
        `${strict.totalFlaggedUnready} unready, ` +
        `${strict.totalHardDeleted} hard-deleted, ` +
        `mode=${strict.mode}, ` +
        `logFailures=${strict.totalLogFailures}`,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runArchiveCleanup(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  const retentionDays = (payload.retentionDays as number) ?? 30;
  try {
    const summary = await purgeArchivedByArchivedAt(retentionDays);
    return {
      ok: true,
      errorMessage: `Purged ${summary.totalDeleted} archived rows`,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runDedupeCleanup(_job: QueueJobRow): Promise<DispatchResult> {
  try {
    const { archiveDuplicatePrayers } = await import("../../data/cleanup");
    const dedupedCount = await archiveDuplicatePrayers();
    return { ok: true, errorMessage: `Deduped ${dedupedCount} duplicate prayers` };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runSitemapRefresh(_job: QueueJobRow): Promise<DispatchResult> {
  // Future: hit /api/sitemap regenerate route. For now this is a
  // no-op the planner can fire on a cadence as a placeholder.
  logger.info("worker.sitemap_refresh.noop");
  return { ok: true, errorMessage: "sitemap refresh: no-op (placeholder)" };
}

async function runReportGenerate(
  _job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  // Reports are dispatched by the cron route; the queue-driven version
  // is reserved for ad-hoc admin-triggered regeneration. We pass the
  // payload through to the dispatcher.
  logger.info("worker.report_generate.requested", { reportKind: payload.reportKind });
  return { ok: true, errorMessage: `Report ${payload.reportKind} dispatched` };
}

function buildLegacySourcePurposes(source: {
  canIngestPrayers: boolean;
  canIngestSaints: boolean;
  canIngestApparitions: boolean;
  canIngestParishes: boolean;
  canIngestDevotions: boolean;
  canIngestNovenas: boolean;
  canIngestSacraments: boolean;
  canIngestRosaryGuides: boolean;
  canIngestConsecrations: boolean;
  canIngestSpiritualGuides: boolean;
  canIngestLiturgy: boolean;
  canIngestHistory: boolean;
  canProvideScriptureText: boolean;
}): Record<string, boolean> {
  return {
    canIngestPrayers: source.canIngestPrayers,
    canIngestSaints: source.canIngestSaints,
    canIngestApparitions: source.canIngestApparitions,
    canIngestParishes: source.canIngestParishes,
    canIngestDevotions: source.canIngestDevotions,
    canIngestNovenas: source.canIngestNovenas,
    canIngestSacraments: source.canIngestSacraments,
    canIngestRosaryGuides: source.canIngestRosaryGuides,
    canIngestConsecrations: source.canIngestConsecrations,
    canIngestSpiritualGuides: source.canIngestSpiritualGuides,
    canIngestLiturgy: source.canIngestLiturgy,
    canIngestHistory: source.canIngestHistory,
    canProvideScriptureText: source.canProvideScriptureText,
  };
}
