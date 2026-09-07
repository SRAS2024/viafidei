/**
 * Pure parser for USCCB-style lectionary Scripture citations.
 *
 * Grammar (whitespace-tolerant):
 *
 *   citation    := prefix? alternative (" or " alternative)*
 *   prefix      := "See " | "cf. " | "Cf. "                 (stripped)
 *   alternative := reference (" and " reference)*           (a second BOOK joined by "and")
 *   reference   := group (";" group)*
 *   group       := [book] chapter [":" items]                (book inherited when absent)
 *               |  [book] chapter "—" chapter                (whole chapters)
 *               |  book items                                (single-chapter books: "Phlm 9-10, 12-17")
 *   items       := item (("," | "+" | " and ") item)*        ("+" is the catholic-resources.org join)
 *   item        := V[letters]                                (e.g. "16bc" → whole verse, partial)
 *               |  V[letters] "-" W[letters]                 (e.g. "3b-7")
 *               |  V[letters] dash CH2 ":" W[letters]        (chapter-crossing, e.g. "13—53:12")
 *   dash        := "—" | "–" | "-" | "‐" | "‑"               (hyphen allowed when the right side has a colon)
 *
 * A chapter-crossing range "CH:V—CH2:W" yields CH:V-(end), any whole chapters
 * in between, and CH2:1-W. After it, further items in the same group refer
 * to CH2 ("Nm 13:1-2, 25—14:1, 26-29a, 34-35"). Letter suffixes (a, b, c…)
 * mark partial verses: the WHOLE verse is included and `partial` is flagged.
 *
 * Esther's Greek additions (chapters A–F in the NAB) are accepted as chapter
 * letters for that book only. Anything unparseable returns null (never throws).
 */

import { type BookCode, findBook } from "./books";

export type EstherAddition = "A" | "B" | "C" | "D" | "E" | "F";

export interface VerseRange {
  from: number;
  /** Inclusive end verse; `null` means "through the end of the chapter". */
  to: number | null;
  /** True when the lectionary reads only part of a verse (letter suffix). */
  partial: boolean;
}

export interface CitationSegment {
  book: BookCode;
  chapter: number | EstherAddition;
  verses: VerseRange[] | "all";
}

export interface CitationAlternative {
  segments: CitationSegment[];
}

export interface ParsedCitation {
  raw: string;
  /** All alternatives; the first is the primary reading. */
  alternatives: CitationAlternative[];
}

const PREFIX_RE = /^(?:see|cf\.?)\s+/i;
const DASH = "[-‐‑–—]";
const BOOK_START =
  "(?:[1-3]\\s+|I{1,3}\\s+)?[A-Za-z][A-Za-z.]*(?:\\s+[A-Za-z][A-Za-z.]*)*\\s+(?=\\d|[A-F]:)";
const BOOK_RE = new RegExp(
  `^(?:([1-3]|I{1,3})\\s+)?([A-Za-z][A-Za-z.]*(?:\\s+[A-Za-z][A-Za-z.]*)*)\\s+(?=\\d|[A-F]:)`,
);
/** " and " followed by something that starts like a book reference ("and 2 Cor 5:20—6:2"). */
const AND_BOOK_RE = new RegExp(`\\s+and\\s+(?=${BOOK_START})`);
/** Books of a single chapter, cited without a chapter number ("Jude 17, 20b-25"). */
const SINGLE_CHAPTER: ReadonlySet<BookCode> = new Set<BookCode>([
  "OBA",
  "PHM",
  "2JN",
  "3JN",
  "JUD",
]);
const CHAPTER_RE = new RegExp(`^(\\d+|[A-F])(?:\\s*${DASH}\\s*(\\d+))?(?:\\s*:\\s*(.+))?$`);
const ITEM_RE = new RegExp(
  `^(\\d+)([a-h]*)(?:\\s*${DASH}\\s*(?:(\\d+)\\s*:\\s*)?(\\d+)([a-h]*))?$`,
);

function parseChapterToken(token: string, book: BookCode): number | EstherAddition | null {
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return n > 0 ? n : null;
  }
  if (book === "EST" && /^[A-F]$/.test(token)) return token as EstherAddition;
  return null;
}

/**
 * Parse one ";"-separated group into segments. `book` is the book in force
 * when the group names none. Returns null on any syntax error.
 */
function parseGroup(
  groupText: string,
  book: BookCode | null,
): { book: BookCode; segments: CitationSegment[] } | null {
  let text = groupText.trim();
  let current = book;
  const bookMatch = text.match(BOOK_RE);
  if (bookMatch) {
    const token = `${bookMatch[1] ? `${bookMatch[1]} ` : ""}${bookMatch[2]}`;
    const info = findBook(token);
    if (!info) return null;
    current = info.code;
    text = text.slice(bookMatch[0].length).trim();
  }
  if (!current) return null;
  if (SINGLE_CHAPTER.has(current) && !text.includes(":")) text = `1:${text}`;

  const chapterMatch = text.match(CHAPTER_RE);
  if (!chapterMatch) return null;
  const chapter = parseChapterToken(chapterMatch[1], current);
  if (chapter === null) return null;

  // "Jn 18—19" — whole chapters spanning a range.
  if (chapterMatch[2] !== undefined) {
    if (chapterMatch[3] !== undefined || typeof chapter !== "number") return null;
    const last = Number(chapterMatch[2]);
    if (!(last > chapter)) return null;
    const segments: CitationSegment[] = [];
    for (let c = chapter; c <= last; c++)
      segments.push({ book: current, chapter: c, verses: "all" });
    return { book: current, segments };
  }

  // "Rom 5" — a whole chapter.
  if (chapterMatch[3] === undefined) {
    return { book: current, segments: [{ book: current, chapter, verses: "all" }] };
  }

  const segments: CitationSegment[] = [];
  let activeChapter: number | EstherAddition = chapter;
  let activeRanges: VerseRange[] = [];
  const flush = () => {
    if (activeRanges.length > 0) {
      segments.push({ book: current as BookCode, chapter: activeChapter, verses: activeRanges });
    }
    activeRanges = [];
  };

  const items = chapterMatch[3]
    .split(/\s*[,+]\s*|\s+and\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (items.length === 0) return null;

  for (const item of items) {
    const m = item.match(ITEM_RE);
    if (!m) return null;
    const from = Number(m[1]);
    if (!(from > 0)) return null;
    const partial = m[2].length > 0 || (m[5] !== undefined && m[5].length > 0);
    if (m[4] === undefined) {
      activeRanges.push({ from, to: from, partial });
      continue;
    }
    const to = Number(m[4]);
    if (m[3] === undefined) {
      if (to < from) return null;
      activeRanges.push({ from, to, partial });
      continue;
    }
    // Chapter-crossing range: V—CH2:W.
    if (typeof activeChapter !== "number") return null;
    const nextChapter = Number(m[3]);
    if (!(nextChapter > activeChapter) || !(to > 0)) return null;
    activeRanges.push({ from, to: null, partial });
    flush();
    for (let c = activeChapter + 1; c < nextChapter; c++) {
      segments.push({ book: current, chapter: c, verses: "all" });
    }
    activeChapter = nextChapter;
    activeRanges.push({ from: 1, to, partial });
  }
  flush();
  return { book: current, segments };
}

/** Parse a lectionary citation; null when it cannot be parsed. */
export function parseCitation(citation: string): ParsedCitation | null {
  if (typeof citation !== "string") return null;
  const raw = citation;
  const text = citation
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(PREFIX_RE, "");
  if (text.length === 0) return null;

  const alternatives: CitationAlternative[] = [];
  let book: BookCode | null = null;
  for (const altText of text.split(/\s+or\s+/)) {
    const segments: CitationSegment[] = [];
    for (const referenceText of altText.split(AND_BOOK_RE)) {
      for (const groupText of referenceText.split(";")) {
        const group = parseGroup(groupText, book);
        if (!group) return null;
        book = group.book;
        segments.push(...group.segments);
      }
    }
    if (segments.length === 0) return null;
    alternatives.push({ segments });
  }
  return { raw, alternatives };
}
