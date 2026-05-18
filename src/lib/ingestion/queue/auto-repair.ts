/**
 * Auto-repair worker.
 *
 * Consumes the pipeline-broken-here diagnostic and runs the
 * `automaticNextAction` for each broken stage:
 *
 *   source_document_waiting_for_build → enqueue content_build per
 *                                       allowed content type
 *   build_succeeded_but_no_qa         → enqueue a content_revalidate
 *                                       scoped to the orphan slug
 *   qa_passed_but_no_persistence      → enqueue a content_revalidate
 *                                       to retry persistence
 *   persisted_but_public_gate_failed  → enqueue a render-gate
 *                                       cleanup so the strict pass
 *                                       fixes or deletes the row
 *
 * The repair worker is idempotent — it relies on the same dedupe
 * keys the normal source_fetch → content_build chain uses, so a
 * second invocation cannot enqueue duplicate work.
 */

import { logger } from "../../observability/logger";
import { prisma } from "../../db/client";
import { getPipelineBrokenHereReport } from "../../diagnostics/pipeline-broken-here";
import { enqueueContentBuildsForSourceDocument } from "./build-enqueue";
import { autoEnqueuePostIngestionCleanup, autoEnqueueRenderGateCleanup } from "./auto-cleanup";
import type { ContentTypeKey } from "../../content-factory";

const PER_STAGE_REPAIR_LIMIT = 50;

export type AutoRepairAction =
  | { kind: "enqueue_content_build"; sourceDocumentId: string; sourceUrl: string }
  | { kind: "enqueue_revalidation"; slug: string; contentType: string }
  | { kind: "enqueue_render_gate_cleanup"; slug: string; contentType: string };

export type AutoRepairReport = {
  generatedAt: Date;
  actionsTaken: AutoRepairAction[];
  errors: Array<{ stage: string; message: string }>;
};

/**
 * Run one auto-repair pass. Each broken stage produces 0 or more
 * concrete actions; the report lists everything that ran (or failed).
 */
export async function runAutoRepairPass(): Promise<AutoRepairReport> {
  const report: AutoRepairReport = {
    generatedAt: new Date(),
    actionsTaken: [],
    errors: [],
  };
  const broken = await getPipelineBrokenHereReport();

  for (const entry of broken.entries) {
    try {
      if (entry.stage === "source_document_waiting_for_build") {
        let acted = 0;
        for (const sample of entry.samples) {
          if (acted >= PER_STAGE_REPAIR_LIMIT) break;
          if (!sample.sourceDocumentId) continue;
          const doc = await prisma.sourceDocument
            .findUnique({
              where: { id: sample.sourceDocumentId },
              select: {
                id: true,
                sourceUrl: true,
                sourceHost: true,
                contentChecksum: true,
                sourceId: true,
              },
            })
            .catch(() => null);
          if (!doc) continue;
          const source = doc.sourceId
            ? await prisma.ingestionSource
                .findUnique({ where: { id: doc.sourceId } })
                .catch(() => null)
            : null;
          await enqueueContentBuildsForSourceDocument({
            sourceDocumentId: doc.id,
            sourceUrl: doc.sourceUrl,
            sourceHost: doc.sourceHost,
            contentChecksum: doc.contentChecksum ?? null,
            source: source
              ? {
                  id: source.id,
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
              : null,
            requestedContentType: null,
            triggeredBy: "automatic",
          });
          report.actionsTaken.push({
            kind: "enqueue_content_build",
            sourceDocumentId: doc.id,
            sourceUrl: doc.sourceUrl,
          });
          acted += 1;
        }
      } else if (entry.stage === "build_succeeded_but_no_qa") {
        let acted = 0;
        for (const sample of entry.samples) {
          if (acted >= PER_STAGE_REPAIR_LIMIT) break;
          if (!sample.slug || !sample.contentType) continue;
          await autoEnqueuePostIngestionCleanup({
            sourceId: null,
            contentType: sample.contentType,
            workerJobId: null,
          });
          report.actionsTaken.push({
            kind: "enqueue_revalidation",
            slug: sample.slug,
            contentType: sample.contentType,
          });
          acted += 1;
        }
      } else if (entry.stage === "qa_passed_but_no_persistence") {
        // Same recovery as the QA-no-pass case: enqueue a revalidation
        // that will retry persistence or delete the orphan with a log.
        let acted = 0;
        for (const sample of entry.samples) {
          if (acted >= PER_STAGE_REPAIR_LIMIT) break;
          if (!sample.slug || !sample.contentType) continue;
          await autoEnqueuePostIngestionCleanup({
            sourceId: null,
            contentType: sample.contentType,
            workerJobId: null,
          });
          report.actionsTaken.push({
            kind: "enqueue_revalidation",
            slug: sample.slug,
            contentType: sample.contentType,
          });
          acted += 1;
        }
      } else if (entry.stage === "persisted_but_public_gate_failed") {
        let acted = 0;
        for (const sample of entry.samples) {
          if (acted >= PER_STAGE_REPAIR_LIMIT) break;
          if (!sample.slug || !sample.contentType) continue;
          await autoEnqueueRenderGateCleanup({
            contentType: sample.contentType,
            slug: sample.slug,
          });
          report.actionsTaken.push({
            kind: "enqueue_render_gate_cleanup",
            slug: sample.slug,
            contentType: sample.contentType,
          });
          acted += 1;
        }
      }
    } catch (e) {
      report.errors.push({
        stage: entry.stage,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  logger.info("auto-repair.completed", {
    actions: report.actionsTaken.length,
    errors: report.errors.length,
  });
  return report;
}

/** Optional helper: enqueue a single source document for rebuild. Used by the admin "replay" action. */
export async function replaySourceDocument(args: {
  sourceDocumentId: string;
  contentType?: ContentTypeKey;
}): Promise<{ enqueued: number; reason?: string }> {
  const doc = await prisma.sourceDocument
    .findUnique({
      where: { id: args.sourceDocumentId },
      select: {
        id: true,
        sourceUrl: true,
        sourceHost: true,
        contentChecksum: true,
        sourceId: true,
      },
    })
    .catch(() => null);
  if (!doc) return { enqueued: 0, reason: "source_document_not_found" };
  const source = doc.sourceId
    ? await prisma.ingestionSource.findUnique({ where: { id: doc.sourceId } }).catch(() => null)
    : null;
  const result = await enqueueContentBuildsForSourceDocument({
    sourceDocumentId: doc.id,
    sourceUrl: doc.sourceUrl,
    sourceHost: doc.sourceHost,
    contentChecksum: doc.contentChecksum ?? null,
    source: source
      ? {
          id: source.id,
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
      : null,
    requestedContentType: args.contentType ?? null,
    triggeredBy: "manual",
  });
  return { enqueued: result.enqueuedCount };
}
