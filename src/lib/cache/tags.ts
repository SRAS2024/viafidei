/**
 * Cache tag definitions.
 *
 * Public content pages cache their data under a small set of stable
 * tags so the factory can revalidate the right slice after a
 * package is created, updated, or deleted. The tags are:
 *
 *   - content-type:<Type>           e.g. content-type:Prayer
 *   - content-slug:<Type>:<slug>    e.g. content-slug:Prayer:our-father
 *   - tab:<TabKey>                  e.g. tab:prayers
 *   - sitemap                       sitemap.xml
 *   - search-index                  internal /search route
 *
 * Centralising the tag builders keeps producers (`unstable_cache`)
 * and consumers (`revalidateTag()`) in lockstep — there is one
 * source of truth for every tag the codebase emits.
 */

import type { ChecklistContentType } from "@prisma/client";

export type ContentTypeTagKey =
  | "Prayer"
  | "Saint"
  | "MarianApparition"
  | "Parish"
  | "Devotion"
  | "Novena"
  | "Sacrament"
  | "Rosary"
  | "Consecration"
  | "SpiritualGuidance"
  | "Guide"
  | "Liturgy"
  | "History"
  | "Pope"
  | "Doctor"
  | "Rite";

export type TabKey =
  | "prayers"
  | "saints"
  | "apparitions"
  | "parishes"
  | "devotions"
  | "novenas"
  | "sacraments"
  | "rosary"
  | "consecrations"
  | "guides"
  | "spiritualLife"
  | "liturgy"
  | "history"
  | "popes"
  | "doctors"
  | "rites";

/** Map from content type to the public tab key it appears under. */
export const CONTENT_TYPE_TO_TAB: Record<ContentTypeTagKey, TabKey> = {
  Prayer: "prayers",
  Saint: "saints",
  MarianApparition: "apparitions",
  Parish: "parishes",
  Devotion: "devotions",
  Novena: "novenas",
  Sacrament: "sacraments",
  Rosary: "rosary",
  Consecration: "consecrations",
  SpiritualGuidance: "spiritualLife",
  Guide: "guides",
  Liturgy: "liturgy",
  History: "history",
  Pope: "popes",
  Doctor: "doctors",
  Rite: "rites",
};

/**
 * The same mapping keyed by the `ChecklistContentType` enum that every
 * PublishedContent row actually carries. The publish path passes those enum
 * values ("SAINT") into tagsForRow(), which used to look them up in the
 * legacy-keyed table above ("Saint"), miss, and fall back to `tab:prayers` —
 * so every published saint, parish, and guide revalidated the wrong tab.
 */
export const CHECKLIST_TYPE_TO_TAB: Record<ChecklistContentType, TabKey> = {
  PRAYER: "prayers",
  SAINT: "saints",
  APPARITION: "apparitions",
  MARIAN_TITLE: "apparitions",
  POPE: "popes",
  DOCTOR: "doctors",
  PARISH: "parishes",
  DEVOTION: "devotions",
  NOVENA: "novenas",
  GUIDE: "guides",
  SACRAMENT: "sacraments",
  LITURGICAL: "liturgy",
  CHURCH_DOCUMENT: "history",
  RITE: "rites",
  SPIRITUAL_PRACTICE: "spiritualLife",
};

/**
 * Resolve the public tab for either naming scheme — a legacy tag key
 * ("Saint") or a ChecklistContentType ("SAINT"). Returns null for an unknown
 * value so callers can choose their own fallback.
 */
export function tabForContentType(contentType: string): TabKey | null {
  if (contentType in CONTENT_TYPE_TO_TAB) {
    return CONTENT_TYPE_TO_TAB[contentType as ContentTypeTagKey];
  }
  if (contentType in CHECKLIST_TYPE_TO_TAB) {
    return CHECKLIST_TYPE_TO_TAB[contentType as ChecklistContentType];
  }
  return null;
}

export const contentTypeTag = (contentType: ContentTypeTagKey | string): string =>
  `content-type:${contentType}`;

export const contentSlugTag = (contentType: ContentTypeTagKey | string, slug: string): string =>
  `content-slug:${contentType}:${slug}`;

export const tabTag = (tab: TabKey | string): string => `tab:${tab}`;

export const SITEMAP_TAG = "sitemap";
export const SEARCH_INDEX_TAG = "search-index";

/**
 * Every tag affected by a content row change. Used to scope a
 * single `revalidateTag()` cascade after persistence / deletion.
 */
export function tagsForRow(contentType: ContentTypeTagKey | string, slug: string): string[] {
  const tab = tabForContentType(String(contentType)) ?? "prayers";
  return [
    contentTypeTag(contentType),
    contentSlugTag(contentType, slug),
    tabTag(tab),
    SITEMAP_TAG,
    SEARCH_INDEX_TAG,
  ];
}
