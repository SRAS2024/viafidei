/**
 * The Church-history timeline's static spine.
 *
 * Historical facts are fixed, so they ship in the repository as a typed,
 * tested dataset read directly at render time — never gated behind the
 * worker's publish pipeline. Published CHURCH_DOCUMENT rows enrich and link
 * this spine (a council's document page, an encyclical's text); they are not
 * the spine. Accuracy rules: only well-established facts; an approximate date
 * carries `precision: "circa"` and renders as "c. 33"; a year-only fact
 * carries `precision: "year"`; a day is stored only when the exact day is
 * well attested. Every event cites one authoritative page.
 */

export type HistoryEra =
  | "apostolic"
  | "persecution"
  | "fathers"
  | "early-medieval"
  | "high-medieval"
  | "schism-renaissance"
  | "reformation-trent"
  | "early-modern"
  | "revolution-19c"
  | "twentieth"
  | "post-conciliar";

export type HistoryKind =
  | "event"
  | "council"
  | "document"
  | "martyrdom"
  | "saint"
  | "pope"
  | "order"
  | "apparition"
  | "mission"
  | "schism";

export type DatePrecision = "day" | "year" | "circa";

export interface ChurchHistoryEvent {
  slug: string;
  title: string;
  /** Sort/slider year (AD). */
  year: number;
  /** ISO YYYY-MM-DD, present only when precision is "day". */
  date?: string;
  precision: DatePrecision;
  era: HistoryEra;
  kind: HistoryKind;
  /** e.g. ["schism", "reform", "marian", "dogma", "crusade"] */
  tags?: string[];
  location?: string;
  /** What happened, one or two sentences. */
  context: string;
  /** Why it matters, one or two sentences. */
  significance: string;
  /** One authoritative URL (en.wikipedia.org, vatican.va, newadvent.org). */
  citation: string;
  links?: {
    /** A published CHURCH_DOCUMENT slug (council or document page). */
    documentSlug?: string;
    popes?: string[];
    saints?: string[];
    doctors?: string[];
    apparitions?: string[];
  };
}

export const HISTORY_ERAS: ReadonlyArray<{
  key: HistoryEra;
  label: string;
  from: number;
  to: number;
}> = [
  { key: "apostolic", label: "Apostolic Age", from: 30, to: 100 },
  { key: "persecution", label: "Persecutions & Martyrs", from: 100, to: 313 },
  { key: "fathers", label: "Fathers & First Councils", from: 313, to: 590 },
  { key: "early-medieval", label: "Early Middle Ages", from: 590, to: 1054 },
  { key: "high-medieval", label: "High Middle Ages", from: 1054, to: 1378 },
  { key: "schism-renaissance", label: "Western Schism & Renaissance", from: 1378, to: 1517 },
  { key: "reformation-trent", label: "Reformation & Trent", from: 1517, to: 1648 },
  { key: "early-modern", label: "Missions & Enlightenment", from: 1648, to: 1789 },
  { key: "revolution-19c", label: "Revolution to Vatican I", from: 1789, to: 1914 },
  { key: "twentieth", label: "Twentieth Century", from: 1914, to: 1965 },
  { key: "post-conciliar", label: "Post-Conciliar Church", from: 1965, to: 9999 },
];

export function eraForYear(year: number): HistoryEra {
  for (const era of HISTORY_ERAS) {
    if (year < era.to) return era.key;
  }
  return "post-conciliar";
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

/** "20 May 325" | "325" | "c. 33" */
export function formatHistoryDate(e: {
  date?: string;
  year: number;
  precision: DatePrecision;
}): string {
  if (e.precision === "circa") return `c. ${e.year}`;
  if (e.precision === "day" && e.date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date);
    if (m) {
      const month = MONTHS[Number(m[2]) - 1];
      if (month) return `${Number(m[3])} ${month} ${Number(m[1])}`;
    }
  }
  return String(e.year);
}

/** Chronological key: circa dates sort before dated events of the same year. */
export function historySortKey(e: { date?: string; year: number; precision: DatePrecision }): string {
  const y = String(e.year).padStart(4, "0");
  if (e.precision === "day" && e.date) return `${y}-${e.date.slice(5)}`;
  return `${y}-${e.precision === "circa" ? "00-00" : "00-01"}`;
}
