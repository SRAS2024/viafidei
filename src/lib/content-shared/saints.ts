/**
 * Saint ordering and labelling (spec — "Saints chronological ordering and
 * strict title labels").
 *
 * Saints are listed in the order they lived (earliest first), so the
 * Apostles and early martyrs come before modern saints. Each saint also
 * carries a strict title label derived from its canonical type (Apostle,
 * Martyr, Doctor of the Church, …).
 */

/** Strict title label for each saint type. "other" has no label. */
export const SAINT_TYPE_LABELS: Record<string, string> = {
  apostle: "Apostle",
  evangelist: "Evangelist",
  martyr: "Martyr",
  doctor_of_the_church: "Doctor of the Church",
  pope: "Pope",
  bishop: "Bishop",
  virgin: "Virgin",
  confessor: "Confessor",
  religious: "Religious",
  founder: "Founder",
  missionary: "Missionary",
  lay: "Lay Faithful",
  other: "",
};

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
 * Comparator that orders saints from earliest to latest. Saints with no
 * datable year sort last; ties (and undatable saints) fall back to title.
 */
export function compareSaintsChronologically(
  a: { title: string; payload: Record<string, unknown> },
  b: { title: string; payload: Record<string, unknown> },
): number {
  const ya = saintSortYear(a.payload);
  const yb = saintSortYear(b.payload);
  if (ya == null && yb == null) return a.title.localeCompare(b.title);
  if (ya == null) return 1;
  if (yb == null) return -1;
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
}

/** Strict title label for a saint, or undefined when none applies. */
export function saintTitleLabel(payload: Record<string, unknown>): string | undefined {
  const type = payload.saintType;
  if (typeof type !== "string") return undefined;
  return SAINT_TYPE_LABELS[type] || undefined;
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
