/**
 * Source-purpose allowlist. A source approved for saints is NOT
 * automatically approved for prayers; a source approved for parish
 * directory data is NOT approved for prayer extraction; and so on.
 *
 * Allowed source purposes are stored as boolean columns on
 * `IngestionSource` (one column per purpose). At ingestion time the
 * strict QA pipeline checks `getSourcePurposes(host)` and rejects any
 * candidate whose content type does not match an approved purpose
 * for the originating host.
 *
 * Static defaults live in this module and seed every source's flags
 * on first observation; the admin UI can later toggle the flags
 * per-source.
 */

import { prisma } from "../db/client";
import type { ContentTypeKey } from "./types";

/**
 * Every source-purpose key. Mirrors the columns added to IngestionSource
 * in migration 0013.
 */
export type SourcePurpose =
  | "canIngestPrayers"
  | "canIngestSaints"
  | "canIngestApparitions"
  | "canIngestParishes"
  | "canIngestDevotions"
  | "canIngestNovenas"
  | "canIngestSacraments"
  | "canIngestRosaryGuides"
  | "canIngestConsecrations"
  | "canIngestSpiritualGuides"
  | "canIngestLiturgy"
  | "canIngestHistory"
  | "canProvideScriptureText";

export const SOURCE_PURPOSES: ReadonlyArray<SourcePurpose> = [
  "canIngestPrayers",
  "canIngestSaints",
  "canIngestApparitions",
  "canIngestParishes",
  "canIngestDevotions",
  "canIngestNovenas",
  "canIngestSacraments",
  "canIngestRosaryGuides",
  "canIngestConsecrations",
  "canIngestSpiritualGuides",
  "canIngestLiturgy",
  "canIngestHistory",
  "canProvideScriptureText",
];

/**
 * Map a content type to the source-purpose column that gates it.
 */
export function purposeForContentType(contentType: ContentTypeKey): SourcePurpose | null {
  switch (contentType) {
    case "Prayer":
      return "canIngestPrayers";
    case "Saint":
      return "canIngestSaints";
    case "MarianApparition":
      return "canIngestApparitions";
    case "Parish":
      return "canIngestParishes";
    case "Devotion":
      return "canIngestDevotions";
    case "Novena":
      return "canIngestNovenas";
    case "Sacrament":
      return "canIngestSacraments";
    case "Rosary":
      return "canIngestRosaryGuides";
    case "Consecration":
      return "canIngestConsecrations";
    case "SpiritualGuidance":
      return "canIngestSpiritualGuides";
    case "Liturgy":
      return "canIngestLiturgy";
    case "History":
      return "canIngestHistory";
  }
}

export type SourcePurposeRecord = Record<SourcePurpose, boolean>;

const EMPTY_PURPOSES: SourcePurposeRecord = {
  canIngestPrayers: false,
  canIngestSaints: false,
  canIngestApparitions: false,
  canIngestParishes: false,
  canIngestDevotions: false,
  canIngestNovenas: false,
  canIngestSacraments: false,
  canIngestRosaryGuides: false,
  canIngestConsecrations: false,
  canIngestSpiritualGuides: false,
  canIngestLiturgy: false,
  canIngestHistory: false,
  canProvideScriptureText: false,
};

/**
 * Static defaults for hosts we know enough about to seed on first
 * observation. The admin can override per-source via the existing
 * sources UI. Anything not listed here gets the conservative all-
 * false default and must be approved by an admin before it can ingest
 * any content.
 */
const STATIC_HOST_PURPOSES: Readonly<Record<string, Partial<SourcePurposeRecord>>> = {
  // ── Holy See ── canonical for everything except parishes & scripture text.
  "vatican.va": {
    canIngestPrayers: true,
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestSacraments: true,
    canIngestRosaryGuides: true,
    canIngestConsecrations: true,
    canIngestSpiritualGuides: true,
    canIngestLiturgy: true,
    canIngestHistory: true,
  },
  "www.vatican.va": {
    canIngestPrayers: true,
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestSacraments: true,
    canIngestRosaryGuides: true,
    canIngestConsecrations: true,
    canIngestSpiritualGuides: true,
    canIngestLiturgy: true,
    canIngestHistory: true,
  },
  "vaticannews.va": {
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestHistory: true,
    canIngestLiturgy: true,
  },
  "www.vaticannews.va": {
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestHistory: true,
    canIngestLiturgy: true,
  },

  // ── Bishops' conferences ── doctrine, liturgy, sacraments.
  "usccb.org": {
    canIngestPrayers: true,
    canIngestSaints: true,
    canIngestDevotions: true,
    canIngestSacraments: true,
    canIngestLiturgy: true,
    canIngestHistory: true,
    canIngestParishes: true,
    canIngestSpiritualGuides: true,
  },
  "www.usccb.org": {
    canIngestPrayers: true,
    canIngestSaints: true,
    canIngestDevotions: true,
    canIngestSacraments: true,
    canIngestLiturgy: true,
    canIngestHistory: true,
    canIngestParishes: true,
    canIngestSpiritualGuides: true,
  },
  "bible.usccb.org": { canProvideScriptureText: true },

  // ── Established Catholic publishers ── prayers, saints, devotions, history.
  "ewtn.com": {
    canIngestPrayers: true,
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestRosaryGuides: true,
    canIngestConsecrations: true,
    canIngestSpiritualGuides: true,
    canIngestHistory: true,
  },
  "www.ewtn.com": {
    canIngestPrayers: true,
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestRosaryGuides: true,
    canIngestConsecrations: true,
    canIngestSpiritualGuides: true,
    canIngestHistory: true,
  },
  "catholic.com": {
    canIngestSaints: true,
    canIngestSacraments: true,
    canIngestSpiritualGuides: true,
    canIngestHistory: true,
  },
  "www.catholic.com": {
    canIngestSaints: true,
    canIngestSacraments: true,
    canIngestSpiritualGuides: true,
    canIngestHistory: true,
  },
  "newadvent.org": {
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestHistory: true,
  },
  "www.newadvent.org": {
    canIngestSaints: true,
    canIngestApparitions: true,
    canIngestHistory: true,
  },
  "catholicculture.org": {
    canIngestPrayers: true,
    canIngestDevotions: true,
    canIngestLiturgy: true,
    canIngestHistory: true,
  },
  "www.catholicculture.org": {
    canIngestPrayers: true,
    canIngestDevotions: true,
    canIngestLiturgy: true,
    canIngestHistory: true,
  },

  // ── Parish directory only ── canonical parish source, NOT approved
  //   for prayers / saints / etc.
  "parishesonline.com": { canIngestParishes: true },
  "www.parishesonline.com": { canIngestParishes: true },
  "masstimes.org": { canIngestParishes: true },
  "www.masstimes.org": { canIngestParishes: true },
  "thecatholicdirectory.com": { canIngestParishes: true },
  "www.thecatholicdirectory.com": { canIngestParishes: true },
  "catholic-hierarchy.org": { canIngestParishes: true },
  "www.catholic-hierarchy.org": { canIngestParishes: true },
  "diocesan.com": { canIngestParishes: true },
  "www.diocesan.com": { canIngestParishes: true },
  "gcatholic.org": { canIngestParishes: true },
  "www.gcatholic.org": { canIngestParishes: true },

  // ── Approved Bible translations / scripture text providers ──
  "biblegateway.com": { canProvideScriptureText: true },
  "www.biblegateway.com": { canProvideScriptureText: true },
  "drbo.org": { canProvideScriptureText: true },
  "www.drbo.org": { canProvideScriptureText: true },

  // ── Marian / pilgrimage shrines ── approved for the apparition they host.
  "fatima.pt": { canIngestApparitions: true },
  "www.fatima.pt": { canIngestApparitions: true },
  "lourdes-france.org": { canIngestApparitions: true },
  "www.lourdes-france.org": { canIngestApparitions: true },
  "virgendeguadalupe.org.mx": { canIngestApparitions: true },
  "www.virgendeguadalupe.org.mx": { canIngestApparitions: true },
  "knock-shrine.ie": { canIngestApparitions: true },
  "www.knock-shrine.ie": { canIngestApparitions: true },

  // ── Divine Mercy / Marian orders ── novenas, devotions, consecrations.
  "thedivinemercy.org": {
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestConsecrations: true,
    canIngestRosaryGuides: true,
    canIngestSpiritualGuides: true,
  },
  "www.thedivinemercy.org": {
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestConsecrations: true,
    canIngestRosaryGuides: true,
    canIngestSpiritualGuides: true,
  },
  "marian.org": {
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestConsecrations: true,
  },
  "www.marian.org": {
    canIngestDevotions: true,
    canIngestNovenas: true,
    canIngestConsecrations: true,
  },
};

/**
 * Apply STATIC_HOST_PURPOSES + falls-back to all-false. Pure function
 * so it can be called without a database round-trip in tests and in
 * the strict QA pipeline.
 */
export function staticPurposesForHost(host: string | null | undefined): SourcePurposeRecord {
  if (!host) return { ...EMPTY_PURPOSES };
  const lower = host.toLowerCase();
  const seed = STATIC_HOST_PURPOSES[lower];
  return { ...EMPTY_PURPOSES, ...(seed ?? {}) };
}

/**
 * DB-backed lookup. Returns whatever the source row currently has; if
 * the source row does not exist yet, falls back to the static
 * defaults so a previously-unknown source from the static allowlist
 * still works on first ingest.
 */
export async function getSourcePurposes(
  host: string | null | undefined,
): Promise<SourcePurposeRecord> {
  if (!host) return { ...EMPTY_PURPOSES };
  const lower = host.toLowerCase();
  try {
    const row = await prisma.ingestionSource.findUnique({ where: { host: lower } });
    if (!row) return staticPurposesForHost(lower);
    return {
      canIngestPrayers: row.canIngestPrayers,
      canIngestSaints: row.canIngestSaints,
      canIngestApparitions: row.canIngestApparitions,
      canIngestParishes: row.canIngestParishes,
      canIngestDevotions: row.canIngestDevotions,
      canIngestNovenas: row.canIngestNovenas,
      canIngestSacraments: row.canIngestSacraments,
      canIngestRosaryGuides: row.canIngestRosaryGuides,
      canIngestConsecrations: row.canIngestConsecrations,
      canIngestSpiritualGuides: row.canIngestSpiritualGuides,
      canIngestLiturgy: row.canIngestLiturgy,
      canIngestHistory: row.canIngestHistory,
      canProvideScriptureText: row.canProvideScriptureText,
    };
  } catch {
    return staticPurposesForHost(lower);
  }
}

/**
 * Synchronous check used by tests + by code paths that already have
 * the source's purposes loaded. Returns true when the source is
 * approved to ingest the given content type.
 */
export function isSourceApprovedFor(
  purposes: SourcePurposeRecord,
  contentType: ContentTypeKey,
): boolean {
  const key = purposeForContentType(contentType);
  if (!key) return false;
  return purposes[key] === true;
}

/**
 * Ensure the IngestionSource row for `host` has its purposes seeded
 * from the static map. Idempotent; only writes when at least one flag
 * differs from what's already stored.
 */
export async function seedSourcePurposes(host: string): Promise<void> {
  const lower = host.toLowerCase();
  const target = staticPurposesForHost(lower);
  const existing = await prisma.ingestionSource.findUnique({ where: { host: lower } });
  if (!existing) return;
  const diff: Partial<SourcePurposeRecord> = {};
  for (const key of SOURCE_PURPOSES) {
    if ((existing as unknown as SourcePurposeRecord)[key] !== target[key]) {
      diff[key] = target[key];
    }
  }
  if (Object.keys(diff).length === 0) return;
  await prisma.ingestionSource.update({ where: { host: lower }, data: diff });
}
