/**
 * Production growth runbook.
 *
 * One operator-facing page that answers "what is wrong with content
 * growth right now, and what is the system doing about it?" by
 * aggregating signals that already exist across the factory:
 *
 *   - which content types are stalled, why, and the automatic next action
 *   - which sources are paused
 *   - which sources were promoted (role changed)
 *   - which builders are weak
 *   - where cross-source validation evidence is missing
 *   - which content types have failing public display checks
 *
 * Read-side only — every aggregation is wrapped so one failure
 * degrades to an error entry rather than blanking the page.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import {
  getContentGrowthDashboard,
  automaticNextActionForReason,
} from "../data/content-growth-dashboard";
import { getValidationEvidenceSummary } from "../data/validation-evidence";
import { getBuilderWeaknessReport } from "./builder-weakness";

export type RunbookStalledType = {
  contentType: string;
  stallReason: string;
  nextAction: string;
};

export type RunbookSource = {
  host: string;
  role: string;
  reason: string;
  at: Date | null;
};

export type RunbookWeakBuilder = {
  builderName: string;
  contentType: string;
  missingField: string;
  failureCount: number;
  message: string;
};

export type RunbookEvidenceGap = { contentType: string; insufficient: number };

export type RunbookDisplayFailure = {
  contentType: string;
  persisted: number;
  public: number;
};

export type ProductionRunbook = {
  generatedAt: Date;
  stalledContentTypes: RunbookStalledType[];
  pausedSources: RunbookSource[];
  promotedSources: RunbookSource[];
  weakBuilders: RunbookWeakBuilder[];
  missingValidationEvidence: RunbookEvidenceGap[];
  failingPublicDisplay: RunbookDisplayFailure[];
  errors: Record<string, string>;
};

async function safe<T>(
  fn: () => Promise<T>,
  fallback: T,
  label: string,
  errors: Record<string, string>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors[label] = msg;
    logger.warn("production-runbook.section_failed", { label, error: msg });
    return fallback;
  }
}

const CONTENT_ROLES = ["primary_content_source", "validation_source", "enrichment_source"];

/**
 * Build the production growth runbook.
 */
export async function getProductionRunbook(): Promise<ProductionRunbook> {
  const errors: Record<string, string> = {};

  const growth = await safe(() => getContentGrowthDashboard(), [], "contentGrowth", errors);
  const stalledContentTypes: RunbookStalledType[] = growth
    .filter((r) => r.currentStallReason)
    .map((r) => ({
      contentType: r.contentType,
      stallReason: r.currentStallReason,
      nextAction: automaticNextActionForReason(r.currentStallReason) || "monitor",
    }));
  const failingPublicDisplay: RunbookDisplayFailure[] = growth
    .filter(
      (r) =>
        r.persistedPackageCount != null &&
        r.publicPackageCount != null &&
        r.persistedPackageCount > r.publicPackageCount,
    )
    .map((r) => ({
      contentType: r.contentType,
      persisted: r.persistedPackageCount ?? 0,
      public: r.publicPackageCount ?? 0,
    }));

  const evidence = await safe(
    () => getValidationEvidenceSummary({}),
    null,
    "validationEvidence",
    errors,
  );
  const missingValidationEvidence: RunbookEvidenceGap[] = (evidence?.byContentType ?? [])
    .filter((c) => c.insufficient > 0)
    .map((c) => ({ contentType: c.contentType, insufficient: c.insufficient }));

  const weakness = await safe(() => getBuilderWeaknessReport(), [], "builderWeakness", errors);
  const weakBuilders: RunbookWeakBuilder[] = weakness.slice(0, 20).map((w) => ({
    builderName: w.builderName,
    contentType: w.contentType,
    missingField: w.missingField,
    failureCount: w.failureCount,
    message: w.message,
  }));

  const sources = await safe(
    () =>
      prisma.ingestionSource.findMany({
        select: {
          host: true,
          role: true,
          pausedAt: true,
          pausedReason: true,
          autoPaused: true,
          autoPausedAt: true,
          roleLastReason: true,
          roleLastChangedAt: true,
        },
      }),
    [] as Array<{
      host: string;
      role: string;
      pausedAt: Date | null;
      pausedReason: string | null;
      autoPaused: boolean;
      autoPausedAt: Date | null;
      roleLastReason: string | null;
      roleLastChangedAt: Date | null;
    }>,
    "sources",
    errors,
  );
  const pausedSources: RunbookSource[] = sources
    .filter((s) => s.pausedAt != null || s.autoPaused)
    .map((s) => ({
      host: s.host,
      role: s.role,
      reason: s.pausedReason ?? (s.autoPaused ? "auto-paused" : "paused"),
      at: s.pausedAt ?? s.autoPausedAt,
    }));
  const promotedSources: RunbookSource[] = sources
    .filter((s) => s.roleLastChangedAt != null && CONTENT_ROLES.includes(s.role))
    .map((s) => ({
      host: s.host,
      role: s.role,
      reason: s.roleLastReason ?? "role changed",
      at: s.roleLastChangedAt,
    }));

  return {
    generatedAt: new Date(),
    stalledContentTypes,
    pausedSources,
    promotedSources,
    weakBuilders,
    missingValidationEvidence,
    failingPublicDisplay,
    errors,
  };
}
