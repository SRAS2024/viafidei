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
import { getRequiredFields, getContentTypeContract } from "./content-type-contracts";

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

// Builder-side required SourceDocument sections. These describe what
// the BUILDER needs in the cleaned source document (headings,
// paragraphs, lists, ...), separate from what the builder OUTPUTS
// (the latter lives in `content-type-contracts.getRequiredFields`).
const REQUIRED_SOURCE_SECTIONS: Record<
  ContentTypeKey,
  ReadonlyArray<"headings" | "paragraphs" | "lists" | "tables" | "links" | "metadata">
> = {
  Prayer: ["headings", "paragraphs"],
  Saint: ["headings", "paragraphs", "metadata"],
  MarianApparition: ["headings", "paragraphs"],
  Parish: ["headings", "paragraphs", "metadata"],
  Devotion: ["headings", "paragraphs", "lists"],
  Novena: ["headings", "paragraphs", "lists"],
  Sacrament: ["headings", "paragraphs"],
  Rosary: ["headings", "paragraphs", "lists"],
  Consecration: ["headings", "paragraphs", "lists"],
  SpiritualGuidance: ["headings", "paragraphs"],
  Liturgy: ["headings", "paragraphs"],
  History: ["headings", "paragraphs"],
};

function buildRegistryEntry(contentType: ContentTypeKey): BuilderRegistryEntry {
  const contract = getContentTypeContract(contentType);
  const builder = BUILDER_REGISTRY[contentType];
  return {
    builderName: builder.builderName,
    builderVersion: builder.builderVersion,
    contentType,
    requiredSourcePurpose: contract.requiredSourcePurpose as SourcePurpose,
    requiredSourceSections: REQUIRED_SOURCE_SECTIONS[contentType],
    requiredOutputFields: getRequiredFields(contentType),
  };
}

/**
 * Spec #13: every per-content-type field below comes from the central
 * `content-type-contracts` module. Builder validation, strict QA,
 * persistence, and diagnostics all read the same field list, so a
 * package marked structurally complete by the builder will not later
 * be rejected by persistence for the wrong field name.
 */
export const BUILDER_VERSION_REGISTRY: Readonly<Record<ContentTypeKey, BuilderRegistryEntry>> = {
  Prayer: buildRegistryEntry("Prayer"),
  Saint: buildRegistryEntry("Saint"),
  MarianApparition: buildRegistryEntry("MarianApparition"),
  Parish: buildRegistryEntry("Parish"),
  Devotion: buildRegistryEntry("Devotion"),
  Novena: buildRegistryEntry("Novena"),
  Sacrament: buildRegistryEntry("Sacrament"),
  Rosary: buildRegistryEntry("Rosary"),
  Consecration: buildRegistryEntry("Consecration"),
  SpiritualGuidance: buildRegistryEntry("SpiritualGuidance"),
  Liturgy: buildRegistryEntry("Liturgy"),
  History: buildRegistryEntry("History"),
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
