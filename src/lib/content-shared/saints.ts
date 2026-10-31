/**
 * Saint ordering and labelling (spec — "Saints chronological ordering" and
 * "Saint Titles").
 *
 * Saints are listed in the order they lived, but the foundational figures
 * come first in a fixed canonical order — Mary, Joseph, John the Baptist,
 * Peter, the remaining Apostles, Matthias, then Paul — before everyone else
 * by year. Only a strict, permitted set of title labels may appear beneath a
 * saint's name; everything else (Martyr, Virgin, Bishop, …) shows no label.
 */

import type { Translator } from "@/lib/i18n/translator";

/**
 * Canonical order of the foundational figures, by slug. The Admin Worker can
 * override per-saint with an explicit `orderRank`; this is the built-in
 * fallback for the well-known slugs.
 */
const FOUNDATIONAL_RANK: Record<string, number> = {
  mary: 0,
  "blessed-virgin-mary": 0,
  "the-blessed-virgin-mary": 0,
  "mary-mother-of-god": 0,
  joseph: 1,
  "saint-joseph": 1,
  "st-joseph": 1,
  "john-the-baptist": 2,
  "saint-john-the-baptist": 2,
  "st-john-the-baptist": 2,
  peter: 3,
  "saint-peter": 3,
  "st-peter": 3,
  "peter-the-apostle": 3,
  matthias: 50,
  "saint-matthias": 50,
  "st-matthias": 50,
  "matthias-the-apostle": 50,
  paul: 60,
  "saint-paul": 60,
  "st-paul": 60,
  "paul-the-apostle": 60,
  "paul-of-tarsus": 60,
};

/**
 * Sort rank for the foundational figures (lower = earlier). The remaining
 * Apostles cluster after Peter (10) and before Matthias/Paul. Returns null
 * for ordinary saints, who then sort purely by year.
 */
export function saintOrderRank(payload: Record<string, unknown>): number | null {
  if (typeof payload.orderRank === "number" && Number.isFinite(payload.orderRank)) {
    return payload.orderRank;
  }
  const slug = typeof payload.slug === "string" ? payload.slug.toLowerCase() : "";
  if (slug in FOUNDATIONAL_RANK) return FOUNDATIONAL_RANK[slug];
  if (payload.saintType === "apostle") return 10;
  return null;
}

const MONTHS = [
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

/**
 * Extracts a signed year from a free-form date string. Handles plain years,
 * full dates, circa, BC/AD/CE markers, "Nth century" (mapped to its
 * midpoint), and year ranges (the first year wins). Returns null when no
 * year can be read.
 */
export function parseYear(value: unknown): number | null {
  if (typeof value !== "string") return null;
  // Drop periods so "A.D."/"B.C." collapse to AD/BC, then collapse spaces.
  const norm = value.replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!norm) return null;

  const isBC = /\b(bc|bce)\b/i.test(norm);
  const sign = isBC ? -1 : 1;

  // A year range — the earliest (first) year wins, e.g. "100–44 BC" → -100.
  // For BC ranges the era marker sits beside the *later* year, so the
  // era-adjacent rule below would pick the wrong end; handle ranges first.
  // Guarded to BC so numeric dates like "10-01-1897" still fall to the
  // 4-digit-year rule below.
  if (isBC) {
    const range = norm.match(/(\d{1,4})\s*[–—-]\s*\d{1,4}/);
    if (range) return -Number(range[1]);
  }

  // "4th century", "3rd century BC" → midpoint of that century.
  const century = norm.match(/(\d{1,2})\s*(?:st|nd|rd|th)\s*century/i);
  if (century) return sign * ((Number(century[1]) - 1) * 100 + 50);

  // A year sitting right next to an era marker: "33 AD", "100 BC", "AD 33".
  const beforeMarker = norm.match(/(\d{1,4})\s*(?:ad|bce?|ce)\b/i);
  if (beforeMarker) return sign * Number(beforeMarker[1]);
  const afterMarker = norm.match(/\bad\s+(\d{1,4})/i);
  if (afterMarker) return sign * Number(afterMarker[1]);

  // Otherwise prefer a 4- then 3- then 1–2-digit run (skips day-of-month).
  const y4 = norm.match(/\d{4}/);
  if (y4) return sign * Number(y4[0]);
  const y3 = norm.match(/\d{3}/);
  if (y3) return sign * Number(y3[0]);
  const any = norm.match(/\d{1,2}/);
  if (any) return sign * Number(any[0]);
  return null;
}

/** Chronological sort key for a saint: death year, else birth, else canonization. */
export function saintSortYear(payload: Record<string, unknown>): number | null {
  return (
    parseYear(payload.deathDate) ??
    parseYear(payload.birthDate) ??
    parseYear(payload.canonizationDate) ??
    null
  );
}

/**
 * Comparator that orders saints. Foundational figures lead in their fixed
 * canonical order; everyone else follows from earliest to latest, with
 * undatable saints last and ties broken by title.
 */
export function compareSaintsChronologically(
  a: { title: string; payload: Record<string, unknown> },
  b: { title: string; payload: Record<string, unknown> },
): number {
  const ra = saintOrderRank(a.payload);
  const rb = saintOrderRank(b.payload);
  if (ra != null && rb != null && ra !== rb) return ra - rb;
  if (ra != null && rb == null) return -1; // foundational figures lead
  if (ra == null && rb != null) return 1;

  const ya = saintSortYear(a.payload);
  const yb = saintSortYear(b.payload);
  if (ya == null && yb == null) return a.title.localeCompare(b.title);
  if (ya == null) return 1;
  if (yb == null) return -1;
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
}

/**
 * The single title label permitted beneath a saint's name, or undefined when
 * none applies (spec — "Saint Titles"). A worker-provided `titleLabel` is
 * authoritative (e.g. "Mother of God", "Foster Father of Jesus", "Apostle of
 * Jesus and Disciple of Peter"); otherwise only Apostle, Doctor of the
 * Church, and a dated papal title are derived. Martyr, Virgin, Bishop, and
 * the like deliberately show no label.
 */
export function saintTitleLabel(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.titleLabel === "string" && payload.titleLabel.trim()) {
    return payload.titleLabel.trim();
  }
  const type = typeof payload.saintType === "string" ? payload.saintType : "";
  if (type === "apostle") return "Apostle and Disciple of Jesus";
  if (type === "doctor_of_the_church") return "Doctor of the Church";
  if (type === "pope") {
    const start = parseYear(payload.papacyStart);
    const end = parseYear(payload.papacyEnd);
    // Only the dated form is a permitted label; otherwise defer to titleLabel.
    if (start != null && end != null) return `Pope from ${start} to ${end}`;
  }
  return undefined;
}

/** Formats a stored "MM-DD" feast day as e.g. "July 25"; passes other text through. */
export function formatFeastDay(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const m = value.trim().match(/^(\d{2})-(\d{2})$/);
  if (!m) return value.trim() || undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return value.trim();
  return `${MONTHS[month - 1]} ${day}`;
}

/** Catalog eyebrow for a saint: "Doctor of the Church · Feast July 25". */
export function saintEyebrow(payload: Record<string, unknown>): string | undefined {
  const label = saintTitleLabel(payload);
  const feast = formatFeastDay(payload.feastDay);
  const parts = [label, feast ? `Feast ${feast}` : undefined].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : undefined;
}

/** What a saint's catalogue card shows beneath the name. */
export interface SaintCardDetails {
  /** Patronages in stored order, phrased to follow "Patron of" (may be empty). */
  patronages: string[];
  /** "June 29", or the stored prose of a movable feast; null when none is recorded. */
  feast: string | null;
}

/**
 * The saint fields the patronage and feast lines are read from — a full
 * payload, or the narrow JSON projection the /saints list queries.
 */
export interface SaintFactSource {
  patronages?: unknown;
  patronage?: unknown;
  feastDay?: unknown;
  feastMonth?: unknown;
  feastDayOfMonth?: unknown;
}

/**
 * The patronage and feast a saint's card and page show. Patronages in stored
 * order (the legacy single `patronage` string when there is no list); the feast
 * from the indexed month/day, or the stored text for a movable feast ("The
 * Tuesday after Pentecost"), which passes through as written.
 */
export function saintCardDetails(source: SaintFactSource): SaintCardDetails {
  const list = Array.isArray(source.patronages)
    ? source.patronages
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];
  const legacy = typeof source.patronage === "string" ? source.patronage.trim() : "";
  const patronages = list.length > 0 ? list : legacy ? [legacy] : [];

  const month = typeof source.feastMonth === "number" ? source.feastMonth : null;
  const day = typeof source.feastDayOfMonth === "number" ? source.feastDayOfMonth : null;
  const feast =
    month != null && day != null
      ? formatFeastDay(`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
      : formatFeastDay(source.feastDay);
  return { patronages, feast: feast ?? null };
}

const MONTH_NAME = new RegExp(`\\b(?:${MONTHS.join("|")})\\b`, "i");

/**
 * One end of a saint's life as a reader expects it: a year, "c. 1715" when the
 * record is approximate or gives a span ("302 or 303", "c. 700/703",
 * "1589-1590", "173?"), "4th century" kept as a century, "100 BC", "after 673".
 * Only what the record states: a day and month are dropped, never guessed, and
 * a value naming two people ("550 (Severinus); 543 (Victorinus)") or no year
 * at all gives null.
 */
function lifeYear(raw: unknown): { label: string; year: number | null } | null {
  if (typeof raw !== "string") return null;
  let s = raw
    .replace(/&nbsp;/gi, " ")
    .replace(/\([^)]*\)/g, " ") // "(aged 59)", "(traditional)"
    .replace(/^\s*[a-z]+=[a-z]+\s+/i, "") // stray wiki markup: "lk=no 360"
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s.includes(";")) return null;

  const bc = /\b(?:BCE?|B\.C\.(?:E\.)?)(?=\s|$)/i.test(s);
  let prefix = "";
  const qualifier = s.match(/^(after|before)\s+/i);
  if (qualifier) {
    prefix = `${qualifier[1]!.toLowerCase()} `;
    s = s.slice(qualifier[0].length);
  }
  let circa = false;
  const approx = s.match(/^(?:c\.|ca\.?|circa|about|approximately|approx\.?|~)\s*/i);
  if (approx) {
    circa = true;
    s = s.slice(approx[0].length);
  } else if (/^c\s*\d/i.test(s)) {
    circa = true;
    s = s.replace(/^c\s*/i, "");
  }
  // "173?", "649 or 650", "700/703", "unknown, 660": the record itself is unsure.
  if (/\?|\bor\b|\/|\bunknown\b/i.test(s)) circa = true;

  const century = s.match(/\b(\d{1,2})(st|nd|rd|th)\s+century\b/i);
  if (century) {
    return { label: `${prefix}${century[1]}${century[2]} century${bc ? " BC" : ""}`, year: null };
  }

  let year: number | null = null;
  const iso = s.match(/^(\d{1,4})-\d{2}-\d{2}\b/);
  if (iso) {
    year = Number(iso[1]);
  } else {
    const runs = [...s.matchAll(/\d{1,4}/g)].map((m) => m[0]);
    const numbers = runs.map(Number);
    if (numbers.length === 0) return null;
    if (MONTH_NAME.test(s)) {
      // "10 April 1028", "April 16, 1127", "580, traditionally 21 September":
      // the year is the first run long enough not to be a day of the month,
      // else ("5 March 33") the last number.
      const long = runs.find((r) => r.length >= 3);
      year = long ? Number(long) : numbers[numbers.length - 1]!;
      if (runs.filter((r) => r.length >= 3).length > 1) circa = true;
    } else {
      // "1589-1590", "302 or 303", "700/703": a span — its first year, approximately.
      year = numbers[0]!;
      if (numbers.length > 1) circa = true;
    }
  }
  if (!year) return null;
  const label = `${prefix}${circa ? "c. " : ""}${year}${bc ? " BC" : ""}`;
  return { label, year: bc ? -year : year };
}

/**
 * The dates a saint lived, for the line under the name: "1910 – 1946",
 * "c. 1715 – 1794", "Died 304", "Born 1962". Null when the record has neither
 * date, or when its dates contradict each other (a birth after the death) —
 * a wrong-looking fact is worse than a missing line.
 */
export function saintLifeDates(payload: Record<string, unknown>): string | null {
  const born = lifeYear(payload.birthDate);
  const died = lifeYear(payload.deathDate);
  if (born && died) {
    if (born.year != null && died.year != null && born.year > died.year) return null;
    return `${born.label} – ${died.label}`;
  }
  if (died) return `Died ${died.label}`;
  if (born) return `Born ${born.label}`;
  return null;
}

/** "Saint", "Blessed", "Venerable" or "Servant of God", from `canonizationStatus`. */
const STATUS_LABELS: Record<string, string> = {
  canonized: "Saint",
  beatified: "Blessed",
  venerable: "Venerable",
  servant_of_god: "Servant of God",
};

/**
 * The eyebrow over a saint's name on the saint's own page: the one permitted
 * title label (Apostle, Doctor of the Church, a dated papacy, a curated
 * `titleLabel`), else the stage of the cause ("Blessed", "Venerable"), so a
 * beatus is never introduced as a saint. The feast day is no longer folded in:
 * it has its own line under the name.
 */
export function saintDetailEyebrow(payload: Record<string, unknown>): string | undefined {
  const label = saintTitleLabel(payload);
  if (label) return label;
  const status =
    typeof payload.canonizationStatus === "string"
      ? payload.canonizationStatus.trim().toLowerCase()
      : "";
  return STATUS_LABELS[status];
}

/**
 * The lines a saint's catalogue card shows beneath the name, in order: the
 * patronage ("Patron of the papacy, fishermen, Rome"), then the feast day
 * ("Feast day: June 29"). A line is left out when that fact is not recorded.
 */
export function saintCardDetailLines(
  details: SaintCardDetails | undefined,
  t: Translator,
): string[] {
  if (!details) return [];
  const lines: string[] = [];
  if (details.patronages.length > 0) {
    lines.push(t("saints.card.patronOf", { patronages: details.patronages.join(", ") }));
  }
  if (details.feast) lines.push(`${t("saints.feastDay")}: ${details.feast}`);
  return lines;
}
