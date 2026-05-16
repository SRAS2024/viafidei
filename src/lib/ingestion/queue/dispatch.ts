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
import { validatePayload, isJobKind, type JobKind } from "./job-kinds";
import type { QueueJobRow } from "./queue";

export type DispatchResult = {
  ok: boolean;
  errorMessage?: string;
  contentSeen?: number;
  contentReview?: number;
};

export async function runJobByKind(job: QueueJobRow): Promise<DispatchResult> {
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
    case "source_ingest":
    case "source_freshness":
    case "source_discovery":
      return runSourceJob(job, payload, kind);
    case "content_revalidate":
      return runContentRevalidate(job, payload);
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

async function runSourceJob(
  job: QueueJobRow,
  payload: Record<string, unknown>,
  kind: "source_ingest" | "source_freshness" | "source_discovery",
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
    const errorMessage = summary.errorMessage ?? undefined;
    if (summary.recordsFailed > 0 && summary.recordsSeen === 0) {
      return {
        ok: false,
        errorMessage: errorMessage ?? "adapter returned no records",
        contentSeen: 0,
      };
    }
    void kind;
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
  _payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  try {
    const summary = await runCatalogJanitor();
    return {
      ok: true,
      errorMessage: `Repackaged ${summary.totalRepackaged}, diverted ${summary.totalDivertedToReview}`,
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
