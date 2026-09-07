/**
 * Builds the /history timeline: the static event spine merged with the
 * published CHURCH_DOCUMENT rows.
 *
 * Merge rules (audit HIST-01/02/03/04/09):
 *   - A published document whose slug equals a static event's
 *     `links.documentSlug` (or the event's own slug) ENRICHES that event —
 *     it gains the document page href and the official text URL — instead of
 *     appearing twice.
 *   - Every other published document becomes its own "document" (or
 *     "council") event, placed by its issue date. Curated councils were
 *     published with a `-01-01` placeholder day, so a council document whose
 *     date ends in -01-01 is shown at YEAR precision rather than as a
 *     fabricated 1 January.
 *   - Related links (popes, saints, doctors, apparitions) are kept only when
 *     the referenced slug is published; when a slug set is not supplied at
 *     all the curated links are trusted as-is.
 *   - Order is chronological (sort key, then title). Static events carry
 *     no body: context + significance suffice for the list, and the document
 *     page holds the excerpt.
 */

import { documentTypeLabel } from "../church-documents";
import { parseYear } from "../saints";
import { CHURCH_HISTORY_EVENTS } from "../church-history-events";
import {
  HISTORY_ERAS,
  eraForYear,
  formatHistoryDate,
  historySortKey,
  type ChurchHistoryEvent,
  type DatePrecision,
  type HistoryEra,
  type HistoryKind,
} from "./types";

/** The projection of a published CHURCH_DOCUMENT the timeline needs — no body. */
export interface TimelineDocument {
  slug: string;
  title: string;
  documentType?: string;
  issuedDate?: string;
  issuingAuthority?: string;
  keyThemes?: string[];
  summary?: string;
  canonicalUrl?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The timeline projection of a published CHURCH_DOCUMENT payload — the body is dropped. */
export function timelineDocumentFromPayload(
  slug: string,
  title: string,
  payload: Record<string, unknown>,
): TimelineDocument {
  const themes = Array.isArray(payload.keyThemes)
    ? payload.keyThemes.filter((x): x is string => typeof x === "string")
    : undefined;
  return {
    slug,
    title,
    documentType: str(payload.documentType),
    issuedDate: str(payload.issuedDate),
    issuingAuthority: str(payload.issuingAuthority),
    keyThemes: themes,
    summary: str(payload.summary),
    canonicalUrl: str(payload.canonicalUrl),
  };
}

export type HistoryLink = { href: string; label: string; external?: boolean };

export interface HistoryEvent {
  slug: string;
  title: string;
  /** Slider/sort year (AD). */
  year: number;
  /** "20 May 325" | "325" | "c. 33" — already formatted for display. */
  dateLabel: string;
  precision: DatePrecision;
  /** Zero-padded chronological key (see historySortKey). */
  sortKey: string;
  era: HistoryEra;
  kind: HistoryKind;
  /** Human label for the kind badge ("Council", "Encyclical", "Martyrdom"…). */
  kindLabel: string;
  tags: string[];
  /** Church-document type when the event is, or is enriched by, a document. */
  documentType?: string;
  location?: string;
  context?: string;
  significance?: string;
  /** Short summary for document-only events (capped; never the body). */
  excerpt?: string;
  /** Internal document page (/liturgy-history/<slug>) when published. */
  href?: string;
  /** Official text (vatican.va etc.). */
  canonicalUrl?: string;
  /** The static event's one authoritative citation. */
  citation?: string;
  links: HistoryLink[];
  /** True when the event came from the static dataset (else from a document). */
  fromDataset: boolean;
}

export interface HistoryEraSummary {
  key: HistoryEra;
  label: string;
  from: number;
  to: number;
  count: number;
}

export interface HistoryTimeline {
  events: HistoryEvent[];
  eras: HistoryEraSummary[];
  minYear: number;
  maxYear: number;
  /** How many events came from the static dataset vs. published documents. */
  datasetCount: number;
  documentCount: number;
}

export type RelatedLinkType = "popes" | "saints" | "doctors" | "apparitions";

export interface BuildTimelineOptions {
  /**
   * Published slugs per related type. A type that is present filters the
   * curated links to published pages; an absent type keeps them all.
   */
  publishedSlugs?: Partial<Record<RelatedLinkType, ReadonlySet<string>>>;
  /** Override "today" (tests). */
  currentYear?: number;
}

/** Public routes for related content (all verified to exist under src/app). */
export const DOCUMENT_ROUTE_BASE = "/liturgy-history";
const RELATED_ROUTE_BASE: Record<RelatedLinkType, string> = {
  popes: "/popes",
  saints: "/saints",
  doctors: "/doctors",
  apparitions: "/our-lady",
};

const KIND_LABELS: Record<HistoryKind, string> = {
  event: "Event",
  council: "Council",
  document: "Document",
  martyrdom: "Martyrdom",
  saint: "Saint",
  pope: "Papacy",
  order: "Religious Order",
  apparition: "Apparition",
  mission: "Mission",
  schism: "Schism",
};

export function historyKindLabel(kind: HistoryKind, documentType?: string): string {
  // A document event is labelled by its magisterial type ("Encyclical"),
  // which is more informative than the generic "Document".
  if (kind === "document" && documentType) return documentTypeLabel(documentType);
  return KIND_LABELS[kind];
}

/** Slug → readable chip label: "pope-saint-paul-vi" → "Pope Saint Paul VI". */
export function relatedLinkLabel(slug: string): string {
  const roman = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi)$/i;
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => (roman.test(part) ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

const EXCERPT_LIMIT = 400;

function excerptOf(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return undefined;
  return flat.length > EXCERPT_LIMIT ? `${flat.slice(0, EXCERPT_LIMIT - 1).trimEnd()}…` : flat;
}

/**
 * Where a published document sits on the timeline. Curated councils were
 * seeded with a `-01-01` placeholder, so that pairing means "year only";
 * any other full ISO date is trusted as a day; a bare/loose year is a year.
 */
export function documentDatePrecision(doc: Pick<TimelineDocument, "documentType" | "issuedDate">): {
  year: number;
  date?: string;
  precision: DatePrecision;
} | null {
  const issued = doc.issuedDate?.trim();
  const year = parseYear(issued);
  if (year == null || !issued) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issued);
  if (!iso) return { year, precision: "year" };
  if (doc.documentType === "council_document" && issued.endsWith("-01-01")) {
    return { year, precision: "year" };
  }
  return { year, date: issued, precision: "day" };
}

function tagsForDocumentType(documentType?: string): string[] {
  switch (documentType) {
    case "dogmatic_definition":
    case "dogmatic_constitution":
      return ["dogma"];
    case "catechism_section":
      return ["catechism"];
    default:
      return [];
  }
}

function relatedLinks(
  links: ChurchHistoryEvent["links"],
  published: BuildTimelineOptions["publishedSlugs"],
): HistoryLink[] {
  const out: HistoryLink[] = [];
  if (!links) return out;
  for (const type of ["popes", "saints", "doctors", "apparitions"] as const) {
    const slugs = links[type];
    if (!slugs) continue;
    const allowed = published?.[type];
    for (const slug of slugs) {
      if (allowed && !allowed.has(slug)) continue; // unpublished page → no dead link
      out.push({ href: `${RELATED_ROUTE_BASE[type]}/${slug}`, label: relatedLinkLabel(slug) });
    }
  }
  return out;
}

function fromStatic(
  e: ChurchHistoryEvent,
  doc: TimelineDocument | undefined,
  opts: BuildTimelineOptions,
): HistoryEvent {
  const links: HistoryLink[] = [];
  if (doc) links.push({ href: `${DOCUMENT_ROUTE_BASE}/${doc.slug}`, label: "Read the document" });
  const canonicalUrl = doc?.canonicalUrl;
  if (canonicalUrl) links.push({ href: canonicalUrl, label: "Official text", external: true });
  links.push(...relatedLinks(e.links, opts.publishedSlugs));
  return {
    slug: e.slug,
    title: e.title,
    year: e.year,
    dateLabel: formatHistoryDate(e),
    precision: e.precision,
    sortKey: historySortKey(e),
    era: e.era,
    kind: e.kind,
    kindLabel: historyKindLabel(e.kind, doc?.documentType),
    tags: e.tags ?? [],
    documentType: doc?.documentType,
    location: e.location,
    context: e.context,
    significance: e.significance,
    href: doc ? `${DOCUMENT_ROUTE_BASE}/${doc.slug}` : undefined,
    canonicalUrl,
    citation: e.citation,
    links,
    fromDataset: true,
  };
}

function fromDocument(doc: TimelineDocument): HistoryEvent | null {
  const placed = documentDatePrecision(doc);
  if (!placed) return null; // a document needs a year to sit on the timeline
  const kind: HistoryKind = doc.documentType === "council_document" ? "council" : "document";
  const links: HistoryLink[] = [
    { href: `${DOCUMENT_ROUTE_BASE}/${doc.slug}`, label: "Read the document" },
  ];
  if (doc.canonicalUrl)
    links.push({ href: doc.canonicalUrl, label: "Official text", external: true });
  const themes = doc.keyThemes?.filter((t) => typeof t === "string" && t.trim()) ?? [];
  return {
    slug: doc.slug,
    title: doc.title,
    year: placed.year,
    dateLabel: formatHistoryDate(placed),
    precision: placed.precision,
    sortKey: historySortKey(placed),
    era: eraForYear(placed.year),
    kind,
    kindLabel: historyKindLabel(kind, doc.documentType),
    tags: tagsForDocumentType(doc.documentType),
    documentType: doc.documentType,
    context: doc.issuingAuthority,
    significance: themes.length ? themes.join(", ") : undefined,
    excerpt: excerptOf(doc.summary),
    href: `${DOCUMENT_ROUTE_BASE}/${doc.slug}`,
    canonicalUrl: doc.canonicalUrl,
    links,
    fromDataset: false,
  };
}

/**
 * Slider bounds: from Christ's ministry (≈30 AD) to the current year, widened
 * only if an event falls outside that range.
 */
export function historyYearBounds(
  years: number[],
  currentYear = new Date().getUTCFullYear(),
  floor = 30,
): { minYear: number; maxYear: number } {
  if (years.length === 0) return { minYear: floor, maxYear: currentYear };
  return {
    minYear: Math.min(floor, ...years),
    maxYear: Math.max(currentYear, ...years),
  };
}

export function buildTimeline(
  documents: TimelineDocument[],
  opts: BuildTimelineOptions = {},
): HistoryTimeline {
  const bySlug = new Map<string, TimelineDocument>();
  for (const doc of documents) if (!bySlug.has(doc.slug)) bySlug.set(doc.slug, doc);

  const events: HistoryEvent[] = [];
  const consumed = new Set<string>();
  for (const e of CHURCH_HISTORY_EVENTS) {
    // The curated documentSlug wins; an event that IS the document (same
    // slug, e.g. munificentissimus-deus) matches on its own slug.
    const docSlug = e.links?.documentSlug ?? e.slug;
    const doc = bySlug.get(docSlug) ?? bySlug.get(e.slug);
    if (doc) consumed.add(doc.slug);
    events.push(fromStatic(e, doc, opts));
  }
  let documentCount = 0;
  for (const doc of bySlug.values()) {
    if (consumed.has(doc.slug)) continue;
    const event = fromDocument(doc);
    if (!event) continue;
    events.push(event);
    documentCount += 1;
  }
  events.sort((a, b) =>
    a.sortKey !== b.sortKey ? (a.sortKey < b.sortKey ? -1 : 1) : a.title.localeCompare(b.title),
  );

  const counts = new Map<HistoryEra, number>();
  for (const e of events) counts.set(e.era, (counts.get(e.era) ?? 0) + 1);
  const eras: HistoryEraSummary[] = HISTORY_ERAS.map((era) => ({
    key: era.key,
    label: era.label,
    from: era.from,
    to: era.to,
    count: counts.get(era.key) ?? 0,
  }));
  const { minYear, maxYear } = historyYearBounds(
    events.map((e) => e.year),
    opts.currentYear,
  );
  return {
    events,
    eras,
    minYear,
    maxYear,
    datasetCount: CHURCH_HISTORY_EVENTS.length,
    documentCount,
  };
}
