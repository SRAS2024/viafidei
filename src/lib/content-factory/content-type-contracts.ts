/**
 * Centralized content-type contracts.
 *
 * One canonical map keyed by `ContentTypeKey`. Every consumer that
 * asks "what fields are required for a complete X package?" reads
 * from this map:
 *
 *   - builder-registry        (requiredOutputFields)
 *   - persist.ts              (REQUIRED_FIELDS_BY_TYPE)
 *   - strict-public-gate      (isPackagedRowComplete checks)
 *   - diagnostics             (per-type readiness reports)
 *   - tests                   (test-only contract validation)
 *
 * The contract carries the persistence target (which Prisma model the
 * content type lives in), the required builder-output fields, the
 * deterministic fields that may skip provenance, and the source
 * purpose flag that gates ingestion. Adding a new content type means
 * adding one entry here.
 *
 * Spec #13: prevent the "package marked complete but rejected at
 * persistence because the field name didn't match" failure mode.
 */

import type { ContentTypeKey } from "./types";

/**
 * Which Prisma model carries this content type's persisted rows.
 * Multiple content types may share a persistence target (Novena +
 * Devotion → Devotion model; Rosary / Consecration / SpiritualGuidance
 * / Sacrament → SpiritualLifeGuide model; History → LiturgyEntry).
 */
export type PersistenceTarget =
  | "Prayer"
  | "Saint"
  | "MarianApparition"
  | "Devotion"
  | "SpiritualLifeGuide"
  | "LiturgyEntry"
  | "Parish";

export type ContentTypeContract = {
  contentType: ContentTypeKey;
  /** Where the persisted row lives. */
  persistenceTarget: PersistenceTarget;
  /** Source-purpose flag a source must carry to ingest this type. */
  requiredSourcePurpose: string;
  /**
   * Fields the builder MUST emit in `package.payload` for a complete
   * package. Strict QA, persistence, and the builder-registry all
   * read the same list.
   */
  requiredFields: ReadonlyArray<string>;
  /**
   * Fields whose values are filled by deterministic internal rules
   * (slug normalization, sacrament group mapping, ISO date parse)
   * and therefore may skip the per-field provenance check.
   */
  deterministicFields: ReadonlyArray<string>;
  /**
   * Strict-public gate requirements — fields the persisted row MUST
   * have set (non-empty) for `publicRenderReady=true`. These are
   * usually a subset of requiredFields; the renderer reads them so
   * the public catalog never shows a row with blanks.
   */
  publicRenderRequired: ReadonlyArray<string>;
};

const CONTRACTS: Readonly<Record<ContentTypeKey, ContentTypeContract>> = {
  Prayer: {
    contentType: "Prayer",
    persistenceTarget: "Prayer",
    requiredSourcePurpose: "canIngestPrayers",
    requiredFields: ["prayerType", "prayerName", "prayerText", "category"],
    deterministicFields: ["slug"],
    publicRenderRequired: ["prayerText", "category"],
  },
  Saint: {
    contentType: "Saint",
    persistenceTarget: "Saint",
    requiredSourcePurpose: "canIngestSaints",
    requiredFields: [
      "saintType",
      "saintName",
      "biography",
      "feastDay",
      "feastMonth",
      "feastDayOfMonth",
    ],
    deterministicFields: ["slug"],
    publicRenderRequired: ["saintName", "biography"],
  },
  MarianApparition: {
    contentType: "MarianApparition",
    persistenceTarget: "MarianApparition",
    requiredSourcePurpose: "canIngestApparitions",
    requiredFields: [
      "apparitionName",
      "location",
      "country",
      "approvalStatus",
      "background",
      "summary",
    ],
    deterministicFields: [],
    publicRenderRequired: ["apparitionName", "location", "country", "summary"],
  },
  Parish: {
    contentType: "Parish",
    persistenceTarget: "Parish",
    requiredSourcePurpose: "canIngestParishes",
    requiredFields: ["parishName", "city", "country"],
    deterministicFields: [],
    publicRenderRequired: ["parishName", "city", "country"],
  },
  Devotion: {
    contentType: "Devotion",
    persistenceTarget: "Devotion",
    requiredSourcePurpose: "canIngestDevotions",
    requiredFields: [
      "devotionType",
      "devotionName",
      "background",
      "practiceInstructions",
      "prayerStructure",
    ],
    deterministicFields: ["slug"],
    publicRenderRequired: ["devotionName", "background", "practiceInstructions"],
  },
  Novena: {
    contentType: "Novena",
    persistenceTarget: "Devotion",
    requiredSourcePurpose: "canIngestNovenas",
    requiredFields: ["novenaName", "background", "purpose", "duration", "days"],
    deterministicFields: [],
    publicRenderRequired: ["novenaName", "background", "purpose", "days"],
  },
  Sacrament: {
    contentType: "Sacrament",
    persistenceTarget: "SpiritualLifeGuide",
    requiredSourcePurpose: "canIngestSacraments",
    requiredFields: [
      "sacramentKey",
      "sacramentName",
      "sacramentGroup",
      "explanation",
      "preparation",
      "participation",
    ],
    deterministicFields: ["sacramentKey", "sacramentGroup"],
    publicRenderRequired: ["sacramentName", "explanation"],
  },
  Rosary: {
    contentType: "Rosary",
    persistenceTarget: "SpiritualLifeGuide",
    requiredSourcePurpose: "canIngestRosaryGuides",
    requiredFields: [
      "background",
      "howToPray",
      "openingPrayers",
      "mysterySets",
      "closingPrayers",
    ],
    deterministicFields: [],
    publicRenderRequired: ["background", "mysterySets"],
  },
  Consecration: {
    contentType: "Consecration",
    persistenceTarget: "SpiritualLifeGuide",
    requiredSourcePurpose: "canIngestConsecrations",
    requiredFields: [
      "consecrationName",
      "background",
      "duration",
      "dailyStructure",
      "dailyPrayers",
      "finalConsecrationPrayer",
    ],
    deterministicFields: [],
    publicRenderRequired: ["consecrationName", "background", "dailyPrayers"],
  },
  SpiritualGuidance: {
    contentType: "SpiritualGuidance",
    persistenceTarget: "SpiritualLifeGuide",
    requiredSourcePurpose: "canIngestSpiritualGuides",
    requiredFields: ["guideName", "background", "title", "body"],
    deterministicFields: [],
    publicRenderRequired: ["title", "body"],
  },
  Liturgy: {
    contentType: "Liturgy",
    persistenceTarget: "LiturgyEntry",
    requiredSourcePurpose: "canIngestLiturgy",
    requiredFields: ["liturgyKind", "title", "body"],
    deterministicFields: [],
    publicRenderRequired: ["title", "body"],
  },
  History: {
    contentType: "History",
    persistenceTarget: "LiturgyEntry",
    requiredSourcePurpose: "canIngestHistory",
    requiredFields: ["historyType", "title", "dateOrEra", "summary", "body"],
    deterministicFields: [],
    publicRenderRequired: ["title", "summary", "body"],
  },
};

/**
 * Look up the contract for a content type. Throws when the type is
 * unknown — the map is exhaustive by construction.
 */
export function getContentTypeContract(contentType: ContentTypeKey): ContentTypeContract {
  const contract = CONTRACTS[contentType];
  if (!contract) {
    throw new Error(`No content-type contract registered for ${contentType}`);
  }
  return contract;
}

/**
 * Required builder-output fields for a content type. Equivalent to
 * `getContentTypeContract(...).requiredFields` but exposed as a
 * convenience for builder-registry / persistence call sites that
 * previously kept their own list.
 */
export function getRequiredFields(contentType: ContentTypeKey): ReadonlyArray<string> {
  return getContentTypeContract(contentType).requiredFields;
}

/**
 * Deterministic fields for a content type. Equivalent to
 * `getContentTypeContract(...).deterministicFields`.
 */
export function getDeterministicFields(contentType: ContentTypeKey): ReadonlyArray<string> {
  return getContentTypeContract(contentType).deterministicFields;
}

/**
 * Public-render-required fields for a content type — the strict gate
 * uses these to verify a persisted row before flipping
 * `publicRenderReady=true`.
 */
export function getPublicRenderRequiredFields(
  contentType: ContentTypeKey,
): ReadonlyArray<string> {
  return getContentTypeContract(contentType).publicRenderRequired;
}

/**
 * All contracts as a flat array. Used by dashboards that need to
 * iterate every content type.
 */
export function listContentTypeContracts(): ReadonlyArray<ContentTypeContract> {
  return Object.values(CONTRACTS);
}

export const CONTENT_TYPE_CONTRACTS = CONTRACTS;
