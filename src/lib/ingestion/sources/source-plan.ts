/**
 * Production source plan.
 *
 * Guarantees each major content type has enough configured sources
 * to grow consistently. The plan exposes:
 *
 *   - the minimum number of factory-ready sources we want per type,
 *   - which "tab" (content type) is currently below its minimum,
 *   - whether the system is in a production-ready source state.
 *
 * "Factory ready" means: the source is active, not paused, not
 * marked `rejected_source`, has a non-null discoveryMethod that is
 * not `not_configured`, and carries at least one canIngest* purpose
 * flag for that content type.
 *
 * The admin source-configuration dashboard shows these numbers and
 * triggers automatic discovery expansion when a content type falls
 * below its minimum.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";

/**
 * Spec-listed recommended minimums per content type. Going below
 * these surfaces a warning on the production-readiness page;
 * going to zero fails production readiness for the affected type.
 */
export const SOURCE_PLAN_MINIMUMS = {
  Prayer: 5,
  Saint: 5,
  Devotion: 4,
  Novena: 4,
  Sacrament: 3,
  Rosary: 3,
  Consecration: 3,
  Liturgy: 3,
  History: 5,
  Parish: 3,
  MarianApparition: 3,
  SpiritualGuidance: 3,
} as const;

export type SourcePlanContentType = keyof typeof SOURCE_PLAN_MINIMUMS;

export const SOURCE_PLAN_CONTENT_TYPES = Object.keys(
  SOURCE_PLAN_MINIMUMS,
) as ReadonlyArray<SourcePlanContentType>;

/**
 * Maps a content type to the `canIngest*` boolean column the
 * planner queries for. Keeping this map explicit lets the admin
 * page label rows precisely.
 */
export const PURPOSE_FLAG_BY_CONTENT_TYPE: Record<SourcePlanContentType, string> = {
  Prayer: "canIngestPrayers",
  Saint: "canIngestSaints",
  Devotion: "canIngestDevotions",
  Novena: "canIngestNovenas",
  Sacrament: "canIngestSacraments",
  Rosary: "canIngestRosaryGuides",
  Consecration: "canIngestConsecrations",
  Liturgy: "canIngestLiturgy",
  History: "canIngestHistory",
  Parish: "canIngestParishes",
  MarianApparition: "canIngestApparitions",
  SpiritualGuidance: "canIngestSpiritualGuides",
};

export type SourcePlanRow = {
  contentType: SourcePlanContentType;
  required: number;
  configured: number;
  factoryReady: number;
  validationSources: number;
  enrichmentSources: number;
  status: "ok" | "warn" | "fail";
  shortfall: number;
  /** Aggregated source health for this content type. */
  sourceHealth: "healthy" | "degraded" | "failed";
  /** Stable string the admin source-plan page surfaces. */
  nextAutomaticRepairAction: string;
};

export type SourcePlanReport = {
  rows: ReadonlyArray<SourcePlanRow>;
  /** Worst per-row status. */
  worst: "ok" | "warn" | "fail";
  /** Total number of content types below their minimum. */
  underMinimum: number;
  /** Total number of content types with zero factory-ready sources. */
  zeroFactoryReady: number;
  generatedAt: Date;
};

const FACTORY_READY_DISCOVERY_METHODS = [
  "sitemap",
  "rss",
  "fixed_url_list",
  "official_api",
  "factory_handler",
];

type SourceRow = {
  isActive: boolean;
  pausedAt: Date | null;
  role: string;
  discoveryMethod: string | null;
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
};

function isFactoryReady(row: SourceRow): boolean {
  if (!row.isActive) return false;
  if (row.pausedAt) return false;
  if (row.role === "rejected_source") return false;
  if (!row.discoveryMethod) return false;
  if (!FACTORY_READY_DISCOVERY_METHODS.includes(row.discoveryMethod)) return false;
  return true;
}

function purposeFor(row: SourceRow, key: string): boolean {
  switch (key) {
    case "canIngestPrayers":
      return row.canIngestPrayers;
    case "canIngestSaints":
      return row.canIngestSaints;
    case "canIngestApparitions":
      return row.canIngestApparitions;
    case "canIngestParishes":
      return row.canIngestParishes;
    case "canIngestDevotions":
      return row.canIngestDevotions;
    case "canIngestNovenas":
      return row.canIngestNovenas;
    case "canIngestSacraments":
      return row.canIngestSacraments;
    case "canIngestRosaryGuides":
      return row.canIngestRosaryGuides;
    case "canIngestConsecrations":
      return row.canIngestConsecrations;
    case "canIngestSpiritualGuides":
      return row.canIngestSpiritualGuides;
    case "canIngestLiturgy":
      return row.canIngestLiturgy;
    case "canIngestHistory":
      return row.canIngestHistory;
    default:
      return false;
  }
}

/**
 * Build the production source plan report by aggregating
 * IngestionSource rows. Used by the admin dashboard and the
 * production-readiness card.
 */
export async function buildSourcePlanReport(): Promise<SourcePlanReport> {
  const generatedAt = new Date();
  let sources: SourceRow[] = [];
  try {
    sources = (await prisma.ingestionSource.findMany({
      select: {
        isActive: true,
        pausedAt: true,
        role: true,
        discoveryMethod: true,
        canIngestPrayers: true,
        canIngestSaints: true,
        canIngestApparitions: true,
        canIngestParishes: true,
        canIngestDevotions: true,
        canIngestNovenas: true,
        canIngestSacraments: true,
        canIngestRosaryGuides: true,
        canIngestConsecrations: true,
        canIngestSpiritualGuides: true,
        canIngestLiturgy: true,
        canIngestHistory: true,
      },
    })) as unknown as SourceRow[];
  } catch (e) {
    logger.warn("source-plan.query_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { rows: [], worst: "fail", underMinimum: 0, zeroFactoryReady: 0, generatedAt };
  }

  const rows: SourcePlanRow[] = [];
  let underMinimum = 0;
  let zeroFactoryReady = 0;

  for (const contentType of SOURCE_PLAN_CONTENT_TYPES) {
    const required = SOURCE_PLAN_MINIMUMS[contentType];
    const purposeKey = PURPOSE_FLAG_BY_CONTENT_TYPE[contentType];
    const configured = sources.filter((s) => purposeFor(s, purposeKey)).length;
    const factoryReady = sources.filter(
      (s) => purposeFor(s, purposeKey) && isFactoryReady(s),
    ).length;
    const validationSources = sources.filter(
      (s) => purposeFor(s, purposeKey) && s.role === "validation_source" && isFactoryReady(s),
    ).length;
    const enrichmentSources = sources.filter(
      (s) => purposeFor(s, purposeKey) && s.role === "enrichment_source" && isFactoryReady(s),
    ).length;

    const shortfall = Math.max(0, required - factoryReady);
    let status: "ok" | "warn" | "fail" = "ok";
    if (factoryReady === 0) {
      status = "fail";
      zeroFactoryReady += 1;
      underMinimum += 1;
    } else if (factoryReady < required) {
      status = "warn";
      underMinimum += 1;
    }

    const sourceHealth: SourcePlanRow["sourceHealth"] =
      status === "fail" ? "failed" : status === "warn" ? "degraded" : "healthy";
    const nextAutomaticRepairAction =
      status === "fail"
        ? `Enqueue source_discovery for ${contentType} candidates; mark source configuration as failed`
        : status === "warn"
          ? `Run planDiscoveryExpansion() for ${contentType} (${shortfall} source(s) short of minimum)`
          : "No action required";

    rows.push({
      contentType,
      required,
      configured,
      factoryReady,
      validationSources,
      enrichmentSources,
      status,
      sourceHealth,
      nextAutomaticRepairAction,
      shortfall,
    });
  }

  let worst: "ok" | "warn" | "fail" = "ok";
  for (const r of rows) {
    if (r.status === "fail") {
      worst = "fail";
      break;
    }
    if (r.status === "warn") worst = "warn";
  }

  return { rows, worst, underMinimum, zeroFactoryReady, generatedAt };
}
