/**
 * Query columns derived from a published payload.
 *
 * PublishedContent stores every record's fields in one JSON payload. That is
 * right for rendering, but the hot filters the site runs at request time —
 * "which saints have their feast today", "parishes near me", "sort saints
 * chronologically", "guides of this kind" — cannot use an index on JSON they
 * have to parse row by row. These plain columns are written at publish time
 * (and refreshed by the worker's hygiene sweep for rows published before they
 * existed) so those lookups become indexed range scans instead of full-table
 * loads. Pure and deterministic: the same payload always yields the same
 * columns, so a backfill and a fresh publish can never disagree.
 */

import { saintSortYear } from "./saints";

export interface DerivedColumns {
  feastMonth: number | null;
  feastDayOfMonth: number | null;
  sortYear: number | null;
  subtype: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
  sourceRef: string | null;
  addressKey: string | null;
}

function int(v: unknown, lo: number, hi: number): number | null {
  const n =
    typeof v === "number" ? v : typeof v === "string" && /^\d{1,2}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

function num(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Feast month/day from either the `MM-DD` string or the numeric pair. */
export function feastOf(payload: Record<string, unknown>): {
  month: number | null;
  day: number | null;
} {
  let month = int(payload.feastMonth, 1, 12);
  let day = int(payload.feastDayOfMonth, 1, 31);
  if ((month == null || day == null) && typeof payload.feastDay === "string") {
    const m = /^(\d{2})-(\d{2})$/.exec(payload.feastDay.trim());
    if (m) {
      month = month ?? int(m[1], 1, 12);
      day = day ?? int(m[2], 1, 31);
    }
  }
  return month != null && day != null ? { month, day } : { month: null, day: null };
}

/** The classification field each type uses for its filter chips. */
export function subtypeOf(contentType: string, payload: Record<string, unknown>): string | null {
  switch (contentType) {
    case "SAINT":
      return str(payload.saintType) ?? str(payload.contentSubtype);
    case "GUIDE":
      return str(payload.kind);
    case "PRAYER":
      return str(payload.prayerType) ?? str(payload.contentSubtype);
    case "PARISH":
      return str(payload.designation) ?? "parish";
    case "LITURGICAL":
      return str(payload.kind) ?? str(payload.liturgyType) ?? str(payload.contentSubtype);
    case "CHURCH_DOCUMENT":
      return str(payload.documentType) ?? str(payload.contentSubtype);
    case "SPIRITUAL_PRACTICE":
      return str(payload.practiceKind) ?? str(payload.kind) ?? str(payload.contentSubtype);
    case "DEVOTION":
      return str(payload.devotionType) ?? str(payload.kind) ?? str(payload.contentSubtype);
    case "APPARITION":
      return str(payload.approvalStatus) ?? str(payload.contentSubtype);
    default:
      return str(payload.kind) ?? str(payload.contentSubtype);
  }
}

/** Where a structured record came from (OSM id, Wikidata QID URL, …). */
export function sourceRefOf(payload: Record<string, unknown>): string | null {
  const explicit = str(payload.sourceRef) ?? str(payload.placeId);
  if (explicit) return explicit;
  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  const wikidata = citations.find(
    (c): c is string => typeof c === "string" && /wikidata\.org\/wiki\/Q\d+/.test(c),
  );
  return wikidata ?? null;
}

/**
 * Compute every derived column for a payload. Values outside their valid
 * range are stored as null rather than guessed.
 */
export function derivedColumnsFor(
  contentType: string,
  payload: Record<string, unknown> | null | undefined,
): DerivedColumns {
  const p = payload ?? {};
  const feast = contentType === "SAINT" ? feastOf(p) : { month: null, day: null };
  const isParish = contentType === "PARISH";
  const latitude = isParish ? num(p.latitude, -90, 90) : null;
  const longitude = isParish ? num(p.longitude, -180, 180) : null;
  const region = isParish
    ? [str(p.country), str(p.state), str(p.city)].filter(Boolean).join("/") || null
    : null;
  return {
    feastMonth: feast.month,
    feastDayOfMonth: feast.day,
    sortYear: contentType === "SAINT" ? saintSortYear(p) : null,
    subtype: subtypeOf(contentType, p),
    latitude,
    longitude,
    region,
    sourceRef: sourceRefOf(p),
    addressKey: isParish ? str(p.addressKey) : null,
  };
}
