/**
 * Seed content routing.
 *
 * Seed entries are NOT inserted directly as public content. They flow
 * through the same content factory the worker uses for fetched
 * sources:
 *
 *   syntheticSourceDocument()  → SourceDocumentSnapshot
 *   runContentFactory()        → build → normalize → enrich → strict QA → persist
 *
 * Valid seed entries land as PUBLISHED rows with publicRenderReady +
 * isThresholdEligible = true, packageValidationStatus = "valid", and
 * field provenance attached. Invalid seed entries are deleted and
 * logged just like any other failed build.
 *
 * The seed data files only need to supply the raw text body + source
 * URL/host metadata; the factory derives every other field.
 */

import type { PrismaClient } from "@prisma/client";
import { runContentFactory, syntheticSourceDocument } from "../../src/lib/content-factory";
import type { ContentTypeKey } from "../../src/lib/content-factory";

export type FactorySeedEntry = {
  contentType: ContentTypeKey;
  title: string;
  rawBody: string;
  sourceUrl: string;
  sourceHost: string;
  sourceTier?: number | null;
  language?: string;
  metadata?: Record<string, string | undefined>;
  /**
   * Seed content is trusted by default — the source purpose for the
   * declared content type is forced on so the builder will accept it.
   * Adapters in production NEVER set this; only seed data does.
   */
  forceApproveSourcePurpose?: boolean;
};

const PURPOSE_FLAG: Record<ContentTypeKey, string> = {
  Prayer: "canIngestPrayers",
  Saint: "canIngestSaints",
  MarianApparition: "canIngestApparitions",
  Parish: "canIngestParishes",
  Devotion: "canIngestDevotions",
  Novena: "canIngestNovenas",
  Sacrament: "canIngestSacraments",
  Rosary: "canIngestRosaryGuides",
  Consecration: "canIngestConsecrations",
  SpiritualGuidance: "canIngestSpiritualGuides",
  Liturgy: "canIngestLiturgy",
  History: "canIngestHistory",
};

export type FactorySeedSummary = {
  attempted: number;
  persistedCreated: number;
  persistedUpdated: number;
  persistedSkipped: number;
  buildFailed: number;
  qaRejected: number;
  byContentType: Record<string, number>;
};

export async function routeSeedThroughFactory(
  prisma: PrismaClient,
  entries: ReadonlyArray<FactorySeedEntry>,
): Promise<FactorySeedSummary> {
  void prisma;
  const summary: FactorySeedSummary = {
    attempted: entries.length,
    persistedCreated: 0,
    persistedUpdated: 0,
    persistedSkipped: 0,
    buildFailed: 0,
    qaRejected: 0,
    byContentType: {},
  };

  for (const entry of entries) {
    const purposes = entry.forceApproveSourcePurpose
      ? { [PURPOSE_FLAG[entry.contentType]]: true }
      : {};
    const doc = syntheticSourceDocument({
      sourceUrl: entry.sourceUrl,
      sourceHost: entry.sourceHost,
      sourceTitle: entry.title,
      rawBody: entry.rawBody,
      language: entry.language ?? "en",
      sourcePurposes: purposes,
      metadata: entry.metadata ?? {},
      sourceTier: entry.sourceTier ?? 1,
    });
    const result = await runContentFactory({
      contentType: entry.contentType,
      document: doc,
      triggeredBy: "automatic",
      // Seed entries are trusted by definition — they are the
      // baseline content the spec §21 names. Mark them as
      // primary_content_source so the cross-source validator
      // does not require external evidence for a deterministic
      // seed file.
      sourceRole: "primary_content_source",
    });
    summary.byContentType[entry.contentType] = (summary.byContentType[entry.contentType] ?? 0) + 1;
    switch (result.decision) {
      case "persisted-created":
        summary.persistedCreated += 1;
        break;
      case "persisted-updated":
        summary.persistedUpdated += 1;
        break;
      case "persist-skipped":
        summary.persistedSkipped += 1;
        break;
      case "build-failed":
      case "wrong-content":
      case "source-not-allowed":
      case "not-supported":
      case "source-exhausted":
        summary.buildFailed += 1;
        break;
      case "qa-rejected":
      case "qa-deleted":
        summary.qaRejected += 1;
        break;
      case "duplicate":
        summary.persistedSkipped += 1;
        break;
    }
  }

  return summary;
}

/**
 * Adapt the legacy PRAYERS / SAINTS / etc. seed arrays into the
 * factory-seed shape. The defaults assume the seed content comes from
 * the project's own canonical corpus and is therefore trusted; we
 * label the source as "seed:viafidei" so the dashboard can tell seed
 * content apart from real upstream content.
 */
export function adaptLegacyPrayerSeed(
  items: ReadonlyArray<{
    slug: string;
    defaultTitle: string;
    category: string;
    body: string;
    officialPrayer?: string;
  }>,
): FactorySeedEntry[] {
  return items.map((p) => ({
    contentType: "Prayer",
    title: p.defaultTitle,
    rawBody: `${p.defaultTitle}\n\n${p.body}${p.officialPrayer ? `\n\nOfficial prayer:\n${p.officialPrayer}` : ""}`,
    sourceUrl: `seed://viafidei/prayer/${p.slug}`,
    sourceHost: "seed.viafidei",
    forceApproveSourcePurpose: true,
  }));
}

export function adaptLegacySaintSeed(
  items: ReadonlyArray<{
    slug: string;
    canonicalName: string;
    feastDay?: string;
    feastMonth?: number;
    feastDayOfMonth?: number;
    patronages: string[];
    biography: string;
    saintType?: string | null;
    officialPrayer?: string;
  }>,
): FactorySeedEntry[] {
  return items.map((s) => {
    const feastLine = s.feastDay ? `\n\nFeast day: ${s.feastDay}` : "";
    const patronageLine =
      s.patronages.length > 0 ? `\n\nPatron saint of ${s.patronages.join(", ")}.` : "";
    const prayerLine = s.officialPrayer ? `\n\nOfficial prayer: ${s.officialPrayer}` : "";
    return {
      contentType: "Saint",
      title: s.canonicalName,
      rawBody: `${s.canonicalName}\n\n${s.biography}${feastLine}${patronageLine}${prayerLine}`,
      sourceUrl: `seed://viafidei/saint/${s.slug}`,
      sourceHost: "seed.viafidei",
      forceApproveSourcePurpose: true,
    };
  });
}

export function adaptLegacyApparitionSeed(
  items: ReadonlyArray<{
    slug: string;
    title: string;
    location: string;
    country: string;
    approvedStatus: string;
    summary: string;
    officialPrayer?: string;
  }>,
): FactorySeedEntry[] {
  return items.map((a) => {
    const locationLine = `\n\nLocation: ${a.location}, ${a.country}.`;
    const statusLine = `\n\nApproval status: ${a.approvedStatus}.`;
    const prayerLine = a.officialPrayer ? `\n\nAssociated prayer: ${a.officialPrayer}` : "";
    return {
      contentType: "MarianApparition",
      title: a.title,
      rawBody: `${a.title}\n\n${a.summary}${locationLine}${statusLine}${prayerLine}`,
      sourceUrl: `seed://viafidei/apparition/${a.slug}`,
      sourceHost: "seed.viafidei",
      forceApproveSourcePurpose: true,
    };
  });
}

export function adaptLegacyDevotionSeed(
  items: ReadonlyArray<{
    slug: string;
    title: string;
    summary: string;
    practiceText?: string;
    durationMinutes?: number;
  }>,
): FactorySeedEntry[] {
  return items.map((d) => {
    const practiceLine = d.practiceText ? `\n\nPractice: ${d.practiceText}` : "";
    const durationLine = d.durationMinutes ? `\n\nDuration: ${d.durationMinutes} minutes.` : "";
    return {
      contentType: "Devotion",
      title: d.title,
      rawBody: `${d.title}\n\n${d.summary}${practiceLine}${durationLine}`,
      sourceUrl: `seed://viafidei/devotion/${d.slug}`,
      sourceHost: "seed.viafidei",
      forceApproveSourcePurpose: true,
    };
  });
}

export function adaptLegacyParishSeed(
  items: ReadonlyArray<{
    slug: string;
    name: string;
    address?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    diocese?: string | null;
    websiteUrl?: string | null;
  }>,
): FactorySeedEntry[] {
  return items.map((p) => {
    const lines = [
      p.name,
      "",
      p.address ?? "",
      p.city && p.region ? `${p.city}, ${p.region}` : (p.city ?? p.region ?? ""),
      p.country ?? "",
      p.diocese ? `Diocese of ${p.diocese}` : "",
      p.websiteUrl ? `Website: ${p.websiteUrl}` : "",
    ];
    return {
      contentType: "Parish",
      title: p.name,
      rawBody: lines.filter((l) => l.trim().length > 0).join("\n\n"),
      sourceUrl: `seed://viafidei/parish/${p.slug}`,
      sourceHost: "seed.viafidei",
      forceApproveSourcePurpose: true,
    };
  });
}

export function adaptLegacyLiturgySeed(
  items: ReadonlyArray<{
    slug: string;
    title: string;
    summary?: string | null;
    body: string;
    kind?: string;
    historyType?: string | null;
    dateOrEra?: string | null;
  }>,
): FactorySeedEntry[] {
  return items.map((l) => {
    const contentType: ContentTypeKey =
      l.historyType || l.slug.startsWith("church-history-") || l.slug.startsWith("council-")
        ? "History"
        : "Liturgy";
    return {
      contentType,
      title: l.title,
      rawBody: `${l.title}\n\n${l.summary ?? ""}\n\n${l.body}`,
      sourceUrl: `seed://viafidei/${contentType.toLowerCase()}/${l.slug}`,
      sourceHost: "seed.viafidei",
      forceApproveSourcePurpose: true,
    };
  });
}

export function adaptLegacyGuideSeed(
  items: ReadonlyArray<{
    slug: string;
    title: string;
    summary: string;
    bodyText?: string | null;
    kind?: string;
    sacramentKey?: string | null;
    steps?: unknown;
  }>,
): FactorySeedEntry[] {
  return items.map((g) => {
    const contentType: ContentTypeKey =
      g.sacramentKey || g.slug.startsWith("sacrament-")
        ? "Sacrament"
        : g.kind === "ROSARY" || g.slug.startsWith("rosary-")
          ? "Rosary"
          : g.kind === "CONSECRATION" || g.slug.startsWith("consecration-")
            ? "Consecration"
            : "SpiritualGuidance";
    const steps = Array.isArray(g.steps)
      ? (g.steps as Array<{ title?: string; body?: string }>)
          .map((s, i) => `\n\n${i + 1}. ${s.title ?? "Step"}: ${s.body ?? ""}`)
          .join("")
      : "";
    return {
      contentType,
      title: g.title,
      rawBody: `${g.title}\n\n${g.summary}\n\n${g.bodyText ?? ""}${steps}`,
      sourceUrl: `seed://viafidei/${contentType.toLowerCase()}/${g.slug}`,
      sourceHost: "seed.viafidei",
      forceApproveSourcePurpose: true,
    };
  });
}
