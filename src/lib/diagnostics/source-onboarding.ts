/**
 * Source onboarding diagnostics.
 *
 * For every configured ingestion source, reports the spec-listed
 * onboarding facets so an admin can see — at a glance — whether a
 * source is wired correctly enough to contribute to the factory:
 *
 *   discovery method, source role, source tier, supported content
 *   types, allowed fields, license status, fetch cap, build cap,
 *   daily cap, validation role, enrichment role, source health.
 *
 * It also rolls the sources up per content type and raises the four
 * spec-listed source-coverage warnings:
 *
 *   - fewer than the configured minimum factory-ready sources
 *   - validation sources but no primary content source
 *   - primary content sources but no validation source
 *   - sources configured but no successful package builds
 *
 * Read-side only.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import {
  SOURCE_PLAN_MINIMUMS,
  SOURCE_PLAN_CONTENT_TYPES,
  PURPOSE_FLAG_BY_CONTENT_TYPE,
  type SourcePlanContentType,
} from "../ingestion/sources/source-plan";

const FACTORY_READY_DISCOVERY = [
  "sitemap",
  "rss",
  "fixed_url_list",
  "official_api",
  "factory_handler",
];

/** Field policy each source role is allowed to contribute. */
const ROLE_FIELD_POLICY: Record<string, string> = {
  primary_content_source: "May originate required body fields",
  validation_source: "May only confirm fields sourced elsewhere",
  enrichment_source: "May fill approved enrichment fields with provenance",
  discovery_only_source: "May suggest candidates only — cannot publish content",
  rejected_source: "Blocked — contributes nothing to the factory",
};

export type SourceOnboardingVerdict = "ready" | "incomplete" | "blocked";

export type SourceOnboardingRow = {
  sourceId: string;
  name: string;
  host: string;
  discoveryMethod: string;
  role: string;
  tier: number;
  supportedContentTypes: string[];
  allowedFields: string;
  licenseStatus: string;
  fetchCap: number | null;
  buildCap: number | null;
  dailyCap: number | null;
  isValidationSource: boolean;
  isEnrichmentSource: boolean;
  sourceHealth: string;
  /** ready = wired + can publish; incomplete = needs config; blocked = rejected/inactive. */
  verdict: SourceOnboardingVerdict;
  /** Human-readable onboarding issues. */
  issues: string[];
};

export type SourceCoverageWarning = {
  contentType: string;
  kind:
    | "below_minimum"
    | "validation_without_primary"
    | "primary_without_validation"
    | "sources_without_builds";
  message: string;
};

export type SourceOnboardingReport = {
  generatedAt: Date;
  sources: SourceOnboardingRow[];
  warnings: SourceCoverageWarning[];
  /** Counts for the dashboard header. */
  ready: number;
  incomplete: number;
  blocked: number;
};

type RawSource = {
  id: string;
  name: string;
  host: string;
  isActive: boolean;
  isOfficial: boolean;
  trustLabel: string | null;
  tier: number;
  role: string;
  healthState: string;
  autoPaused: boolean;
  pausedAt: Date | null;
  discoveryMethod: string | null;
  fetchLimitPerRun: number | null;
  buildLimitPerRun: number | null;
  dailyCap: number | null;
} & Record<string, unknown>;

function isFactoryReady(s: RawSource): boolean {
  return (
    s.isActive &&
    !s.pausedAt &&
    s.role !== "rejected_source" &&
    s.discoveryMethod != null &&
    FACTORY_READY_DISCOVERY.includes(s.discoveryMethod)
  );
}

function supportedContentTypesOf(s: RawSource): string[] {
  const out: string[] = [];
  for (const contentType of SOURCE_PLAN_CONTENT_TYPES) {
    if (s[PURPOSE_FLAG_BY_CONTENT_TYPE[contentType]] === true) out.push(contentType);
  }
  return out;
}

function onboardingRow(s: RawSource): SourceOnboardingRow {
  const supported = supportedContentTypesOf(s);
  const discoveryMethod = s.discoveryMethod ?? "not_configured";
  const issues: string[] = [];
  let verdict: SourceOnboardingVerdict = "ready";

  if (!s.isActive) {
    verdict = "blocked";
    issues.push("Source is inactive.");
  } else if (s.role === "rejected_source") {
    verdict = "blocked";
    issues.push("Source role is rejected_source — blocked from the factory.");
  } else {
    if (!s.discoveryMethod || !FACTORY_READY_DISCOVERY.includes(s.discoveryMethod)) {
      verdict = "incomplete";
      issues.push("No factory-ready discovery method is configured.");
    }
    if (supported.length === 0) {
      verdict = "incomplete";
      issues.push("Source has no canIngest* content-type flag set.");
    }
    if (s.role === "discovery_only_source") {
      if (verdict === "ready") verdict = "incomplete";
      issues.push("Role is discovery_only_source — promote it before it can publish content.");
    }
  }

  return {
    sourceId: s.id,
    name: s.name,
    host: s.host,
    discoveryMethod,
    role: s.role,
    tier: s.tier,
    supportedContentTypes: supported,
    allowedFields: ROLE_FIELD_POLICY[s.role] ?? "Unknown role",
    licenseStatus: s.isOfficial
      ? "official (permitted)"
      : (s.trustLabel ?? "unverified — review licensing"),
    fetchCap: s.fetchLimitPerRun,
    buildCap: s.buildLimitPerRun,
    dailyCap: s.dailyCap,
    isValidationSource: s.role === "validation_source",
    isEnrichmentSource: s.role === "enrichment_source",
    sourceHealth: s.autoPaused ? "auto-paused" : s.healthState,
    verdict,
    issues,
  };
}

/**
 * Build the source onboarding diagnostics report.
 */
export async function getSourceOnboardingReport(): Promise<SourceOnboardingReport> {
  const generatedAt = new Date();
  let raw: RawSource[] = [];
  try {
    raw = (await prisma.ingestionSource.findMany({
      orderBy: { name: "asc" },
    })) as unknown as RawSource[];
  } catch (e) {
    logger.warn("source-onboarding.query_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { generatedAt, sources: [], warnings: [], ready: 0, incomplete: 0, blocked: 0 };
  }

  const sources = raw.map(onboardingRow);

  // Per-content-type successful build counts.
  const buildsByType = new Map<string, number>();
  try {
    const grouped = await prisma.contentPackageBuildLog.groupBy({
      by: ["contentType"],
      _count: { _all: true },
      where: { buildStatus: "built_complete_package" },
    });
    for (const g of grouped) buildsByType.set(g.contentType, g._count?._all ?? 0);
  } catch (e) {
    logger.warn("source-onboarding.builds_query_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const warnings: SourceCoverageWarning[] = [];
  for (const contentType of SOURCE_PLAN_CONTENT_TYPES) {
    const flag = PURPOSE_FLAG_BY_CONTENT_TYPE[contentType];
    const forType = raw.filter((s) => s[flag] === true);
    const factoryReady = forType.filter(isFactoryReady);
    const primary = factoryReady.filter((s) => s.role === "primary_content_source").length;
    const validation = factoryReady.filter((s) => s.role === "validation_source").length;
    const minimum = SOURCE_PLAN_MINIMUMS[contentType as SourcePlanContentType];

    if (factoryReady.length < minimum) {
      warnings.push({
        contentType,
        kind: "below_minimum",
        message: `${contentType} has ${factoryReady.length} factory-ready source(s) — below the configured minimum of ${minimum}.`,
      });
    }
    if (validation > 0 && primary === 0) {
      warnings.push({
        contentType,
        kind: "validation_without_primary",
        message: `${contentType} has ${validation} validation source(s) but no primary content source — nothing can originate content.`,
      });
    }
    if (primary > 0 && validation === 0) {
      warnings.push({
        contentType,
        kind: "primary_without_validation",
        message: `${contentType} has ${primary} primary content source(s) but no validation source — cross-source validation cannot run.`,
      });
    }
    if (factoryReady.length > 0 && (buildsByType.get(contentType) ?? 0) === 0) {
      warnings.push({
        contentType,
        kind: "sources_without_builds",
        message: `${contentType} has ${factoryReady.length} factory-ready source(s) but no successful package build yet.`,
      });
    }
  }

  return {
    generatedAt,
    sources,
    warnings,
    ready: sources.filter((s) => s.verdict === "ready").length,
    incomplete: sources.filter((s) => s.verdict === "incomplete").length,
    blocked: sources.filter((s) => s.verdict === "blocked").length,
  };
}
