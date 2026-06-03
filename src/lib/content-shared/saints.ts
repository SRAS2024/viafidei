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
