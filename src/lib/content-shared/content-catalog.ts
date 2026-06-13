/**
 * Content catalog — the single source of truth for every user-facing content
 * category the site publishes, INCLUDING the view-based categories that are not
 * their own `ChecklistContentType` (Litanies, Our Lady, the Liturgical Calendar,
 * History). The admin worker console renders this so an admin can confirm that
 * every page the site offers is represented and growing — not just the raw
 * content-type enum.
 *
 * Order is the canonical site order (matches the navigation), so the console's
 * content list reads the way the site does. For every non-view category the
 * `target` / `hardMax` MUST equal the growth goal the orchestrator actually
 * drives toward (DEFAULT_GOAL_SEEDS) — a drift-guard test enforces this, so the
 * console can never show e.g. Saints at /1,000 while the worker builds toward
 * /10,000. Derived VIEW categories keep their own curatorial sub-target.
 *
 * Counting:
 *   - Most categories map directly to one or more content types.
 *   - Derived categories carry a `predicate` over the published payload
 *     (e.g. Litanies = prayers whose prayerType is "litany"). These are marked
 *     `derived` because they share their underlying type with another category.
 */
import type { ChecklistContentType } from "@prisma/client";

export interface CatalogCategory {
  key: string;
  label: string;
  /** Public page the category is browsed on. */
  page: string;
  /** Underlying content type(s) the category draws from. */
  types: ChecklistContentType[];
  /** Growth target shown as the denominator of "have / target". */
  target: number;
  /** Hard maximum (only Sacraments are capped); null otherwise. */
  hardMax?: number;
  /** Payload predicate for view-based categories (Litanies, …). */
  predicate?: (payload: Record<string, unknown>) => boolean;
  /** True when this is a view over a type also listed as its own category. */
  derived?: boolean;
  /** Short explanation shown in the console. */
  note?: string;
}

const titleHas = (p: Record<string, unknown>, re: RegExp): boolean =>
  typeof p.title === "string" && re.test(p.title);

const isLitany = (p: Record<string, unknown>): boolean =>
  p.prayerType === "litany" || titleHas(p, /litany/i);

const CALENDAR_KINDS = [
  "feast",
  "solemnity",
  "memorial",
  "optional_memorial",
  "liturgical_season",
  "liturgical_year",
];
const isCalendarEntry = (p: Record<string, unknown>): boolean =>
  typeof p.kind === "string" && CALENDAR_KINDS.includes(p.kind);

/**
 * Every category named on the public site, in the site's display order. This
 * list is what the admin worker console shows, so a missing page here means a
 * missing row in the console. The first fifteen follow the navigation order
 * exactly; Devotions and Novenas (also real pages) follow.
 */
export const CONTENT_CATALOG: CatalogCategory[] = [
  { key: "prayers", label: "Prayers", page: "/prayers", types: ["PRAYER"], target: 1000 },
  {
    key: "litanies",
    label: "Litanies",
    page: "/litanies",
    types: ["PRAYER"],
    target: 100,
    derived: true,
    predicate: isLitany,
    note: "Prayers categorised as litanies",
  },
  { key: "saints", label: "Saints", page: "/saints", types: ["SAINT"], target: 10000 },
  {
    key: "our-lady",
    label: "Our Lady",
    page: "/our-lady",
    types: ["MARIAN_TITLE", "APPARITION"],
    target: 100,
    note: "Marian titles + approved apparitions",
  },
  {
    key: "doctors",
    label: "Doctors of the Church",
    page: "/doctors",
    types: ["DOCTOR"],
    target: 37,
  },
  { key: "popes", label: "Popes", page: "/popes", types: ["POPE"], target: 267 },
  {
    key: "sacraments",
    label: "Sacraments",
    page: "/sacraments",
    types: ["SACRAMENT"],
    target: 7,
    hardMax: 7,
  },
  { key: "parishes", label: "Parishes", page: "/parishes", types: ["PARISH"], target: 300000 },
  {
    key: "spiritual-life",
    label: "Spiritual Life",
    page: "/spiritual-life",
    types: ["SPIRITUAL_PRACTICE"],
    target: 50,
  },
  { key: "guides", label: "Guides", page: "/guides", types: ["GUIDE"], target: 100 },
  { key: "liturgy", label: "Liturgy", page: "/liturgy", types: ["LITURGICAL"], target: 100 },
  {
    key: "liturgical-calendar",
    label: "Liturgical Calendar",
    page: "/liturgical-calendar",
    types: ["LITURGICAL"],
    target: 200,
    derived: true,
    predicate: isCalendarEntry,
    note: "Feasts, solemnities, memorials & seasons",
  },
  { key: "rites", label: "Rites", page: "/rites", types: ["RITE"], target: 24 },
  {
    key: "history",
    label: "History",
    page: "/history",
    types: ["CHURCH_DOCUMENT"],
    target: 200,
    derived: true,
    note: "Church-history timeline of magisterial documents",
  },
  {
    key: "church-documents",
    label: "Church Documents",
    page: "/church-documents",
    types: ["CHURCH_DOCUMENT"],
    target: 200,
  },
  // Also-real pages not named in the primary navigation list.
  { key: "devotions", label: "Devotions", page: "/devotions", types: ["DEVOTION"], target: 100 },
  { key: "novenas", label: "Novenas", page: "/novenas", types: ["NOVENA"], target: 100 },
];

/** The content types that need payloads loaded to count a derived category. */
export const CATALOG_DERIVED_TYPES: ChecklistContentType[] = [
  ...new Set(CONTENT_CATALOG.filter((c) => c.predicate).flatMap((c) => c.types)),
];

export type CatalogCount = CatalogCategory & { count: number };

/**
 * Compute the live published count for every catalog category.
 *
 * @param grouped     per-type published counts (from a groupBy)
 * @param derivedRows published payloads for CATALOG_DERIVED_TYPES (for predicate categories)
 */
export function computeContentCatalog(
  grouped: Array<{ contentType: string; count: number }>,
  derivedRows: Array<{ contentType: string; payload: Record<string, unknown> }>,
): CatalogCount[] {
  const byType = new Map(grouped.map((g) => [g.contentType, g.count]));
  return CONTENT_CATALOG.map((cat) => {
    let count: number;
    if (cat.predicate) {
      count = derivedRows.filter(
        (r) => (cat.types as string[]).includes(r.contentType) && cat.predicate!(r.payload ?? {}),
      ).length;
    } else {
      count = cat.types.reduce((sum, t) => sum + (byType.get(t) ?? 0), 0);
    }
    return { ...cat, count };
  });
}
