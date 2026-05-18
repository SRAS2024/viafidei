/**
 * Builder version registry.
 *
 * Every builder declares its identity, version, required source
 * permissions, and the output fields it MUST emit for a complete
 * package. The registry is the canonical "what does this builder
 * need / what does it produce" lookup the dispatcher, content type
 * router, and the rebuild-on-version-bump scheduler all read.
 *
 * Adding a new builder means adding an entry here AND in
 * `builders/index.ts`.
 */

import type { ContentTypeKey } from "./types";
import { BUILDER_REGISTRY } from "./builders";
import type { SourcePurpose } from "../content-qa/source-purpose";

export type BuilderRegistryEntry = {
  /** Stable builder identity — matches `Builder.builderName`. */
  builderName: string;
  /** Semver-style version string — matches `Builder.builderVersion`. */
  builderVersion: string;
  /** The content type this builder produces. */
  contentType: ContentTypeKey;
  /** Source-purpose flag that gates this builder. */
  requiredSourcePurpose: SourcePurpose;
  /**
   * SourceDocument sections this builder reads (`headings`,
   * `paragraphs`, `lists`, `tables`, `links`, `metadata`). Used by
   * the content type router to skip builders that need a section the
   * source document doesn't expose.
   */
  requiredSourceSections: ReadonlyArray<
    "headings" | "paragraphs" | "lists" | "tables" | "links" | "metadata"
  >;
  /**
   * Required output fields the builder MUST populate inside its
   * package `payload` for the build to be considered structurally
   * complete (and therefore eligible for strict QA). Missing fields
   * surface as a `build_failed_missing_required_fields` outcome with
   * the field name in `missingFields`.
   */
  requiredOutputFields: ReadonlyArray<string>;
};

export const BUILDER_VERSION_REGISTRY: Readonly<Record<ContentTypeKey, BuilderRegistryEntry>> = {
  Prayer: {
    builderName: BUILDER_REGISTRY.Prayer.builderName,
    builderVersion: BUILDER_REGISTRY.Prayer.builderVersion,
    contentType: "Prayer",
    requiredSourcePurpose: "canIngestPrayers",
    requiredSourceSections: ["headings", "paragraphs"],
    requiredOutputFields: ["prayerType", "prayerName", "prayerText", "category", "language"],
  },
  Saint: {
    builderName: BUILDER_REGISTRY.Saint.builderName,
    builderVersion: BUILDER_REGISTRY.Saint.builderVersion,
    contentType: "Saint",
    requiredSourcePurpose: "canIngestSaints",
    requiredSourceSections: ["headings", "paragraphs", "metadata"],
    requiredOutputFields: [
      "saintType",
      "saintName",
      "feastDay",
      "feastMonth",
      "feastDayOfMonth",
      "biography",
    ],
  },
  MarianApparition: {
    builderName: BUILDER_REGISTRY.MarianApparition.builderName,
    builderVersion: BUILDER_REGISTRY.MarianApparition.builderVersion,
    contentType: "MarianApparition",
    requiredSourcePurpose: "canIngestApparitions",
    requiredSourceSections: ["headings", "paragraphs"],
    requiredOutputFields: ["title", "location", "year", "description"],
  },
  Parish: {
    builderName: BUILDER_REGISTRY.Parish.builderName,
    builderVersion: BUILDER_REGISTRY.Parish.builderVersion,
    contentType: "Parish",
    requiredSourcePurpose: "canIngestParishes",
    requiredSourceSections: ["headings", "paragraphs", "metadata"],
    requiredOutputFields: ["parishName", "city", "country"],
  },
  Devotion: {
    builderName: BUILDER_REGISTRY.Devotion.builderName,
    builderVersion: BUILDER_REGISTRY.Devotion.builderVersion,
    contentType: "Devotion",
    requiredSourcePurpose: "canIngestDevotions",
    requiredSourceSections: ["headings", "paragraphs", "lists"],
    requiredOutputFields: [
      "devotionType",
      "devotionName",
      "background",
      "practiceInstructions",
      "prayerStructure",
    ],
  },
  Novena: {
    builderName: BUILDER_REGISTRY.Novena.builderName,
    builderVersion: BUILDER_REGISTRY.Novena.builderVersion,
    contentType: "Novena",
    requiredSourcePurpose: "canIngestNovenas",
    requiredSourceSections: ["headings", "paragraphs", "lists"],
    requiredOutputFields: ["novenaName", "background", "purpose", "duration", "days"],
  },
  Sacrament: {
    builderName: BUILDER_REGISTRY.Sacrament.builderName,
    builderVersion: BUILDER_REGISTRY.Sacrament.builderVersion,
    contentType: "Sacrament",
    requiredSourcePurpose: "canIngestSacraments",
    requiredSourceSections: ["headings", "paragraphs"],
    requiredOutputFields: [
      "sacramentKey",
      "sacramentName",
      "sacramentGroup",
      "explanation",
      "preparation",
      "participation",
    ],
  },
  Rosary: {
    builderName: BUILDER_REGISTRY.Rosary.builderName,
    builderVersion: BUILDER_REGISTRY.Rosary.builderVersion,
    contentType: "Rosary",
    requiredSourcePurpose: "canIngestRosaryGuides",
    requiredSourceSections: ["headings", "paragraphs", "lists"],
    requiredOutputFields: [
      "background",
      "howToPray",
      "openingPrayers",
      "mysterySets",
      "closingPrayers",
    ],
  },
  Consecration: {
    builderName: BUILDER_REGISTRY.Consecration.builderName,
    builderVersion: BUILDER_REGISTRY.Consecration.builderVersion,
    contentType: "Consecration",
    requiredSourcePurpose: "canIngestConsecrations",
    requiredSourceSections: ["headings", "paragraphs", "lists"],
    requiredOutputFields: [
      "consecrationName",
      "background",
      "duration",
      "dailyStructure",
      "dailyPrayers",
      "finalConsecrationPrayer",
    ],
  },
  SpiritualGuidance: {
    builderName: BUILDER_REGISTRY.SpiritualGuidance.builderName,
    builderVersion: BUILDER_REGISTRY.SpiritualGuidance.builderVersion,
    contentType: "SpiritualGuidance",
    requiredSourcePurpose: "canIngestSpiritualGuides",
    requiredSourceSections: ["headings", "paragraphs"],
    requiredOutputFields: ["title", "body"],
  },
  Liturgy: {
    builderName: BUILDER_REGISTRY.Liturgy.builderName,
    builderVersion: BUILDER_REGISTRY.Liturgy.builderVersion,
    contentType: "Liturgy",
    requiredSourcePurpose: "canIngestLiturgy",
    requiredSourceSections: ["headings", "paragraphs"],
    requiredOutputFields: ["title", "body"],
  },
  History: {
    builderName: BUILDER_REGISTRY.History.builderName,
    builderVersion: BUILDER_REGISTRY.History.builderVersion,
    contentType: "History",
    requiredSourcePurpose: "canIngestHistory",
    requiredSourceSections: ["headings", "paragraphs"],
    requiredOutputFields: ["historyType", "title", "dateOrEra", "summary", "body"],
  },
};

/**
 * Lookup entry by content type. Throws if the type is unknown — the
 * registry is exhaustive by construction.
 */
export function getBuilderRegistryEntry(contentType: ContentTypeKey): BuilderRegistryEntry {
  const entry = BUILDER_VERSION_REGISTRY[contentType];
  if (!entry) throw new Error(`No builder-registry entry for content type ${contentType}`);
  return entry;
}

/**
 * All registry entries as a flat array — used by dashboards that
 * iterate over every builder.
 */
export function listBuilderRegistry(): ReadonlyArray<BuilderRegistryEntry> {
  return Object.values(BUILDER_VERSION_REGISTRY);
}
