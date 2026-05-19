/**
 * Periodic source-configuration repair job. The startup task in
 * `factory-source-setup.ts` only inspects sources whose
 * `discoveryMethod` is still NULL. After admins add or change
 * sources at runtime, the same shape of repair has to run on a
 * cadence. This job:
 *
 *   - Marks sources without a valid discovery method as
 *     `not_configured`.
 *   - Marks sources with a usable `discoveryFeedUrl` as
 *     `factory_native` (and sets `discoveryMethod = "sitemap"` /
 *     "rss" based on the feed URL when missing).
 *   - Reports active sources with no purpose flags.
 *   - Reports active sources with no supported content types.
 *
 * The job is idempotent; running it twice in a row produces no
 * additional writes. The result is returned so the queue dispatcher
 * can attach it to the queue chain audit.
 */

import { prisma } from "../../db/client";
import { logger } from "../../observability/logger";

export type SourceConfigRepairReport = {
  inspected: number;
  markedNotConfigured: number;
  markedFactoryNative: number;
  missingPurposeFlags: ReadonlyArray<{ id: string; host: string }>;
  missingContentTypes: ReadonlyArray<{ id: string; host: string }>;
  errors: number;
};

type SourceRow = {
  id: string;
  host: string;
  discoveryFeedUrl: string | null;
  discoveryMethod: string | null;
  configurationStatus: string | null;
  isActive: boolean;
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

function hasAnyPurpose(s: SourceRow): boolean {
  return (
    s.canIngestPrayers ||
    s.canIngestSaints ||
    s.canIngestApparitions ||
    s.canIngestParishes ||
    s.canIngestDevotions ||
    s.canIngestNovenas ||
    s.canIngestSacraments ||
    s.canIngestRosaryGuides ||
    s.canIngestConsecrations ||
    s.canIngestSpiritualGuides ||
    s.canIngestLiturgy ||
    s.canIngestHistory
  );
}

function feedKind(feedUrl: string): "sitemap" | "rss" | "fixed_url_list" {
  const lower = feedUrl.toLowerCase();
  if (lower.includes("sitemap") || lower.endsWith(".xml")) return "sitemap";
  if (lower.includes("rss") || lower.includes("feed") || lower.endsWith(".atom")) return "rss";
  return "fixed_url_list";
}

export async function runSourceConfigRepair(options: {
  sourceId?: string | null;
} = {}): Promise<SourceConfigRepairReport> {
  const report: SourceConfigRepairReport = {
    inspected: 0,
    markedNotConfigured: 0,
    markedFactoryNative: 0,
    missingPurposeFlags: [],
    missingContentTypes: [],
    errors: 0,
  };

  const sources: SourceRow[] = await prisma.ingestionSource
    .findMany({
      where: options.sourceId ? { id: options.sourceId } : {},
      take: 1000,
    })
    .catch((e) => {
      logger.warn("source-config-repair.read_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      report.errors += 1;
      return [] as SourceRow[];
    });

  const missingPurpose: Array<{ id: string; host: string }> = [];
  const missingTypes: Array<{ id: string; host: string }> = [];

  for (const s of sources) {
    report.inspected += 1;
    const hasPurposes = hasAnyPurpose(s);

    // A valid factory-native discovery method requires either a
    // discoveryFeedUrl (sitemap / rss / fixed list) or an explicit
    // "official_api" / "factory_handler" method already set.
    const hasValidMethod =
      !!s.discoveryFeedUrl ||
      s.discoveryMethod === "official_api" ||
      s.discoveryMethod === "factory_handler";

    if (!hasValidMethod) {
      // Not configured. Set status precisely so the admin source card
      // explains the exact reason.
      const reason = hasPurposes
        ? "Source has no discoveryFeedUrl — add a sitemap.xml or RSS feed URL to enable factory-native discovery."
        : "Source has no canIngest* purpose flags AND no discoveryFeedUrl.";
      const target = {
        discoveryMethod: "not_configured",
        configurationStatus: "not_configured",
        configurationStatusReason: reason,
      };
      if (
        s.discoveryMethod !== target.discoveryMethod ||
        s.configurationStatus !== target.configurationStatus
      ) {
        try {
          await prisma.ingestionSource.update({ where: { id: s.id }, data: target });
          report.markedNotConfigured += 1;
        } catch (e) {
          report.errors += 1;
          logger.warn("source-config-repair.update_not_configured_failed", {
            sourceId: s.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } else if (s.discoveryFeedUrl) {
      // Source has a usable feed — promote to factory_native.
      const method = s.discoveryMethod === "official_api" || s.discoveryMethod === "factory_handler"
        ? s.discoveryMethod
        : feedKind(s.discoveryFeedUrl);
      const target = {
        discoveryMethod: method,
        configurationStatus: "factory_native",
        configurationStatusReason: null,
      };
      if (
        s.discoveryMethod !== target.discoveryMethod ||
        s.configurationStatus !== target.configurationStatus
      ) {
        try {
          await prisma.ingestionSource.update({ where: { id: s.id }, data: target });
          report.markedFactoryNative += 1;
        } catch (e) {
          report.errors += 1;
          logger.warn("source-config-repair.update_factory_native_failed", {
            sourceId: s.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Reporting passes — these do not modify the source.
    if (s.isActive && !hasPurposes) {
      missingPurpose.push({ id: s.id, host: s.host });
    }
    if (s.isActive && hasPurposes === false) {
      // Reuse hasAnyPurpose result; if it has zero purposes it also
      // has zero supported content types.
      missingTypes.push({ id: s.id, host: s.host });
    }
  }

  report.missingPurposeFlags = missingPurpose;
  report.missingContentTypes = missingTypes;
  logger.info("source-config-repair.completed", {
    inspected: report.inspected,
    markedNotConfigured: report.markedNotConfigured,
    markedFactoryNative: report.markedFactoryNative,
    missingPurpose: missingPurpose.length,
    missingTypes: missingTypes.length,
    errors: report.errors,
  });
  return report;
}
