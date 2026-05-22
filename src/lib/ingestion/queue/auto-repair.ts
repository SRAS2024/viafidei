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
          // Spec #10: load the full source-document fields needed to
          // rebuild router signals. Auto-repair must not enqueue every
          // source-approved content type — it must apply the same
          // router gate the normal source_fetch → content_build chain
          // applies, so a wrong-source URL doesn't get repaired into
          // a wrong-content build.
          const doc = await prisma.sourceDocument
            .findUnique({
              where: { id: sample.sourceDocumentId },
              select: {
                id: true,
                sourceUrl: true,
                sourceHost: true,
                contentChecksum: true,
                sourceId: true,
                sourceTitle: true,
                headingsJson: true,
                metadataJson: true,
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
            // Router signals from the SourceDocument so the router
            // can reject hard-negative URLs and narrow to types with
            // a strong positive signal. Without these, auto-repair
            // would enqueue every source-approved type and a wrong-
            // URL source document would re-fail per type.
            routerSignals: {
              title: doc.sourceTitle ?? null,
              headings: (doc.headingsJson ?? null) as ReadonlyArray<{
                level: number;
                text: string;
              }> | null,
              metadata: (doc.metadataJson ?? null) as Record<string, string | undefined> | null,
            },
            // Auto-repair runs automatically; the "auto_repair" label
            // is carried in the payload for diagnostics but does NOT
            // bypass the failed-current-version skip rule. Admin
            // manual replay is the only path that bypasses that rule.
            triggeredBy: "auto_repair",
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

/**
 * Optional helper: enqueue a single source document for rebuild. Used
 * by the admin "replay" action. Spec #11: `forceRebuild` lets an
 * admin retry a build that failed at the current builder version,
 * recovering after a parser / router / source-config fix without
 * needing to bump the builder version artificially.
 */
export async function replaySourceDocument(args: {
  sourceDocumentId: string;
  contentType?: ContentTypeKey;
  /**
   * When true, bypass the "previous_build_failed_at_current_builder_version"
   * skip rule so a post-fix rebuild can proceed. Defaults to true for
   * admin replay because the assumed use case IS the post-fix repair.
   * Pass `forceRebuild: false` for a cautious "would this still skip?"
   * dry-run-style check.
   */
  forceRebuild?: boolean;
}): Promise<{ enqueued: number; reason?: string; skippedReasons?: Record<string, string> }> {
  const doc = await prisma.sourceDocument
    .findUnique({
      where: { id: args.sourceDocumentId },
      select: {
        id: true,
        sourceUrl: true,
        sourceHost: true,
        contentChecksum: true,
        sourceId: true,
        sourceTitle: true,
        headingsJson: true,
        metadataJson: true,
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
    triggeredBy: "admin",
    forceRebuild: args.forceRebuild ?? true,
    // Spec #2/#10: pass router signals so admin replay still respects
    // hard-negative URL rejects. Force-rebuild bypasses the
    // "previous failure" skip but it does NOT bypass router signals.
    routerSignals: {
      title: doc.sourceTitle ?? null,
      headings: (doc.headingsJson ?? null) as ReadonlyArray<{
        level: number;
        text: string;
      }> | null,
      metadata: (doc.metadataJson ?? null) as Record<string, string | undefined> | null,
    },
  });
  return { enqueued: result.enqueuedCount, skippedReasons: result.skippedReasons };
}
