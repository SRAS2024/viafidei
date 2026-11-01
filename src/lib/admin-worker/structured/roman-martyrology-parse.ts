/**
 * Parser for the OCR text of The Roman Martyrology, English edition of 1916
 * (Baltimore: John Murphy Company; "last edition, according to the copy
 * printed at Rome in 1914"). Public domain: published in the United States in
 * 1916, and marked NOT_IN_COPYRIGHT by the Internet Archive, whose scan
 * `romanmartyrology00cathuoft` this OCR is.
 *
 * The book reads one DAY at a time ("The First Day of January"), each day a
 * run of announcements separated by em dashes ("At Rome, St. Almachius,
 * martyr, … — In the same city, …"). This module turns the OCR into
 * `{ "MM-DD": [announcement, …] }`. It is pure and offline: the committed
 * index (`data/roman-martyrology-1916.json`) is built from the OCR by
 * `scripts/booster/build-roman-martyrology.ts`, and the ingest only ever reads
 * that index.
 *
 * WHY IT VALIDATES EVERY MONTH. The day headings are set in blackletter, and
 * the OCR reads them as noise ("Cfte Ctoemietft Dap of", "Cfie jQttttJ) Dap
 * of 3[anuarg*"): the ordinal cannot be read, only that a heading is there.
 * Days are therefore numbered by COUNTING headings inside a month, and one
 * heading the OCR lost would shift every later day of that month by one — a
 * saint would be filed under his neighbour's day, and the feast check built on
 * this index would corroborate the wrong date. So a month's headings must
 * number exactly the days of that month. Where a heading was lost entirely
 * (the OCR has two such days, 11 and 28 March), the day still begins with the
 * book's two-line drop capital ("A  T  Carthage" / "^  mus.— At Alexandria"),
 * and those starts fill the gap — but only when they number exactly the
 * missing days. A month that still does not add up is left out of the index
 * and reported, never guessed: an absent day only means the Martyrology is
 * silent, which the ingest treats as "no corroboration".
 */

/** The book's months, as its running headers print them. */
const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

/**
 * Days per month in the Martyrology. February has 28: the book gives the leap
 * day no reading of its own (its note under 24 February moves St Matthias).
 */
export const MARTYROLOGY_MONTH_DAYS: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

const MONTH_ALT = MONTHS.join("|");
/** A month standing alone on its line: a month's title, or a running header. */
const MONTH_LINE_RE = new RegExp(`^\\s*(${MONTH_ALT})\\.?\\s*$`);
/** A running page header: "160  JUNE." / "JUNE.  161" / "JUNE." */
const PAGE_HEADER_RE = new RegExp(
  `^\\s*(?:\\d{1,3}\\s+)?(?:${MONTH_ALT})\\.?\\s*(?:\\d{1,3})?\\s*$`,
);
/**
 * A day heading as the OCR reads the blackletter: "Day of" comes out as "Dap
 * of", "Dag of", "Da? of", "3Dap of", "Dag oJ", "Dap offlDcto&er" — the one
 * part of the line that survives.
 */
const DAY_HEADING_RE = /(?:^|[\s3])Da[gpyv?]\S{0,2}\s+o\S/;
/**
 * The first line of a day's first announcement, set under a two-line drop
 * capital: "A  T  Carthage", "T.  JOHN  of  Capistran", "TN  Persia".
 */
const DROP_CAP_RE = /^\s*(?:[A-Z][^a-z\s]{0,2}\s+){1,2}[A-Z]|^\s*[a-z]?[A-Z]{2,}\s/;
/** The drop capital's second line, which the OCR starts with debris ("^  mus."). */
const DROP_CAP_DEBRIS_RE = /^\s*[•^*]/;
/** Debris the drop capital leaves at the start of a day's first lines. */
const LEADING_DEBRIS_RE = /^[\s•^*"'■|]+(?=[A-Za-z])/;

export interface ParsedMartyrology {
  /** "MM-DD" → that day's announcements, in the book's order. */
  days: Record<string, string[]>;
  /** Months left out because their days could not be counted, and why. */
  problems: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isBlank(line: string | undefined): boolean {
  return line === undefined || line.trim() === "";
}

/**
 * A line of OCR debris: no letters at all (a page number, a signature mark),
 * or a few characters carrying symbols no sentence of the book contains
 * ("C£v  ::" — the lost heading of 11 March).
 */
function isDebrisLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (!/[A-Za-z]/.test(t)) return true;
  return t.length <= 8 && /[£€:;*•^|{}[\]<>~=+#]/.test(t);
}

function isDayHeading(lines: readonly string[], i: number): boolean {
  const line = lines[i];
  if (line.trim().length > 70 || !DAY_HEADING_RE.test(line)) return false;
  return isBlank(lines[i - 1]) && isBlank(lines[i + 1]);
}

/** Index of the previous line that carries text (skips blanks, headers, debris). */
function previousTextLine(lines: readonly string[], i: number, floor: number): number {
  for (let j = i - 1; j >= floor; j -= 1) {
    const l = lines[j];
    if (isBlank(l) || PAGE_HEADER_RE.test(l) || isDebrisLine(l)) continue;
    return j;
  }
  return -1;
}

/**
 * A day whose heading the OCR lost: a drop-capital line after a blank line,
 * where the previous day has just ended on a full stop or the drop capital's
 * debris follows on the next line.
 */
function isDropCapStart(
  lines: readonly string[],
  i: number,
  headings: ReadonlySet<number>,
  floor: number,
): boolean {
  if (!isBlank(lines[i - 1]) || !DROP_CAP_RE.test(lines[i])) return false;
  const prev = previousTextLine(lines, i, floor);
  if (prev < 0 || headings.has(prev)) return false;
  const endedSentence = /[.!?]["')\]]*\s*$/.test(lines[prev]);
  return endedSentence || DROP_CAP_DEBRIS_RE.test(lines[i + 1] ?? "");
}

/** Join a day's lines into running text: page furniture out, hyphenation mended. */
function dayText(lines: readonly string[]): string {
  const kept: string[] = [];
  let inFootnote = false;
  let textLines = 0;
  for (const raw of lines) {
    if (isBlank(raw)) {
      inFootnote = false;
      continue;
    }
    if (inFootnote || PAGE_HEADER_RE.test(raw) || isDebrisLine(raw)) continue;
    let line = raw;
    if (textLines < 3) {
      // The drop capital's debris on the day's first lines ("•^  suffered").
      line = line.replace(LEADING_DEBRIS_RE, "");
    } else if (/^\s*\*/.test(line)) {
      // A footnote at the foot of a page ("*In the language of the Church,
      // birthday refers to …"): dropped up to the next blank line.
      inFootnote = true;
      continue;
    }
    textLines += 1;
    kept.push(line.trim());
  }
  let text = "";
  for (const line of kept) {
    if (!text) {
      text = line;
    } else if (/[A-Za-z]-$/.test(text) && /^[a-z]/.test(line)) {
      // "Csesa-" + "rea," — a word broken at the line end.
      text = text.slice(0, -1) + line;
    } else {
      text = `${text} ${line}`;
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

/** The closing formula and rubrics, which are not announcements. */
const FORMULA_RE =
  /^(?:and in other places,? many other holy|answer\b|thanks be to god|n\.\s*b\.|the reading of the martyrology is always)/i;

/** Split a day's running text into its announcements. */
export function splitAnnouncements(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/\s*—\s*/)) {
    const entry = part
      // A footnote mark on a word ("birthday*").
      .replace(/([A-Za-z])\*+/g, "$1")
      // Scanner debris at the start of an announcement ("• The same day").
      .replace(/^[\s•^■|*]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (entry.length < 3 || FORMULA_RE.test(entry)) continue;
    out.push(entry);
  }
  return out;
}

/**
 * Parse the OCR of the 1916 Martyrology into day-indexed announcements.
 *
 * The body runs from the first month title after the title page ("ARRANGED
 * FOR EVERY DAY IN THE YEAR") to the book's INDEX. Text outside that span
 * (introduction, movable feasts, the index itself) is never read. Months are
 * opened by their title line ("FEBRUARY.") naming the NEXT month — a running
 * header that lost its page number names the current one and is ignored.
 *
 * `monthDays` overrides how many days a month must have (1-based month →
 * days): only for parsing an excerpt of the book in a test.
 */
export function parseMartyrologyOcr(
  ocr: string,
  opts: { monthDays?: Readonly<Record<number, number>> } = {},
): ParsedMartyrology {
  const lines = ocr.split(/\r?\n/);
  const titleAt = lines.findIndex((l) => /ARRANGED\s+FOR\s+EVERY\s+DAY/i.test(l));
  const from = titleAt >= 0 ? titleAt + 1 : 0;
  let to = lines.findIndex((l, i) => i > from && l.trim() === "INDEX.");
  if (to < 0) to = lines.length;

  // Month spans [start, end) by their title lines, in order: the first title
  // opens its month, and each later one must name the month after.
  const monthStart: Array<{ month: number; line: number }> = [];
  for (let i = from; i < to; i += 1) {
    const m = MONTH_LINE_RE.exec(lines[i]);
    if (!m) continue;
    const month = MONTHS.indexOf(m[1] as (typeof MONTHS)[number]);
    const next = monthStart.length === 0 ? month : monthStart[monthStart.length - 1].month + 1;
    if (month === next) monthStart.push({ month, line: i });
  }

  const days: Record<string, string[]> = {};
  const problems: string[] = [];
  if (monthStart.length < 12) {
    problems.push(`found ${monthStart.length} of 12 month titles`);
  }
  for (let k = 0; k < monthStart.length; k += 1) {
    const { month, line: start } = monthStart[k];
    const end = k + 1 < monthStart.length ? monthStart[k + 1].line : to;
    const headingList: number[] = [];
    for (let i = start + 1; i < end; i += 1) if (isDayHeading(lines, i)) headingList.push(i);
    const headings = new Set(headingList);
    const want = opts.monthDays?.[month + 1] ?? MARTYROLOGY_MONTH_DAYS[month];
    let starts = headingList;
    let fromHeading = new Set(headingList);
    if (headingList.length < want && headingList.length > 0) {
      const dropCaps: number[] = [];
      for (let i = headingList[0] + 1; i < end; i += 1) {
        if (!headings.has(i) && isDropCapStart(lines, i, headings, start)) dropCaps.push(i);
      }
      if (headingList.length + dropCaps.length === want) {
        starts = [...headingList, ...dropCaps].sort((a, b) => a - b);
        fromHeading = headings;
      }
    }
    if (starts.length !== want) {
      problems.push(
        `${MONTHS[month]}: ${starts.length} day starts for ${want} days — month left out`,
      );
      continue;
    }
    for (let d = 0; d < starts.length; d += 1) {
      // A heading line is not text; a recovered drop-capital line is.
      const first = fromHeading.has(starts[d]) ? starts[d] + 1 : starts[d];
      const last = d + 1 < starts.length ? starts[d + 1] : end;
      const entries = splitAnnouncements(dayText(lines.slice(first, last)));
      days[`${pad2(month + 1)}-${pad2(d + 1)}`] = entries;
    }
  }
  return { days, problems };
}
