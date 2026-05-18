/**
 * Package normalization layer.
 *
 * Builders produce raw extracted values; this layer normalises them
 * to canonical forms before strict QA runs. Every normaliser here is
 * deterministic, side-effect free, and re-runnable.
 *
 *   - Title:          collapses whitespace, strips trailing brand suffixes
 *   - Slug:           lower-kebab, ASCII-only, dedupes trailing -1 chains
 *   - Date:           ISO-8601 if recognisable
 *   - Feast day:      "Month Day" (e.g. "April 29")
 *   - Prayer type:    canonical bucket from VALID_PRAYER_TYPES
 *   - Devotion type:  canonical bucket
 *   - Sacrament:      Confession → Reconciliation, Marriage → Matrimony
 *   - History type:   canonical Church-history category
 *   - Scripture ref:  "Book Chapter:Verse" or "Book Chapter:Verse-Verse"
 *   - Source host:    bare host (no scheme, no path, no www)
 *   - Whitespace:     collapses runs, strips Unicode invisibles
 */

import type { ContentPackage } from "../types";
import {
  SACRAMENT_KEYS,
  SACRAMENT_LABELS,
  isCanonicalSacramentKey,
} from "../../content-qa/sacrament-normalize";
import { VALID_PRAYER_TYPES } from "../../content-qa/contracts/prayer";

const BRAND_SUFFIXES = [
  /\s*\|\s*EWTN.*$/i,
  /\s*\|\s*Vatican\.va.*$/i,
  /\s*-\s*USCCB.*$/i,
  /\s*-\s*Catholic Online.*$/i,
];

export function normalizeWhitespace(s: string): string {
  return s
    .replace(/[  -‏  　]/g, " ")
    .replace(/[​-‍]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(s: string): string {
  let out = normalizeWhitespace(s);
  for (const re of BRAND_SUFFIXES) {
    out = out.replace(re, "");
  }
  return out.trim();
}

export function normalizeSlug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/(-[0-9]+)+$/g, (m) => m.replace(/(-[0-9]+)+/, "-1"));
}

export function normalizeSourceHost(host: string): string {
  return host
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function normalizeFeastDay(input: {
  feastDay?: string;
  feastMonth?: number;
  feastDayOfMonth?: number;
}): { feastDay: string | null; feastMonth: number | null; feastDayOfMonth: number | null } {
  if (input.feastMonth && input.feastDayOfMonth) {
    const m = MONTH_NAMES[input.feastMonth - 1];
    if (m)
      return {
        feastDay: `${m} ${input.feastDayOfMonth}`,
        feastMonth: input.feastMonth,
        feastDayOfMonth: input.feastDayOfMonth,
      };
  }
  if (input.feastDay) {
    const m =
      /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})/i.exec(
        input.feastDay,
      );
    if (m) {
      const mi = MONTH_NAMES.findIndex((mn) =>
        mn.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)),
      );
      const dayNum = parseInt(m[2], 10);
      if (mi >= 0 && dayNum >= 1 && dayNum <= 31) {
        return {
          feastDay: `${MONTH_NAMES[mi]} ${dayNum}`,
          feastMonth: mi + 1,
          feastDayOfMonth: dayNum,
        };
      }
    }
  }
  return { feastDay: null, feastMonth: null, feastDayOfMonth: null };
}

export function normalizePrayerType(s: string): string {
  const lower = s.trim().toLowerCase();
  const exact = VALID_PRAYER_TYPES.find((t) => t.toLowerCase() === lower);
  if (exact) return exact;
  if (/marian|hail mary|mary|memorare/.test(lower)) return "Marian prayer";
  if (/rosary/.test(lower)) return "Rosary prayer";
  if (/novena/.test(lower)) return "Novena prayer";
  if (/morning/.test(lower)) return "Morning prayer";
  if (/evening|night|compline/.test(lower)) return "Evening prayer";
  if (/contrition|penance|repent/.test(lower)) return "Act of contrition";
  if (/eucharist|communion|adoration/.test(lower)) return "Eucharistic prayer";
  if (/litany/.test(lower)) return "Litany";
  if (/chaplet/.test(lower)) return "Chaplet prayer";
  if (/bless/.test(lower)) return "Blessing";
  if (/saint|intercession/.test(lower)) return "Saint intercession prayer";
  if (/devotional/.test(lower)) return "Devotional prayer";
  return "Traditional Catholic prayer";
}

export function normalizeDevotionType(s: string): string {
  const lower = s.trim().toLowerCase();
  if (/rosary/.test(lower)) return "Rosary devotion";
  if (/divine\s+mercy/.test(lower)) return "Divine Mercy devotion";
  if (/sacred\s+heart/.test(lower)) return "Sacred Heart devotion";
  if (/stations|via\s+crucis/.test(lower)) return "Stations of the Cross";
  if (/eucharist|adoration/.test(lower)) return "Eucharistic devotion";
  if (/marian|mary/.test(lower)) return "Marian devotion";
  if (/saint/.test(lower)) return "Saint devotion";
  return "General devotion";
}

export function normalizeSacramentAlias(name: string): string {
  const lower = name.trim().toLowerCase();
  if (isCanonicalSacramentKey(lower)) return lower;
  if (/^confession$|^penance$|^reconciliation$/i.test(name)) return "reconciliation";
  if (/^marriage$|^matrimony$/i.test(name)) return "matrimony";
  if (/^communion$|^eucharist$/i.test(name)) return "eucharist";
  if (/^baptism$|^christening$/i.test(name)) return "baptism";
  if (/^confirmation$|^chrismation$/i.test(name)) return "confirmation";
  if (/anointing|last\s+rites/i.test(name)) return "anointing_of_the_sick";
  if (/holy\s+orders|ordination/i.test(name)) return "holy_orders";
  return name;
}

export function sacramentLabelFor(key: string): string | null {
  if (!isCanonicalSacramentKey(key)) return null;
  return SACRAMENT_LABELS[key];
}

export function isSacramentKey(key: string): boolean {
  return (SACRAMENT_KEYS as ReadonlyArray<string>).includes(key);
}

export const HISTORY_TYPES = [
  "Councils",
  "Major Church events",
  "Encyclicals",
  "Papal consecrations",
  "Schisms",
  "Religious order foundings",
  "Catechisms",
  "Code of Canon Law",
  "Major papal acts",
  "Major doctrinal definitions",
  "Major ecumenical events",
  "Major liturgical reforms",
] as const;

export function normalizeHistoryType(s: string | null | undefined): string | null {
  if (!s) return null;
  const lower = s.toLowerCase();
  for (const t of HISTORY_TYPES) {
    if (lower.includes(t.toLowerCase())) return t;
  }
  if (/council/.test(lower)) return "Councils";
  if (/encyclical/.test(lower)) return "Encyclicals";
  if (/schism/.test(lower)) return "Schisms";
  if (/canon\s+law/.test(lower)) return "Code of Canon Law";
  if (/catechism/.test(lower)) return "Catechisms";
  if (/religious\s+order/.test(lower)) return "Religious order foundings";
  if (/papal\s+(?:bull|act)/.test(lower)) return "Major papal acts";
  if (/dogma|doctrine|definition/.test(lower)) return "Major doctrinal definitions";
  if (/ecumenical/.test(lower)) return "Major ecumenical events";
  if (/liturgical\s+reform/.test(lower)) return "Major liturgical reforms";
  return null;
}

const BIBLE_BOOK_ABBREV: Record<string, string> = {
  Mt: "Matthew",
  Mk: "Mark",
  Lk: "Luke",
  Jn: "John",
  Rom: "Romans",
  "1 Cor": "1 Corinthians",
  "2 Cor": "2 Corinthians",
  Gal: "Galatians",
  Eph: "Ephesians",
  Phil: "Philippians",
  Col: "Colossians",
  "1 Thess": "1 Thessalonians",
  "2 Thess": "2 Thessalonians",
  Heb: "Hebrews",
  Jas: "James",
  "1 Pet": "1 Peter",
  "2 Pet": "2 Peter",
  Rev: "Revelation",
  Gen: "Genesis",
  Ex: "Exodus",
  Lev: "Leviticus",
  Num: "Numbers",
  Deut: "Deuteronomy",
  Ps: "Psalms",
  Prov: "Proverbs",
  Isa: "Isaiah",
  Jer: "Jeremiah",
};

export function normalizeScriptureReference(s: string): string {
  const trimmed = normalizeWhitespace(s);
  for (const [abbrev, full] of Object.entries(BIBLE_BOOK_ABBREV)) {
    if (trimmed.startsWith(abbrev + " ")) {
      return trimmed.replace(abbrev, full);
    }
  }
  return trimmed;
}

/**
 * Apply normalization passes to a content package in-place. Returns
 * the same package for fluent chaining. Provenance is preserved.
 */
export function normalizePackage(pkg: ContentPackage): ContentPackage {
  pkg.title = normalizeTitle(pkg.title);
  pkg.slug = normalizeSlug(pkg.slug || pkg.title);
  pkg.sourceHost = normalizeSourceHost(pkg.sourceHost);

  switch (pkg.contentType) {
    case "Prayer": {
      const p = pkg.payload as Record<string, unknown>;
      if (typeof p.prayerType === "string") p.prayerType = normalizePrayerType(p.prayerType);
      if (typeof p.prayerName === "string") p.prayerName = normalizeTitle(p.prayerName);
      if (typeof p.prayerText === "string") p.prayerText = normalizeWhitespace(p.prayerText);
      break;
    }
    case "Saint": {
      const p = pkg.payload as Record<string, unknown>;
      if (typeof p.saintName === "string") p.saintName = normalizeTitle(p.saintName);
      const feast = normalizeFeastDay({
        feastDay: typeof p.feastDay === "string" ? p.feastDay : undefined,
        feastMonth: typeof p.feastMonth === "number" ? p.feastMonth : undefined,
        feastDayOfMonth: typeof p.feastDayOfMonth === "number" ? p.feastDayOfMonth : undefined,
      });
      if (feast.feastDay) p.feastDay = feast.feastDay;
      if (feast.feastMonth) p.feastMonth = feast.feastMonth;
      if (feast.feastDayOfMonth) p.feastDayOfMonth = feast.feastDayOfMonth;
      break;
    }
    case "Devotion": {
      const p = pkg.payload as Record<string, unknown>;
      if (typeof p.devotionType === "string")
        p.devotionType = normalizeDevotionType(p.devotionType);
      if (typeof p.devotionName === "string") p.devotionName = normalizeTitle(p.devotionName);
      break;
    }
    case "Sacrament": {
      const p = pkg.payload as Record<string, unknown>;
      if (typeof p.sacramentKey === "string") {
        const norm = normalizeSacramentAlias(p.sacramentKey);
        if (norm) p.sacramentKey = norm;
      }
      if (typeof p.sacramentName === "string") p.sacramentName = normalizeTitle(p.sacramentName);
      break;
    }
    case "History": {
      const p = pkg.payload as Record<string, unknown>;
      if (typeof p.historyType === "string")
        p.historyType = normalizeHistoryType(p.historyType) ?? p.historyType;
      break;
    }
    default:
      break;
  }
  return pkg;
}
