/**
 * Source configuration card data.
 *
 * Returns one row per active ingestion source with every field the
 * admin "source configuration card" displays:
 *
 *   - Source name
 *   - Source host
 *   - Source tier
 *   - Source purpose flags
 *   - Discovery method
 *   - Supported content types
 *   - Last discovery
 *   - Last fetch
 *   - Last build
 *   - Last valid package
 *   - Configuration status
 *   - Reason if not configured
 *
 * The helper composes data from IngestionSource +
 * IngestionJobQueue + SourceDocument + ContentPackageBuildLog + the
 * public content tables. Errors are captured per-source in the
 * `errors` array; the card still renders with whatever DID load.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "../content-qa/thresholds";

export type SourcePurposeFlags = {
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
};

export type SourceConfigurationCard = {
  sourceId: string;
  name: string;
  host: string;
  tier: number;
  purposeFlags: SourcePurposeFlags;
  discoveryMethod: string | null;
  configurationStatus: string | null;
  configurationStatusReason: string | null;
  supportedContentTypes: string[];
  lastDiscoveryAt: Date | null;
  lastFetchAt: Date | null;
  lastBuildAt: Date | null;
  lastValidPackageAt: Date | null;
  errors: string[];
};

const PURPOSE_TO_CONTENT_TYPE: Array<{ flag: keyof SourcePurposeFlags; type: string }> = [
  { flag: "canIngestPrayers", type: "Prayer" },
  { flag: "canIngestSaints", type: "Saint" },
  { flag: "canIngestApparitions", type: "MarianApparition" },
  { flag: "canIngestParishes", type: "Parish" },
  { flag: "canIngestDevotions", type: "Devotion" },
  { flag: "canIngestNovenas", type: "Novena" },
  { flag: "canIngestSacraments", type: "Sacrament" },
  { flag: "canIngestRosaryGuides", type: "Rosary" },
  { flag: "canIngestConsecrations", type: "Consecration" },
  { flag: "canIngestSpiritualGuides", type: "SpiritualGuidance" },
  { flag: "canIngestLiturgy", type: "Liturgy" },
  { flag: "canIngestHistory", type: "History" },
];

function supportedContentTypesFor(flags: SourcePurposeFlags): string[] {
  return PURPOSE_TO_CONTENT_TYPE.filter((p) => flags[p.flag]).map((p) => p.type);
}

async function safe<T>(fn: () => Promise<T>, label: string, errors: string[]): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function listSourceConfigurationCards(): Promise<SourceConfigurationCard[]> {
  const sources = await prisma.ingestionSource
    .findMany({
      where: { isActive: true },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    })
    .catch((e) => {
      logger.warn("source-config-card.list_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    });
  const cards = await Promise.all(sources.map((s) => buildCardForSource(s)));
  return cards;
}

async function buildCardForSource(source: {
  id: string;
  name: string;
  host: string;
  tier: number;
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
  discoveryMethod: string | null;
  configurationStatus: string | null;
  configurationStatusReason: string | null;
}): Promise<SourceConfigurationCard> {
  const errors: string[] = [];
  const flags: SourcePurposeFlags = {
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
  const supportedContentTypes = supportedContentTypesFor(flags);

  const lastDiscovery = await safe(
    () =>
      prisma.ingestionJobQueue.findFirst({
        where: {
          sourceId: source.id,
          jobKind: "source_discovery",
          status: "completed",
        },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
    "lastDiscovery",
    errors,
  );
  const lastFetch = await safe(
    () =>
      prisma.sourceDocument.findFirst({
        where: { sourceId: source.id },
        orderBy: { fetchedAt: "desc" },
        select: { fetchedAt: true },
      }),
    "lastFetch",
    errors,
  );
  const lastBuild = await safe(
    () =>
      prisma.contentPackageBuildLog.findFirst({
        where: { sourceHost: source.host },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    "lastBuild",
    errors,
  );
  // Last valid package — most recent ContentPackageBuildLog success.
  const lastValidPackage = await safe(
    () =>
      prisma.contentPackageBuildLog.findFirst({
        where: { sourceHost: source.host, buildStatus: "built_complete_package" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    "lastValidPackage",
    errors,
  );
  void STRICT_PUBLIC_WHERE_CLAUSE; // reserved for future filtered counts
  return {
    sourceId: source.id,
    name: source.name,
    host: source.host,
    tier: source.tier,
    purposeFlags: flags,
    discoveryMethod: source.discoveryMethod,
    configurationStatus: source.configurationStatus,
    configurationStatusReason: source.configurationStatusReason,
    supportedContentTypes,
    lastDiscoveryAt: lastDiscovery?.finishedAt ?? null,
    lastFetchAt: lastFetch?.fetchedAt ?? null,
    lastBuildAt: lastBuild?.createdAt ?? null,
    lastValidPackageAt: lastValidPackage?.createdAt ?? null,
    errors,
  };
}

/**
 * Returns the subset of active sources that cannot enter the factory
 * native pipeline (no discoveryMethod set or method = not_configured).
 * Used by the admin diagnostic warning.
 */
export async function listSourcesNotFactoryNative(): Promise<
  Array<{ sourceId: string; name: string; host: string; reason: string | null }>
> {
  const rows = await prisma.ingestionSource
    .findMany({
      where: {
        isActive: true,
        OR: [{ discoveryMethod: null }, { discoveryMethod: "not_configured" }],
      },
      select: {
        id: true,
        name: true,
        host: true,
        configurationStatusReason: true,
      },
    })
    .catch((e) => {
      logger.warn("source-config-card.not_factory_native_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    });
  return rows.map((r) => ({
    sourceId: r.id,
    name: r.name,
    host: r.host,
    reason: r.configurationStatusReason,
  }));
}
