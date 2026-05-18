/**
 * Builder weakness diagnostic.
 *
 * Groups recent ContentPackageBuildLog failures by (contentType,
 * missingField) so the admin sees patterns like:
 *
 *   "8 Novena builds failed because Day 7 could not be parsed →
 *    NovenaBuilder day parser weakness"
 *   "12 Saint builds failed because patronage was missing →
 *    SaintBuilder enrichment / source selection issue"
 *
 * The pattern is observable purely from the build log; no schema
 * change is required.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import type { ContentTypeKey } from "../content-factory";

const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_REPETITION_FOR_WEAKNESS = 3;

export type BuilderWeaknessEntry = {
  builderName: string;
  contentType: ContentTypeKey;
  /** Missing field that is repeatedly absent across builds. */
  missingField: string;
  failureCount: number;
  /** Human-readable advice for the admin. */
  message: string;
  /** Sample sourceUrls so the admin can drill in. */
  sampleSourceUrls: string[];
};

const WEAKNESS_MESSAGE_BY_CONTENT_TYPE: Partial<Record<ContentTypeKey, (field: string) => string>> =
  {
    Novena: (field) =>
      /day/i.test(field)
        ? "NovenaBuilder day parser weakness — the builder cannot identify Day N from these source pages."
        : `NovenaBuilder is missing ${field} repeatedly — the builder may need a more flexible extractor for this field.`,
    Saint: (field) =>
      /patronage/i.test(field)
        ? "SaintBuilder enrichment or source selection issue — patronage is not surfaced by the chosen sources."
        : /feast/i.test(field)
          ? "SaintBuilder feast-day extractor weakness — the builder cannot parse the feast date from these sources."
          : `SaintBuilder is missing ${field} repeatedly — review extractor or pick a richer source.`,
    Rosary: () =>
      "RosaryBuilder mystery extraction weakness — confirm the canonical Rosary structure is being used and the source provides texts.",
    Prayer: (field) =>
      /prayerText|body/i.test(field)
        ? "PrayerBuilder cannot isolate the actual prayer text — strengthen the prayer-language detector."
        : `PrayerBuilder is missing ${field} repeatedly.`,
    Sacrament: (field) =>
      /preparation/i.test(field)
        ? "SacramentBuilder preparation extractor weakness — preparation is not present on these source pages."
        : `SacramentBuilder is missing ${field} repeatedly.`,
  };

function defaultMessage(contentType: ContentTypeKey, field: string, count: number): string {
  return `${contentType}Builder is missing ${field} on ${count} recent builds — likely needs improvement or a richer source.`;
}

export async function getBuilderWeaknessReport(
  options: {
    windowMs?: number;
    minRepetition?: number;
  } = {},
): Promise<BuilderWeaknessEntry[]> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const minRepetition = options.minRepetition ?? MIN_REPETITION_FOR_WEAKNESS;
  const cutoff = new Date(Date.now() - windowMs);

  const rows = await prisma.contentPackageBuildLog
    .findMany({
      where: {
        buildStatus: { not: "built_complete_package" },
        createdAt: { gt: cutoff },
        missingFieldsJson: { not: null as never },
      },
      select: {
        contentType: true,
        builderName: true,
        sourceUrl: true,
        missingFieldsJson: true,
      },
      take: 2000,
    })
    .catch((e) => {
      logger.warn("builder-weakness.read_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    });

  type Key = string;
  const acc = new Map<
    Key,
    {
      builderName: string;
      contentType: ContentTypeKey;
      field: string;
      count: number;
      urls: string[];
    }
  >();
  for (const r of rows) {
    const missing = Array.isArray(r.missingFieldsJson) ? (r.missingFieldsJson as string[]) : [];
    for (const field of missing) {
      if (typeof field !== "string") continue;
      const key = `${r.contentType}::${field}`;
      const existing = acc.get(key);
      if (existing) {
        existing.count += 1;
        if (existing.urls.length < 5 && r.sourceUrl) existing.urls.push(r.sourceUrl);
      } else {
        acc.set(key, {
          builderName: r.builderName,
          contentType: r.contentType as ContentTypeKey,
          field,
          count: 1,
          urls: r.sourceUrl ? [r.sourceUrl] : [],
        });
      }
    }
  }
  const entries: BuilderWeaknessEntry[] = [];
  for (const v of acc.values()) {
    if (v.count < minRepetition) continue;
    const messageFn = WEAKNESS_MESSAGE_BY_CONTENT_TYPE[v.contentType];
    const message = messageFn
      ? messageFn(v.field)
      : defaultMessage(v.contentType, v.field, v.count);
    entries.push({
      builderName: v.builderName,
      contentType: v.contentType,
      missingField: v.field,
      failureCount: v.count,
      message,
      sampleSourceUrls: v.urls,
    });
  }
  entries.sort((a, b) => b.failureCount - a.failureCount);
  return entries;
}
