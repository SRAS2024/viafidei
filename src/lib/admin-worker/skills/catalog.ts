/**
 * Canonical content-type + content-subtype catalog for the Certified Admin
 * Skill Runtime. This is the spec's full universe of Via Fidei content (30
 * types, 40+ subtypes). Each entry says which real extractor backs it
 * (`extractable`) or `null` when no certified extractor exists yet — in which
 * case the capability matrix reports the type as MISSING and the worker files a
 * developer request rather than pretending it can build it.
 */

import { type ExtractableContentType } from "../content-types";

export interface ContentTypeSpec {
  /** Canonical content type (the spec's list, incl. derived/document types). */
  type: string;
  /** The real extractor that backs this type, or null if not yet certified. */
  extractable: ExtractableContentType | null;
  /** Content subtypes the worker should support for this type. */
  subtypes: readonly string[];
  /** Sensitive Catholic content requires a passing proof packet to publish. */
  sensitive: boolean;
}

export const CONTENT_TYPE_CATALOG: readonly ContentTypeSpec[] = [
  {
    type: "PRAYER",
    extractable: "PRAYER",
    subtypes: [
      "common_prayer",
      "marian_prayer",
      "eucharistic_prayer",
      "saint_prayer",
      "liturgical_prayer",
    ],
    sensitive: false,
  },
  {
    type: "NOVENA",
    extractable: "NOVENA",
    subtypes: ["novena_day", "full_novena"],
    sensitive: false,
  },
  {
    type: "LITANY",
    extractable: "PRAYER",
    subtypes: ["litany_invocation", "full_litany"],
    sensitive: false,
  },
  {
    type: "ROSARY",
    extractable: "ROSARY",
    subtypes: ["rosary_mystery", "rosary_prayer"],
    sensitive: false,
  },
  {
    type: "CONSECRATION",
    extractable: "CONSECRATION",
    subtypes: ["consecration_day", "full_consecration"],
    sensitive: false,
  },
  { type: "DEVOTION", extractable: "DEVOTION", subtypes: [], sensitive: true },
  { type: "SAINT", extractable: "SAINT", subtypes: ["saint_biography"], sensitive: false },
  { type: "POPE", extractable: "POPE", subtypes: ["pope_biography"], sensitive: false },
  { type: "DOCTOR", extractable: "DOCTOR", subtypes: ["doctor_profile"], sensitive: false },
  {
    type: "APPARITION",
    extractable: "APPARITION",
    subtypes: [
      "approved_apparition",
      "unapproved_apparition",
      "condemned_apparition",
      "apparition_under_review",
    ],
    sensitive: true,
  },
  { type: "MARIAN_TITLE", extractable: "MARIAN_TITLE", subtypes: [], sensitive: true },
  { type: "SACRAMENT", extractable: "SACRAMENT", subtypes: [], sensitive: true },
  {
    type: "CHURCH_DOCUMENT",
    extractable: "CHURCH_DOCUMENT",
    subtypes: [
      "encyclical",
      "apostolic_exhortation",
      "apostolic_constitution",
      "motu_proprio",
      "council_constitution",
      "council_decree",
      "council_declaration",
    ],
    sensitive: true,
  },
  {
    type: "PAPAL_DOCUMENT",
    extractable: "CHURCH_DOCUMENT",
    subtypes: ["encyclical", "apostolic_exhortation", "apostolic_constitution", "motu_proprio"],
    sensitive: true,
  },
  {
    type: "COUNCIL_DOCUMENT",
    extractable: "CHURCH_DOCUMENT",
    subtypes: ["council_constitution", "council_decree", "council_declaration"],
    sensitive: true,
  },
  {
    type: "CATECHISM_REFERENCE",
    extractable: "CHURCH_DOCUMENT",
    subtypes: ["catechism_paragraph"],
    sensitive: true,
  },
  {
    type: "CANON_LAW_REFERENCE",
    extractable: "CHURCH_DOCUMENT",
    subtypes: ["canon_law_canon"],
    sensitive: true,
  },
  {
    type: "LITURGICAL_READING",
    extractable: "LITURGICAL",
    subtypes: ["daily_mass_reading", "sunday_mass_reading"],
    sensitive: true,
  },
  {
    type: "LITURGICAL_CALENDAR_DAY",
    extractable: "LITURGICAL",
    subtypes: ["liturgical_season"],
    sensitive: true,
  },
  {
    type: "FEAST_DAY",
    extractable: "LITURGICAL",
    subtypes: ["solemnity", "memorial", "feast", "optional_memorial"],
    sensitive: true,
  },
  { type: "HOLY_DAY", extractable: "LITURGICAL", subtypes: [], sensitive: true },
  { type: "RITE", extractable: "RITE", subtypes: [], sensitive: true },
  { type: "PARISH", extractable: "PARISH", subtypes: ["parish_profile"], sensitive: false },
  { type: "DIOCESE", extractable: null, subtypes: ["diocese_profile"], sensitive: false },
  {
    type: "RELIGIOUS_ORDER",
    extractable: null,
    subtypes: ["religious_order_profile"],
    sensitive: false,
  },
  {
    type: "CHURCH_HISTORY_EVENT",
    extractable: "CHURCH_DOCUMENT",
    subtypes: ["church_history_timeline_entry"],
    sensitive: true,
  },
  { type: "CREED", extractable: null, subtypes: [], sensitive: true },
  { type: "GUIDE", extractable: "GUIDE", subtypes: [], sensitive: false },
  { type: "SPIRITUAL_PRACTICE", extractable: "SPIRITUAL_PRACTICE", subtypes: [], sensitive: false },
  { type: "HOMEPAGE_BLOCK", extractable: null, subtypes: [], sensitive: false },
] as const;

/** All canonical content types. */
export function allCatalogTypes(): string[] {
  return CONTENT_TYPE_CATALOG.map((c) => c.type);
}

/** All canonical content subtypes (deduped). */
export function allCatalogSubtypes(): string[] {
  return [...new Set(CONTENT_TYPE_CATALOG.flatMap((c) => c.subtypes))].sort();
}

export function catalogEntry(type: string): ContentTypeSpec | null {
  return CONTENT_TYPE_CATALOG.find((c) => c.type === type) ?? null;
}

/** Sensitive Catholic categories that require a proof packet to publish. */
export function isSensitiveType(type: string): boolean {
  return catalogEntry(type)?.sensitive ?? false;
}
