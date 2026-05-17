import type { ContentStatus } from "@prisma/client";
import { appConfig } from "../config";
import { recordDataManagementLogs, type DataManagementLogInput } from "../data/data-management-log";
import { prisma } from "../db/client";
import { withAdvisoryLock } from "../concurrency/lock";
import { logger } from "../observability/logger";
import type { ConditionalState, IngestedItem, IngestionRunSummary, SourceAdapter } from "./types";
import { sanitize } from "./validate";
import { formatIngestedItems } from "./format";
import { cleanIngestedItems } from "./clean";
import { classifyIngestedItems } from "./classify";
import { repairIngestedItem } from "./format-repair";
import { enrichIngestedItems } from "./enrich";
import { persistItems } from "./persist";
import { enrichDecision } from "./enrich-decision";
import { applyDecisionScores } from "./apply-decision";
import { applyBatchSizeLimit } from "./batch-size";
import { recordSourceQuality } from "../data/source-health";
import { runStrictQAOnIngestedItemAsync } from "./strict-qa-bridge";
import { applyStrictPackageFlags } from "./strict-package-flags";
import { recordRejectedContentBatch } from "../content-qa/rejected-log";
import type { ContractValidationResult } from "../content-qa/types";

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
  /**
   * IngestionJobQueue row id that triggered this run. Stamped onto every
   * RejectedContentLog row produced by the strict QA pipeline so the
   * deleted-log page can trace each rejection back to a worker job.
   */
  workerJobId?: string | null;
  /**
   * IngestionBatch id this run is part of. Stamped onto every
   * RejectedContentLog row so the deleted-log page can group rejections
   * by ingestion batch.
   */
  ingestionBatchId?: string | null;
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
      items: rawItems,
      notModified,
      exhausted,
      conditionalState: nextState,
    } = await adapter.fetch({
      sourceHost,
      jobName: adapter.key,
      conditionalState,
    });

    // Adapter-driven exhaustion: if the adapter signals that there
    // are no more items at this source/cursor, mark the source as
    // exhausted so the planner stops re-enqueuing source_discovery
    // jobs for it. Freshness jobs in maintenance mode still run.
    if (exhausted && jobId) {
      try {
        const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (job?.sourceId) {
          await prisma.ingestionSource.update({
            where: { id: job.sourceId },
            data: { exhaustedAt: new Date(), healthState: "exhausted" },
          });
        }
      } catch (e) {
        logger.warn("ingestion.run.exhausted_mark_failed", {
          jobId,
          adapter: adapter.key,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Batch-size enforcement for very large sources. The cap is read
    // from `IngestionJob.batchSizeLimit` (per job) and falls back to
    // a global hard limit of 5000. The remainder of the batch is
    // left for the next tick — cursors handle the resume.
    const sized = await applyBatchSizeLimit(jobId, rawItems);
    const items = sized.items;
    if (sized.truncated) {
      logger.info("ingestion.run.batch_truncated", {
        adapter: adapter.key,
        sourceHost,
        jobId,
        seen: rawItems.length,
        cap: sized.cap,
      });
    }

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

    // Intelligent packaging pipeline. Each stage transforms or filters
    // items so the catalog ends up clean.
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
    //   5. sanitize  — final per-kind validator. Three outcomes:
    //                    • valid    → PUBLISHED
    //                    • soft     → REVIEW (imperfect-but-real)
    //                    • noise    → HARD-DELETED (landing pages,
    //                                 navigation cruft, meta-
    //                                 descriptions — never had any
    //                                 place in the catalog)
    //                    • rejected → not persisted (structurally
    //                                 invalid: missing slug, off-
    //                                 allowlist source, protected
    //                                 kind)
    // Strict repair runs BEFORE format/clean — fixes HTML entities,
    // strips unsafe markup, and normalizes whitespace so the
    // downstream stages see well-shaped text.
    const repaired = items.map(repairIngestedItem);
    const formatted = formatIngestedItems(repaired);
    const cleaned = cleanIngestedItems(formatted);
    const classifyResults = classifyIngestedItems(cleaned);
    const reclassified = classifyResults.map((r) => r.item);
    const enriched = enrichIngestedItems(reclassified);
    const { valid, review, noise, rejected } = sanitize(enriched);

    const triggeredBy = options.triggeredBy ?? "automatic";
    const persistOptions = {
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
      sourceName: options.sourceName ?? sourceHost,
      jobName: adapter.key,
      // We accumulate logs ourselves so review items, deleted items,
      // and persisted items all land in the same batched
      // DataManagementLog write.
      skipDataManagementLog: true,
    } as const;

    // Strict Content QA pipeline pass. Each item is run through its
    // typed package contract. The contract decision (publish / update /
    // skip / reject / delete / archive / review) replaces the old
    // "REVIEW-by-default" routing:
    //
    //   - publish → persist with publicRenderReady + isThresholdEligible
    //   - reject  → DO NOT persist; write RejectedContentLog
    //   - delete  → DO NOT persist; write RejectedContentLog
    //
    // Items that fail the strict contract are NEVER routed to REVIEW
    // by the automatic pipeline. REVIEW remains an optional admin
    // holding area, but the strict pipeline does not produce it.
    const strictResults: Array<{
      item: IngestedItem;
      strict: ContractValidationResult;
    }> = [];
    for (const item of valid) {
      const strict = await runStrictQAOnIngestedItemAsync(item).catch((e) => {
        logger.warn("ingestion.run.strict_qa_failed", {
          slug: (item as { slug?: string }).slug ?? null,
          kind: item.kind,
          error: e instanceof Error ? e.message : String(e),
        });
        return null;
      });
      if (strict) strictResults.push({ item, strict });
    }
    const strictApproved = strictResults.filter(
      (r) => r.strict.decision === "publish" || r.strict.decision === "update",
    );
    const strictRejected = strictResults.filter(
      (r) => r.strict.decision === "reject" || r.strict.decision === "delete",
    );

    // Legacy enrich/decision is now informational only — it still runs
    // for source-tier scoring, but the automatic pipeline NEVER
    // persists strict-approved items as REVIEW. The user spec is
    // explicit: 'The app should have no automatic path that saves
    // failed content as review.' Items that pass strict QA become
    // PUBLISHED. Items that fail strict QA were already moved to
    // strictRejected above and never reach this persist step.
    const validDecisions = strictApproved.map(({ item }) => ({
      item,
      decision: enrichDecision(item),
    }));
    const acceptedForPublish = validDecisions.map((d) => d.item);
    const counts = await persistItems(acceptedForPublish, initialStatus, persistOptions);
    const tierReviewCounts: typeof counts = {
      created: 0,
      updated: 0,
      skipped: 0,
      logs: [] as DataManagementLogInput[],
      details: [] as Array<{
        kind: string;
        slug: string;
        outcome: "created" | "updated" | "skipped";
      }>,
    };
    // Apply scoring onto every row that the persister actually
    // created or updated. Skipped items keep the scores they already
    // had (or none) so an idempotent re-run does not generate
    // unnecessary UPDATEs.
    const decisionBySlug = new Map(
      validDecisions
        .map((d) => {
          const slug = (d.item as { slug?: string }).slug ?? "";
          return slug ? ([slug, d] as const) : null;
        })
        .filter((x): x is readonly [string, (typeof validDecisions)[number]] => x !== null),
    );
    await Promise.all(
      [...counts.details, ...tierReviewCounts.details]
        .filter((d) => d.outcome !== "skipped")
        .map((d) => {
          const decision = decisionBySlug.get(d.slug);
          if (!decision) return Promise.resolve();
          const isReview = decision.decision.action !== "publish";
          const status = isReview ? "REVIEW" : initialStatus;
          return applyDecisionScores(d.kind, d.slug, decision.decision, status);
        }),
    );

    // Apply strict-pipeline package flags onto every persisted item
    // (publicRenderReady, isThresholdEligible, packageValidationStatus,
    // contentPackageVersion, lastPackageValidatedAt) so the public-page
    // gate and the strict threshold counters can read them.
    const strictBySlug = new Map(
      strictApproved
        .map(({ item, strict }) => {
          const slug = (item as { slug?: string }).slug ?? "";
          return slug ? ([slug, { item, strict }] as const) : null;
        })
        .filter(
          (x): x is readonly [string, { item: IngestedItem; strict: ContractValidationResult }] =>
            x !== null,
        ),
    );
    await Promise.all(
      [...counts.details, ...tierReviewCounts.details]
        .filter((d) => d.outcome !== "skipped")
        .map((d) => {
          const entry = strictBySlug.get(d.slug);
          if (!entry) return Promise.resolve();
          return applyStrictPackageFlags({
            contentType: entry.strict.contentType,
            slug: d.slug,
            result: entry.strict,
          }).catch(() => undefined);
        }),
    );

    // Strict-rejected and strict-deleted items: write to RejectedContentLog.
    if (strictRejected.length > 0) {
      const rejectedEntries = strictRejected.map(({ item, strict }) => ({
        contentType: strict.contentType,
        slug: (item as { slug?: string }).slug ?? null,
        originalTitle:
          (item as { defaultTitle?: string }).defaultTitle ??
          (item as { title?: string }).title ??
          (item as { canonicalName?: string }).canonicalName ??
          (item as { name?: string }).name ??
          null,
        sourceUrl: ((): string | null => {
          const key = (item as { externalSourceKey?: string }).externalSourceKey;
          return key ? (/^https?:\/\//i.test(key) ? key : null) : null;
        })(),
        sourceHost: ((): string | null => {
          const key = (item as { externalSourceKey?: string }).externalSourceKey;
          if (!key) return null;
          if (/^https?:\/\//i.test(key)) {
            try {
              return new URL(key).host.toLowerCase();
            } catch {
              return null;
            }
          }
          const colon = key.indexOf(":");
          const head = colon > 0 ? key.slice(0, colon) : key;
          return head.toLowerCase();
        })(),
        rejectionReason: strict.reason,
        failedContractName: strict.contractName,
        failedFields: strict.failedFields,
        originalChecksum: null,
        decision: strict.decision as "reject" | "delete",
        triggeredBy: triggeredBy,
        actorUsername: options.actorUsername ?? null,
        workerJobId: options.workerJobId ?? null,
        ingestionBatchId: options.ingestionBatchId ?? null,
      }));
      await recordRejectedContentBatch(rejectedEntries).catch((err) => {
        logger.warn("ingestion.run.rejected_log_failed", {
          adapter: adapter.key,
          sourceHost,
          jobId,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
    }
    // Per-source quality observation: ratio of items that landed in
    // REVIEW/REJECT vs total. Smoothed into IngestionSource.lowQualityRatio
    // so the source health dashboard can flag chronically low-quality
    // sources.
    const lowQualityCount = review.length + rejected.length + strictRejected.length;
    if (jobId && items.length > 0) {
      const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
      if (job?.sourceId) {
        await recordSourceQuality(job.sourceId, {
          totalItems: items.length,
          reviewOrRejected: lowQualityCount,
        }).catch(() => undefined);
      }
    }
    // Soft-fail items (imperfect-but-real) are NO LONGER persisted as
    // REVIEW automatically. The user spec is explicit: 'The app should
    // have no automatic path that saves failed content as review.'
    // We log them as rejections instead so the admin can see why they
    // were dropped, then we do not write anything to the public table.
    const reviewCounts = {
      created: 0,
      updated: 0,
      skipped: 0,
      logs: [] as DataManagementLogInput[],
    };
    const softFailRejectionLogs: DataManagementLogInput[] = review.map(({ item, reason }) => ({
      action: "REJECT",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Soft-fail dropped (no automatic REVIEW route): ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    // Noise: clearly non-content items (landing pages, navigation
    // cruft, meta-descriptions). The intelligent packager hard-deletes
    // these by not persisting them at all and emitting a single DELETE
    // log row per item so the operator can see what the janitor
    // dropped — no archive, no review, just gone.
    const noiseLogs: DataManagementLogInput[] = noise.map(({ item, reason }) => ({
      action: "DELETE",
      contentType: ENTITY_TYPE_BY_KIND[item.kind] ?? "Unknown",
      contentRef:
        (item as { slug?: string }).slug ??
        (item as { defaultTitle?: string }).defaultTitle ??
        (item as { title?: string }).title ??
        (item as { canonicalName?: string }).canonicalName ??
        null,
      reason: `Discarded as noise (landing page / nav cruft / meta-description): ${reason}`,
      triggeredBy,
      actorUsername: options.actorUsername ?? null,
    }));

    // Structural rejections: missing slug, off-allowlist, protected
    // kind. These never reach the catalog and never make it past the
    // sanitize() function — they go straight to the REJECT log.
    const rejectionLogs: DataManagementLogInput[] = rejected.map(({ item, reason }) => ({
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

    const allLogs: DataManagementLogInput[] = [
      ...counts.logs,
      ...reviewCounts.logs,
      ...tierReviewCounts.logs,
      ...reclassifyLogs,
      ...softReviewLogs,
      ...noiseLogs,
      ...rejectionLogs,
      ...softFailRejectionLogs,
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
    // diverted them, or because the source-tier router diverted them),
    // every persisted row in that bucket counts toward the review queue.
    const directReview = initialStatus === "REVIEW" ? counts.created + counts.updated : 0;
    const softReview = reviewCounts.created + reviewCounts.updated;
    const tierReview = tierReviewCounts.created + tierReviewCounts.updated;

    const summary: IngestionRunSummary = {
      recordsSeen: items.length,
      recordsCreated: counts.created + reviewCounts.created + tierReviewCounts.created,
      recordsUpdated: counts.updated + reviewCounts.updated + tierReviewCounts.updated,
      recordsSkipped:
        counts.skipped +
        reviewCounts.skipped +
        tierReviewCounts.skipped +
        noise.length +
        rejected.length +
        strictRejected.length,
      recordsFailed: 0,
      recordsReviewRequired: directReview + softReview + tierReview,
      errorMessage:
        noise.length || rejected.length || review.length || tierReview || strictRejected.length
          ? `${noise.length} discarded as noise, ${rejected.length + strictRejected.length} rejected (${strictRejected.length} by strict QA), ${review.length + tierReview} routed to REVIEW`
          : null,
    };

    if (run) {
      await prisma.ingestionJobRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: rejected.length > 0 ? "PARTIAL" : "SUCCESS",
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
      noiseDiscarded: noise.length,
      rejected: rejected.length,
      partial: rejected.length > 0,
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
