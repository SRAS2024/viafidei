/**
 * Factory-source setup task.
 *
 * Runs once at startup to convert every existing IngestionSource into
 * a factory-native source. For each active source:
 *
 *   - If `discoveryFeedUrl` is set → discoveryMethod = "sitemap"
 *     and configurationStatus = "factory_native".
 *   - If `discoveryFeedUrl` is null AND the source has at least one
 *     `canIngest*` purpose flag set → mark not_configured with a
 *     reason that points the admin to add a sitemap/RSS URL.
 *   - If the source has no purposes → not_configured with a
 *     different reason.
 *
 * The task is idempotent: only rows whose `discoveryMethod` is NULL
 * get updated. Subsequent boots are no-ops.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type FactorySourceSetupReport = {
  inspected: number;
  marked_factory_native: number;
  marked_not_configured: number;
  skipped: number;
};

export const FACTORY_DISCOVERY_METHODS = [
  "sitemap",
  "rss",
  "fixed_url_list",
  "official_api",
  "factory_handler",
  "not_configured",
] as const;

export type FactoryDiscoveryMethod = (typeof FACTORY_DISCOVERY_METHODS)[number];

export function isFactoryDiscoveryMethod(value: string): value is FactoryDiscoveryMethod {
  return (FACTORY_DISCOVERY_METHODS as readonly string[]).includes(value);
}

function hasAnyPurpose(source: {
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
}): boolean {
  return (
    source.canIngestPrayers ||
    source.canIngestSaints ||
    source.canIngestApparitions ||
    source.canIngestParishes ||
    source.canIngestDevotions ||
    source.canIngestNovenas ||
    source.canIngestSacraments ||
    source.canIngestRosaryGuides ||
    source.canIngestConsecrations ||
    source.canIngestSpiritualGuides ||
    source.canIngestLiturgy ||
    source.canIngestHistory
  );
}

/**
 * Idempotent backfill. Returns a structured report so the admin
 * diagnostic page can show what the setup did.
 */
export async function runFactorySourceSetup(): Promise<FactorySourceSetupReport> {
  const report: FactorySourceSetupReport = {
    inspected: 0,
    marked_factory_native: 0,
    marked_not_configured: 0,
    skipped: 0,
  };

  const sources = await prisma.ingestionSource
    .findMany({
      where: { discoveryMethod: null },
      take: 1000,
    })
    .catch((e) => {
      logger.warn("factory-source-setup.read_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    });

  for (const source of sources) {
    report.inspected += 1;
    let method: FactoryDiscoveryMethod;
    let status: string;
    let reason: string | null = null;
    if (source.discoveryFeedUrl) {
      method = "sitemap";
      status = "factory_native";
      report.marked_factory_native += 1;
    } else if (!hasAnyPurpose(source)) {
      method = "not_configured";
      status = "not_configured";
      reason = "Source has no canIngest* purpose flags set.";
      report.marked_not_configured += 1;
    } else {
      method = "not_configured";
      status = "not_configured";
      reason =
        "Source has no discoveryFeedUrl — set a sitemap.xml or RSS feed URL to enable factory-native discovery.";
      report.marked_not_configured += 1;
    }
    try {
      await prisma.ingestionSource.update({
        where: { id: source.id },
        data: {
          discoveryMethod: method,
          configurationStatus: status,
          configurationStatusReason: reason,
        },
      });
    } catch (e) {
      report.skipped += 1;
      logger.warn("factory-source-setup.update_failed", {
        sourceId: source.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  logger.info("factory-source-setup.completed", report as unknown as Record<string, unknown>);
  return report;
}
