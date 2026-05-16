import type { ContentStatus } from "@prisma/client";
import { appConfig } from "../config";
import { recordDataManagementLogs, type DataManagementLogInput } from "../data/data-management-log";
import { prisma } from "../db/client";
import { withAdvisoryLock } from "../concurrency/lock";
import { logger } from "../observability/logger";
import type { ConditionalState, IngestionRunSummary, SourceAdapter } from "./types";
import { sanitize } from "./validate";
import { formatIngestedItems } from "./format";
import { cleanIngestedItems } from "./clean";
import { classifyIngestedItems } from "./classify";
import { enrichIngestedItems } from "./enrich";
import { persistItems } from "./persist";

export type RunnerOptions = {
  /**
   * Status assigned to newly-created or revived items. Defaults to the
   * configured initial status (REVIEW) so nothing scraped becomes live
   * without explicit approval.
   */
  initialStatus?: ContentStatus;
  /** When true, skips DB locking. Used by tests. */
  skipLock?: boolean;
  /** Identifier for who triggered the run ("automatic" cron, "manual" admin). */
  triggeredBy?: "automatic" | "manual";
  /** Admin username for manual runs — flows into DataManagementLog rows. */
  actorUsername?: string | null;
  /** Source display name (e.g. "Vatican"). Used in log reasons. */
  sourceName?: string;
};

const ENTITY_TYPE_BY_KIND: Record<string, string> = {
  prayer: "Prayer",
  saint: "Saint",
  apparition: "MarianApparition",
  parish: "Parish",
  devotion: "Devotion",
  liturgy: "LiturgyEntry",
  guide: "SpiritualLifeGuide",
};

function defaultInitialStatus(): ContentStatus {
  return appConfig.ingestion.initialStatus;
}

const NO_OP_SUMMARY: IngestionRunSummary = {
  recordsSeen: 0,
  recordsCreated: 0,
  recordsUpdated: 0,
  recordsSkipped: 0,
  recordsFailed: 0,
  recordsReviewRequired: 0,
  errorMessage: null,
};

/**
 * Conditional-request state (ETag / Last-Modified) is round-tripped through
 * the `errorMessage` JSON blob so adapters can short-circuit on 304s without
 * adding a dedicated column. `loadPriorState` parses the most recent
 * SUCCESS run's payload back out.
 */
async function loadPriorState(jobId: string): Promise<ConditionalState | undefined> {
  const lastSuccess = await prisma.ingestionJobRun.findFirst({
    where: { jobId, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
  });
  if (!lastSuccess?.errorMessage) return undefined;
  try {
    const parsed = JSON.parse(lastSuccess.errorMessage) as Partial<ConditionalState>;
    if (parsed.etag || parsed.lastModified) return parsed;
  } catch {
    // older runs may not contain JSON
  }
  return undefined;
}

export async function runAdapter(
  adapter: SourceAdapter,
  jobId: string | null,
  sourceHost: string,
  options: RunnerOptions = {},
): Promise<IngestionRunSummary> {
  const lockKey = `ingest:${adapter.key}`;
  const exec = () => runAdapterUnlocked(adapter, jobId, sourceHost, options);
  if (options.skipLock) return exec();
  const result = await withAdvisoryLock(lockKey, exec);
  if (result) return result;
  logger.warn("ingestion.run.skipped_locked", { adapter: adapter.key, sourceHost, lockKey });
  return {
    ...NO_OP_SUMMARY,
    errorMessage: `Skipped: another runner holds lock '${lockKey}'`,
  };
}

async function runAdapterUnlocked(
  adapter: SourceAdapter,
  jobId: string | null,
  sourceHost: string,
  options: RunnerOptions,
): Promise<IngestionRunSummary> {
  const initialStatus = options.initialStatus ?? defaultInitialStatus();
  const startedAt = new Date();

  logger.info("ingestion.run.started", {
    adapter: adapter.key,
    sourceHost,
    jobId,
    initialStatus,
  });

  const run = jobId
    ? await prisma.ingestionJobRun.create({
        data: { jobId, startedAt, status: "RUNNING" },
      })
    : null;

  try {
    const conditionalState = jobId ? await loadPriorState(jobId) : undefined;
    const {
      items,
      notModified,
      conditionalState: nextState,
    } = await adapter.fetch({
      sourceHost,
      jobName: adapter.key,
      conditionalState,
    });

    if (notModified) {
      const summary: IngestionRunSummary = { ...NO_OP_SUMMARY };
      if (run) {
        await prisma.ingestionJobRun.update({
          where: { id: run.id },
          data: {
            finishedAt: new Date(),
            status: "SUCCESS",
            recordsSeen: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
            recordsSkipped: 0,
            recordsFailed: 0,
            recordsReviewRequired: 0,
            errorMessage: nextState ? JSON.stringify(nextState) : null,
          },
        });
      }
      logger.info("ingestion.run.not_modified", {
        adapter: adapter.key,
        sourceHost,
        jobId,
        durationMs: Date.now() - startedAt.getTime(),
      });
      return summary;
    }

    // Intelligent packaging pipeline. Each stage transforms the items
    // rather than dropping them, so content survives boundary cases
    // that the strict validator would otherwise reject.
    //
    //   1. format    — canonical text shape (entity decode, smart-quote
    //                  fold, whitespace normalisation).
    //   2. clean     — strip navigation / cookie / share-this / footer /
    //                  newsletter / donation boilerplate from text
    //                  fields. The surrounding content survives.
    //   3. classify  — re-route the item's `kind` when the body reads
    //                  more like another kind (a "prayer" page whose
    //                  body is actually a saint biography is sent to
    //                  the Saint bucket, not bounced).
    //   4. enrich    — fill in missing required + helpful fields from
    //                  signals already in the text: prayer category,
    //                  saint patronages + feast day, apparition
    //                  location + country + status, parish diocese +
    //                  city + region + country, devotion duration +
    //                  tags, liturgy kind, guide kind.
    //   5. sanitize  — final per-kind validator. Hard-fails are routed
    //                  to REVIEW (not dropped) so an admin can decide;
    //                  soft-fails are routed to REVIEW with their
    //                  category-fix reason. Only items still missing
    //                  the absolute basics (slug, body) after every
    //                  stage above end up unsaved — and even those
    //                  produce a structured log row so the operator
    //                  can see why.
    const formatted = formatIngestedItems(items);
    const cleaned = cleanIngestedItems(formatted);
    const classifyResults = classifyIngestedItems(cleaned);
    const reclassified = classifyResults.map((r) => r.item);
    const enriched = enrichIngestedItems(reclassified);
    const { valid, review, rejected } = sanitize(enriched);

    const triggeredBy = options.triggeredBy ?? "automatic";
    const persistOptions = {
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
      sourceName: options.sourceName ?? sourceHost,
      jobName: adapter.key,
      // We accumulate logs ourselves so review items, archived items,
      // and persisted items all land in the same batched
      // DataManagementLog write.
      skipDataManagementLog: true,
    } as const;

    // Items that pass every check are persisted with the configured
    // `initialStatus` (PUBLISHED for auto-publish, REVIEW for staged
    // moderation).
    const counts = await persistItems(valid, initialStatus, persistOptions);
    // Items that fail a soft (category-heuristic) check are persisted
    // with `status = REVIEW` so a moderator can decide whether the
    // content is genuinely Catholic but mis-shaped, or really a
    // source-summary blurb that should be archived.
    const reviewCounts =
      review.length > 0
        ? await persistItems(
            review.map((r) => r.item),
            "REVIEW" as ContentStatus,
            persistOptions,
          )
        : { created: 0, updated: 0, skipped: 0, logs: [] as DataManagementLogInput[] };
    // Hard-fail items USED to be dropped entirely. The new policy is
    // "package and keep" — anything that still trips the hard
    // validator after format → clean → classify → enrich is
    // structurally weak (missing required slug / fields / unrecognised
    // enum, or off-allowlist source). For off-allowlist sources we
    // still refuse to persist (the URL is outside the credibility
    // gate); for every other reason we route to REVIEW with an
    // explanatory log so the content survives for human inspection.
    const offAllowlist: typeof rejected = [];
    const weakReview: typeof rejected = [];
    for (const entry of rejected) {
      // A row that cannot physically exist in the database (no slug,
      // required column missing) is still a true rejection — the
      // persister would throw a unique-constraint error otherwise.
      // Off-allowlist / protected-kind are credibility-boundary
      // violations and also stay in REJECT. Everything else — a
      // body that's slightly too short, a recognised-but-unusual
      // approvedStatus, etc. — is preserved as REVIEW.
      const isUnsavable =
        /slug is required|name is required|defaultTitle is required|canonicalName is required|title is required|body is required|summary is required|biography is required|approvedStatus is required/i.test(
          entry.reason,
        );
      const isCredibilityBoundary =
        /Vatican-approved host|protected user-generated|non-Catholic place of worship/i.test(
          entry.reason,
        );
      if (isUnsavable || isCredibilityBoundary) {
        offAllowlist.push(entry);
      } else {
        weakReview.push(entry);
      }
    }
    const weakReviewCounts =
      weakReview.length > 0
        ? await persistItems(
            weakReview.map((r) => r.item),
            "REVIEW" as ContentStatus,
            persistOptions,
          )
        : { created: 0, updated: 0, skipped: 0, logs: [] as DataManagementLogInput[] };

    // Off-allowlist + protected-kind items are the only ones we still
    // refuse outright — those are credibility-boundary violations and
    // belong in the REJECT log so the source pipeline can be audited.
    const rejectionLogs: DataManagementLogInput[] = offAllowlist.map(({ item, reason }) => ({
      action: "REJECT",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Rejected by validator: ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    // Re-classified items: log when the classifier changed the
    // adapter's `kind` so the admin can see which buckets the
    // packager is routing things into.
    const reclassifyLogs: DataManagementLogInput[] = classifyResults
      .filter((r) => r.newKind !== r.originalKind)
      .map((r) => ({
        action: "CATEGORY_FIX",
        contentType: ENTITY_TYPE_BY_KIND[r.newKind] ?? "Unknown",
        contentRef:
          (r.item as { slug?: string }).slug ??
          (r.item as { defaultTitle?: string }).defaultTitle ??
          (r.item as { title?: string }).title ??
          (r.item as { canonicalName?: string }).canonicalName ??
          null,
        reason: `Re-classified from ${r.originalKind} → ${r.newKind} by content classifier`,
        triggeredBy,
        actorUsername: options.actorUsername ?? null,
      }));

    // Soft-review items are persisted as REVIEW; tag them so the admin
    // can see *why* they were diverted.
    const softReviewLogs: DataManagementLogInput[] = review.map(({ item, reason }) => ({
      action: "CATEGORY_FIX",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Sent to review: ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    // Weak-review items (hard validator failure → kept as REVIEW) get
    // a distinct log entry so the admin can filter for them on
    // /admin/logs/data-management.
    const weakReviewLogs: DataManagementLogInput[] = weakReview.map(({ item, reason }) => ({
      action: "CATEGORY_FIX",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Kept as REVIEW after hard validator failure: ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    const allLogs: DataManagementLogInput[] = [
      ...counts.logs,
      ...reviewCounts.logs,
      ...weakReviewCounts.logs,
      ...reclassifyLogs,
      ...softReviewLogs,
      ...weakReviewLogs,
      ...rejectionLogs,
    ];
    if (allLogs.length > 0) {
      await recordDataManagementLogs(allLogs).catch((err) => {
        logger.warn("ingestion.run.data_management_log_failed", {
          adapter: adapter.key,
          sourceHost,
          jobId,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // When new + updated rows land in REVIEW status (either because the
    // configured initialStatus is REVIEW, or because the soft validator
    // diverted them), every persisted row in that bucket counts toward
    // the review queue. Weak-review items (hard validator failures kept
    // for human inspection) also count.
    const directReview = initialStatus === "REVIEW" ? counts.created + counts.updated : 0;
    const softReview = reviewCounts.created + reviewCounts.updated;
    const weakReviewTotal = weakReviewCounts.created + weakReviewCounts.updated;

    const summary: IngestionRunSummary = {
      recordsSeen: items.length,
      recordsCreated: counts.created + reviewCounts.created + weakReviewCounts.created,
      recordsUpdated: counts.updated + reviewCounts.updated + weakReviewCounts.updated,
      recordsSkipped:
        counts.skipped + reviewCounts.skipped + weakReviewCounts.skipped + offAllowlist.length,
      recordsFailed: 0,
      recordsReviewRequired: directReview + softReview + weakReviewTotal,
      errorMessage:
        offAllowlist.length || weakReview.length || review.length
          ? `${offAllowlist.length} rejected (off-allowlist / protected), ${weakReview.length} kept as REVIEW (weak), ${review.length} routed to REVIEW (soft category)`
          : null,
    };

    if (run) {
      await prisma.ingestionJobRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: offAllowlist.length > 0 ? "PARTIAL" : "SUCCESS",
          recordsSeen: summary.recordsSeen,
          recordsCreated: summary.recordsCreated,
          recordsUpdated: summary.recordsUpdated,
          recordsSkipped: summary.recordsSkipped,
          recordsFailed: summary.recordsFailed,
          recordsReviewRequired: summary.recordsReviewRequired,
          errorMessage: nextState ? JSON.stringify(nextState) : summary.errorMessage,
        },
      });
    }

    const reclassifiedCount = classifyResults.filter((r) => r.newKind !== r.originalKind).length;

    logger.info("ingestion.run.completed", {
      adapter: adapter.key,
      sourceHost,
      jobId,
      durationMs: Date.now() - startedAt.getTime(),
      recordsSeen: summary.recordsSeen,
      recordsCreated: summary.recordsCreated,
      recordsUpdated: summary.recordsUpdated,
      recordsSkipped: summary.recordsSkipped,
      recordsFailed: summary.recordsFailed,
      recordsReviewRequired: summary.recordsReviewRequired,
      published: initialStatus === "PUBLISHED" ? counts.created + counts.updated : 0,
      reclassified: reclassifiedCount,
      weakReviewKept: weakReview.length,
      rejected: offAllowlist.length,
      partial: offAllowlist.length > 0,
    });

    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (run) {
      await prisma.ingestionJobRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "FAILED",
          recordsFailed: 1,
          errorMessage,
        },
      });
    }
    // Also write a FAIL row to DataManagementLog so the admin log page
    // explains every run-level failure — not just the per-item REJECT
    // rows. Without this, an entire scheduler tick that 503s upstream
    // is invisible to anyone watching /admin/logs/data-management.
    await recordDataManagementLogs([
      {
        action: "FAIL",
        contentType: "IngestionRun",
        contentRef: adapter.key,
        reason: `Run failed: ${errorMessage.slice(0, 240)}`,
        triggeredBy: options.triggeredBy ?? "automatic",
        actorUsername: options.actorUsername ?? null,
      },
    ]).catch((err) => {
      logger.warn("ingestion.run.fail_log_failed", {
        adapter: adapter.key,
        sourceHost,
        jobId,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
    logger.error("ingestion.run.failed", {
      adapter: adapter.key,
      sourceHost,
      jobId,
      durationMs: Date.now() - startedAt.getTime(),
      errorMessage,
    });
    return { ...NO_OP_SUMMARY, recordsFailed: 1, errorMessage };
  }
}
