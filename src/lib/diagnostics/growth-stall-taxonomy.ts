/**
 * Growth stall taxonomy (spec §16).
 *
 * One row per spec-listed stall reason. Each row carries:
 *   - a stable id (also used as a SecurityEvent type, RejectedContentLog
 *     failureCategory, or queue audit reason where applicable)
 *   - a human-readable label
 *   - a detector function (boolean predicate) and a next-action
 *     description so the admin "why not public" page can render the
 *     automatic next action for the stall.
 *
 * The taxonomy is the single source of truth for stall reasons.
 * detectStalls() walks every entry and returns the matched rows.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type StallReasonId =
  | "no_configured_sources"
  | "no_discovery"
  | "no_fetch"
  | "fetch_without_build"
  | "build_without_qa_pass"
  | "qa_pass_without_persistence"
  | "persistence_without_public_display"
  | "public_display_without_search"
  | "public_display_without_sitemap"
  | "public_content_without_threshold_movement"
  | "high_duplicate_saturation"
  | "high_wrong_content_rate"
  | "validation_evidence_missing";

export type StallEntry = {
  id: StallReasonId;
  label: string;
  /** Automatic remediation action the cron will take. */
  automaticNextAction: string;
};

export const STALL_TAXONOMY: ReadonlyArray<StallEntry> = [
  {
    id: "no_configured_sources",
    label: "No configured sources",
    automaticNextAction: "Mark source configuration as failed and surface in admin warnings",
  },
  {
    id: "no_discovery",
    label: "No discovery is happening",
    automaticNextAction: "Enqueue source_discovery jobs for factory-ready sources",
  },
  {
    id: "no_fetch",
    label: "No fetch is happening",
    automaticNextAction: "Enqueue source_fetch jobs for discovered items",
  },
  {
    id: "fetch_without_build",
    label: "Fetch happened but build did not",
    automaticNextAction: "Enqueue content_build for unbuilt SourceDocuments",
  },
  {
    id: "build_without_qa_pass",
    label: "Build succeeded but QA failed",
    automaticNextAction: "Group failures by contract + field; surface in builder-weakness panel",
  },
  {
    id: "qa_pass_without_persistence",
    label: "QA passed but persistence failed",
    automaticNextAction: "Surface the database / package error in admin",
  },
  {
    id: "persistence_without_public_display",
    label: "Persistence succeeded but the row is not public-visible",
    automaticNextAction: "Run strict revalidation + render-gate cleanup",
  },
  {
    id: "public_display_without_search",
    label: "Row is public but not in search",
    automaticNextAction: "Run indexing repair",
  },
  {
    id: "public_display_without_sitemap",
    label: "Row is public but not in sitemap",
    automaticNextAction: "Run sitemap refresh",
  },
  {
    id: "public_content_without_threshold_movement",
    label: "Public content grew but threshold counters did not",
    automaticNextAction: "Refresh threshold counters",
  },
  {
    id: "high_duplicate_saturation",
    label: "Source duplicates dominate the build pipeline",
    automaticNextAction: "Demote source tier; pause source if rate remains high",
  },
  {
    id: "high_wrong_content_rate",
    label: "Source produces too much wrong content",
    automaticNextAction: "Demote source role; reject_source if rate ≥ 50%",
  },
  {
    id: "validation_evidence_missing",
    label: "Cross-source validation evidence is missing",
    automaticNextAction: "Enqueue validation source checks; promote more validators",
  },
];

export type StallDetectionResult = {
  generatedAt: Date;
  detected: ReadonlyArray<StallEntry>;
};

const LOOK_BACK_HOURS = 24;

/**
 * Walk the stall taxonomy and return every entry that currently
 * applies. Each detector is best-effort; an exception inside one
 * detector does not prevent the rest from running.
 */
export async function detectStalls(): Promise<StallDetectionResult> {
  const since = new Date(Date.now() - LOOK_BACK_HOURS * 60 * 60 * 1000);
  const detected: StallEntry[] = [];

  const detectors: Array<{ id: StallReasonId; run: () => Promise<boolean> }> = [
    {
      id: "no_configured_sources",
      run: async () =>
        (await safeCount(() =>
          prisma.ingestionSource.count({
            where: { isActive: true, configurationStatus: "factory_native" },
          }),
        )) === 0,
    },
    {
      id: "no_discovery",
      run: async () =>
        (await safeCount(() =>
          prisma.ingestionJobQueue.count({
            where: { jobKind: "source_discovery", finishedAt: { gte: since } },
          }),
        )) === 0,
    },
    {
      id: "no_fetch",
      run: async () =>
        (await safeCount(() =>
          prisma.sourceDocument.count({ where: { fetchedAt: { gte: since } } }),
        )) === 0,
    },
    {
      id: "fetch_without_build",
      run: async () => {
        const fetched = await safeCount(() =>
          prisma.sourceDocument.count({ where: { fetchedAt: { gte: since } } }),
        );
        const builds = await safeCount(() =>
          prisma.contentPackageBuildLog.count({ where: { createdAt: { gte: since } } }),
        );
        return fetched > 0 && builds === 0;
      },
    },
    {
      id: "build_without_qa_pass",
      run: async () => {
        const builds = await safeCount(() =>
          prisma.contentPackageBuildLog.count({
            where: {
              buildStatus: "built_complete_package",
              createdAt: { gte: since },
            },
          }),
        );
        const rejections = await safeCount(() =>
          prisma.rejectedContentLog.count({ where: { deletedAt: { gte: since } } }),
        );
        return builds > 0 && rejections >= builds;
      },
    },
    {
      id: "qa_pass_without_persistence",
      run: async () => {
        // Approximation: lots of qaPass counters but no public-row growth.
        const agg = await safeNumber(async () => {
          const a = await prisma.sourceQualityScore.aggregate({
            _sum: { qaPassCount: true },
          });
          return a._sum.qaPassCount ?? 0;
        });
        const publicRows = await safeCount(() =>
          prisma.prayer.count({
            where: { status: "PUBLISHED", publicRenderReady: true },
          }),
        );
        return agg > 50 && publicRows === 0;
      },
    },
    {
      id: "persistence_without_public_display",
      run: async () => {
        const persisted = await safeCount(() =>
          prisma.prayer.count({ where: { status: "PUBLISHED" } }),
        );
        const visible = await safeCount(() =>
          prisma.prayer.count({
            where: { status: "PUBLISHED", publicRenderReady: true, isThresholdEligible: true },
          }),
        );
        return persisted > 0 && visible < persisted;
      },
    },
    {
      id: "high_wrong_content_rate",
      run: async () => {
        const wrong = await safeCount(() =>
          prisma.rejectedContentLog.count({
            where: { failureCategory: "wrong_content", deletedAt: { gte: since } },
          }),
        );
        return wrong > 10;
      },
    },
    {
      id: "validation_evidence_missing",
      run: async () => {
        const missing = await safeCount(() =>
          prisma.rejectedContentLog.count({
            where: {
              failureCategory: "validation_evidence_missing",
              deletedAt: { gte: since },
            },
          }),
        );
        return missing > 5;
      },
    },
  ];

  for (const d of detectors) {
    try {
      const tripped = await d.run();
      if (tripped) {
        const entry = STALL_TAXONOMY.find((e) => e.id === d.id);
        if (entry) detected.push(entry);
      }
    } catch (e) {
      logger.warn("growth-stall.detector_failed", {
        id: d.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { generatedAt: new Date(), detected };
}

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

async function safeNumber(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}
