/**
 * Public route + cache-tag mapping for the Admin Worker.
 *
 * Translates a (ChecklistContentType, slug) pair into:
 *   - the public URL path the worker should HTTP-probe after publish
 *   - the tab key the row should appear under for post-publish
 *     tab-placement verification
 *   - the cache tag set the worker should revalidate
 *
 * Mirrors `src/lib/cache/tags.ts` but keyed off ChecklistContentType
 * instead of the legacy ContentTypeTagKey so the Admin Worker reads
 * cleanly from PublishedContent rows.
 */

import type { ChecklistContentType } from "@prisma/client";

import {
  CONTENT_TYPE_TO_TAB,
  contentSlugTag,
  contentTypeTag,
  SEARCH_INDEX_TAG,
  SITEMAP_TAG,
  tabTag,
  type ContentTypeTagKey,
  type TabKey,
} from "@/lib/cache/tags";

/**
 * Map ChecklistContentType -> the legacy ContentTypeTagKey the cache
 * module already uses. Keeps the two systems in lockstep.
 */
const CHECKLIST_TO_TAG_KEY: Record<ChecklistContentType, ContentTypeTagKey> = {
  PRAYER: "Prayer",
  SAINT: "Saint",
  DEVOTION: "Devotion",
  NOVENA: "Novena",
  SACRAMENT: "Sacrament",
  MARIAN_TITLE: "MarianApparition",
  APPARITION: "MarianApparition",
  GUIDE: "Guide",
  CHURCH_DOCUMENT: "History",
  LITURGICAL: "Liturgy",
  SPIRITUAL_PRACTICE: "SpiritualGuidance",
  PARISH: "Parish",
  POPE: "Pope",
  DOCTOR: "Doctor",
  RITE: "Rite",
};

const TAB_PATH: Record<TabKey, string> = {
  prayers: "/prayers",
  saints: "/saints",
  apparitions: "/our-lady",
  parishes: "/parishes",
  devotions: "/devotions",
  novenas: "/novenas",
  sacraments: "/sacraments",
  rosary: "/rosary",
  consecrations: "/consecrations",
  guides: "/guides",
  spiritualLife: "/spiritual-life",
  liturgy: "/liturgy",
  history: "/history",
  popes: "/popes",
  doctors: "/doctors",
  rites: "/rites",
};

/**
 * Some content types are listed under one tab but their detail pages live
 * under a different base. Liturgy and Church-document detail pages both
 * render at `/liturgy-history/<slug>`, even though they are listed under the
 * Liturgy and History tabs. The post-publish probe must hit the real detail
 * URL, so it uses this override instead of `tabPath/<slug>`.
 */
const SLUG_BASE_OVERRIDE: Partial<Record<ChecklistContentType, string>> = {
  LITURGICAL: "/liturgy-history",
  CHURCH_DOCUMENT: "/liturgy-history",
};

export interface PublicRouteInfo {
  tab: TabKey;
  tabPath: string;
  slugPath: string;
  cacheTags: readonly string[];
}

export function publicRouteFor(
  contentType: ChecklistContentType | string,
  slug: string,
): PublicRouteInfo {
  const tagKey =
    (CHECKLIST_TO_TAG_KEY[contentType as ChecklistContentType] as ContentTypeTagKey) ?? "Prayer";
  const tab = (CONTENT_TYPE_TO_TAB[tagKey] ?? "prayers") as TabKey;
  const tabPath = TAB_PATH[tab];
  const slugBase = SLUG_BASE_OVERRIDE[contentType as ChecklistContentType] ?? tabPath;
  const slugPath = `${slugBase}/${encodeURIComponent(slug)}`;
  return {
    tab,
    tabPath,
    slugPath,
    cacheTags: [
      contentTypeTag(tagKey),
      contentSlugTag(tagKey, slug),
      tabTag(tab),
      SITEMAP_TAG,
      SEARCH_INDEX_TAG,
    ],
  };
}

/**
 * Resolve the public origin to probe. In production this is the
 * `PUBLIC_BASE_URL` env var; in dev / test the worker falls back to
 * `http://localhost:3000` so post-publish probes still work locally.
 *
 * Never throws — callers can post-publish without crashing the loop
 * if the env var is wrong.
 */
export function publicOrigin(): string {
  const candidate = process.env.PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return "https://etviafidei.com";
  }
  return "http://localhost:3000";
}

export function publicUrlFor(contentType: ChecklistContentType | string, slug: string): string {
  return `${publicOrigin()}${publicRouteFor(contentType, slug).slugPath}`;
}
