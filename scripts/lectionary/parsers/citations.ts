/**
 * Citation normaliser shared by the three lectionary sources.
 *
 * Every source writes Scripture references its own way — catholic-resources
 * ("Isa 2:1-5", "Ps 97:1+2b, 6+7c, 9", "Matt 26:14 – 27:66", editorial notes
 * in parentheses), the USCCB readings pages ("Is 2:1-5", "Genesis 1:1—2:2",
 * "JUDITH 13:18BCDE, 19", a psalm with no book: "95:1-2, 6-7") and the USCCB
 * calendar ("Is 4:2-6 (second choice)"). `normaliseCitation` folds them onto
 * ONE canonical form — the USCCB abbreviation of books.ts, ", " between
 * items, " and " for a joined verse pair, "—" for a chapter crossing, " or "
 * between alternatives, an optional "cf. " prefix — and PROVES the result
 * parses with bible/citation.ts. A citation that does not parse is returned
 * as null so the build can report it rather than commit it.
 */

import { parseCitation } from "../../../src/lib/content-shared/bible/citation";
import { findBook, bookByCode } from "../../../src/lib/content-shared/bible/books";

const BOOK_TOKEN_RE =
  /^(?:([1-3]|I{1,3})\s+)?([A-Za-z][A-Za-z./]*(?:\s+[A-Za-z][A-Za-z.]*)*)\s+(?=\d|[A-F]:)/;

/**
 * Abbreviations the sources use that books.ts does not know: the 1998/2002
 * catholic-resources tables keep several older Latinate forms ("Hebr", "Zac",
 * "1 Petr"), spell Ecclesiastes with both its names at once ("Eccl/Qoh"), and
 * write Acts and Esther without their final letter.
 */
const SOURCE_BOOK_ALIASES: Record<string, string> = {
  act: "Acts",
  cant: "Sg",
  canticle: "Sg",
  "canticle of canticles": "Sg",
  eccl_qoh: "Eccl",
  esth: "Est",
  hebr: "Heb",
  petr: "1 Pt",
  "1 petr": "1 Pt",
  "2 petr": "2 Pt",
  sgs: "Sg",
  songs: "Sg",
  zac: "Zec",
};

/** Canonical USCCB-style abbreviation of a book (its first alias, else its name). */
export function canonicalBookAbbreviation(token: string): string | null {
  const cleaned = token
    .replace(/\s*\/\s*/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const aliased = SOURCE_BOOK_ALIASES[cleaned.toLowerCase()] ?? cleaned.replace(/_/g, "/");
  const info = findBook(aliased);
  if (!info) return null;
  // The first abbreviation is the USCCB form ("Gn", "Eccl", "Sg"), except where
  // books.ts lists a LONGER alias than the name itself ("Acts of the Apostles").
  const book = bookByCode(info.code);
  const abbreviation = book.abbreviations[0] ?? book.name;
  return abbreviation.length <= book.name.length ? abbreviation : book.name;
}

/** Placeholders the sources use for "no citation" cells. */
const EMPTY_RE =
  /^(?:x|_|\.|-|—|–|[([]?\s*no bibl\.?\s*ref\.?\s*[)\]]?|\[o antiphons\]|\[see te deum\]|see the sunday lectionary|\(see the sunday lectionary\)|\(see #[^)]*\)|see #.*|\[see .*\]|\(see .*\))$/i;

export function isEmptyCitationCell(text: string): boolean {
  const t = text.trim();
  return t.length === 0 || EMPTY_RE.test(t);
}

/**
 * Strip the editorial apparatus of the source cells: "(diff)", "(new)",
 * "(#722.8)", "(cited in Lk 4:18)", "opt:", "*", "†", bracketed remarks,
 * "SEQUENCE: … Alleluia:" preambles, " - Vg (diff) = X - Gk" variants (keep
 * the Greek/NAB numbering the USCCB uses), and a Gospel's pericope title
 * ("Matt 4:1-11 – Temptation").
 */
export function stripAnnotations(text: string): string {
  let t = text.replace(/\u00a0/g, " ");
  // "Sir 3:3-7, 14-17a - Vg (diff) = Sir 3:2-6, 12-14 - Gk" → the "= …" side.
  const vg = t.match(/=\s*([^=]+?)\s*-\s*Gk\b/);
  if (vg) t = vg[1];
  // "SEQUENCE: Victimae paschali laudes Alleluia: cf. 1 Cor 5:7b-8a" → after "Alleluia:".
  const seq = t.match(/alleluia:\s*(.*)$/i);
  if (seq) t = seq[1];
  t = t
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(?:opt|option|optional)\s*\.?\s*:/gi, " ")
    // "#722.8" / "#715.4)" — the Lectionary number of a text taken from a Common.
    .replace(/#\s*\d[\d.]*\)?/g, " ")
    // Whatever brackets the strips above left unbalanced.
    .replace(/[()[\]]/g, " ")
    .replace(/[*†‡]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // "or, in Year A, Matt 14:22-36" — the cycle note belongs to the alternative,
  // not to the citation; the cycle is carried by the entry itself.
  t = t.replace(/\bor\s*,?\s*in\s+(?:year|yr)\.?\s+[ABC]\s*,?\s*/gi, " or ");
  // A pericope title after a spaced dash: "Matt 4:1-11 – Temptation",
  // "John 4:5-42 – Samaritan Woman or 4:5-15, …". Titles are words only.
  t = t.replace(/\s+[–—-]\s+[A-Z][A-Za-z'’]*(?:\s+[&A-Za-z][A-Za-z'’]*)*(?=\s+or\s|$)/gu, " ");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Split a cell that gives one citation per Sunday cycle — "A: Matt 17:1-9 B: …"
 * or "Gospels for Years A, B, C: A) Matt 28:1-10 B) Mark 16:1-7 C) Luke 24:1-12".
 */
export function splitByCycle(text: string): Array<{ cycle: "A" | "B" | "C" | null; text: string }> {
  const body = text.replace(
    /^\s*(?:gospels?|readings?)\s+for\s+years?\s+a,?\s*b,?\s*(?:and\s+)?c\s*:\s*/i,
    "",
  );
  const m = body.match(/^\s*A[:)]\s*(.+?)\s+B[:)]\s*(.+?)\s+C[:)]\s*(.+?)\s*$/);
  if (!m) return [{ cycle: null, text }];
  return [
    { cycle: "A", text: m[1] },
    { cycle: "B", text: m[2] },
    { cycle: "C", text: m[3] },
  ];
}

const PREFIX_RE = /^(?:see|cf\.?)\s+/i;

/**
 * "127-28" abbreviates "127-128" in the printed tables. Expand a range whose
 * end is shorter than, and below, its start by borrowing the start's leading
 * digits — never the other way round, so a real descending range still fails.
 */
function expandAbbreviatedRanges(refs: string): string {
  return refs.replace(
    /(\d+)([a-f]*)-(\d+)([a-f]*)/g,
    (whole, from: string, fromPart: string, to: string, toPart: string) => {
      if (to.length >= from.length || Number(to) >= Number(from)) return whole;
      const expanded = from.slice(0, from.length - to.length) + to;
      return Number(expanded) > Number(from) ? `${from}${fromPart}-${expanded}${toPart}` : whole;
    },
  );
}

function normaliseGroup(
  group: string,
  inheritedBook: string | null,
  previousChapter: string | null,
): { text: string; book: string | null; chapter: string | null; hasBook: boolean } | null {
  let g = group.trim();
  let book = inheritedBook;
  const m = g.match(BOOK_TOKEN_RE);
  if (m) {
    const token = `${m[1] ? `${m[1]} ` : ""}${m[2]}`;
    const canonical = canonicalBookAbbreviation(token);
    if (!canonical) return null;
    book = canonical;
    g = g.slice(m[0].length).trim();
  } else if (/^[A-Za-z]/.test(g)) {
    // Starts with letters but is not a recognisable book token.
    return null;
  }
  // Esther's Greek additions are lettered chapters ("Est C:12"); every OTHER
  // letter in a reference is a verse part and is lower-cased ("18BCDE" → "18bcde").
  const estherChapter = /^[A-F]\s*:/.test(g) ? g[0] : null;
  let refs = (estherChapter ? g.replace(/^[A-F]\s*:\s*/, "") : g)
    .toLowerCase()
    .replace(/\s+/g, " ")
    // "51:12 cd-20" — a space between a verse and its part.
    .replace(/(\d)\s+(?=[a-f]+\b)/g, "$1")
    // "&" is the USCCB pages' other joiner for split verses ("78:3 & 4bc").
    .replace(/\s*&\s*/g, " and ")
    // "20:17-18a. 28-32" — a full stop where the table meant a comma.
    .replace(/\.\s+(?=\d)/g, ", ")
    .replace(/,\s*\+\s*/g, " and ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\+\s*/g, " and ")
    .replace(/,\s+and\s+/g, " and ")
    .replace(/\s*:\s*/g, ":");
  // Chapter crossing "26:14 – 27:66" / "5:20-6:2" → "26:14—27:66".
  refs = refs.replace(/(\d+[a-f]*)\s*[-‐‑–—]\s*(\d+):/g, "$1—$2:");
  // Plain verse ranges "3-4", "12 – 13" → "3-4". The lookahead keeps the rule
  // off a chapter crossing the previous line has already joined ("14—27:66"):
  // without it the range would swallow "27" one digit at a time.
  refs = refs.replace(/(\d+[a-f]*)\s*[‐‑–—-]\s*(\d+[a-f]*)(?![\d:])/g, "$1-$2");
  refs = expandAbbreviatedRanges(refs);
  refs = refs
    .replace(/\s+and\s+/g, " and ")
    .replace(/[,;]\s*$/, "")
    .trim();
  if (refs.length === 0) return null;
  if (estherChapter) {
    return {
      text: `${m ? `${book} ` : ""}${estherChapter}:${refs}`,
      book,
      chapter: estherChapter,
      hasBook: Boolean(m),
    };
  }
  // A ";" group that names verse parts but no chapter ("Rev 11:19a; 12:1-6a; 10ab")
  // is a mis-punctuated continuation of the previous chapter, not a new one.
  if (!refs.includes(":") && /^\d+[a-f]/.test(refs) && previousChapter) {
    return { text: `${previousChapter}:${refs}`, book, chapter: previousChapter, hasBook: false };
  }
  const chapterMatch = refs.match(/^(\d+)\s*:/);
  return {
    text: m ? `${book} ${refs}` : refs,
    book,
    chapter: chapterMatch ? chapterMatch[1] : previousChapter,
    hasBook: Boolean(m),
  };
}

/**
 * Normalise one citation cell (already stripped of annotations). Returns the
 * canonical string, or null when it cannot be made to parse.
 */
export function normaliseCitation(raw: string, opts?: { assumePsalm?: boolean }): string | null {
  let text = raw
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0) return null;
  let prefix = "";
  const p = text.match(PREFIX_RE);
  if (p) {
    prefix = "cf. ";
    text = text.slice(p[0].length);
  }
  // Responsorial psalms sometimes omit the book ("95:1-2, 6-7, 8-9").
  if (opts?.assumePsalm && /^\d+:/.test(text)) text = `Ps ${text}`;

  const alternatives: string[] = [];
  let book: string | null = null;
  let chapter: string | null = null;
  text = text
    // "Col1:1-8", "Mt13:47-53" — a missing space between book and chapter.
    .replace(/^((?:[1-3]\s*)?[A-Za-z][A-Za-z.]+)(\d)/, "$1 $2")
    // "Jn 16:13a, 14:26d" — a comma where the Lectionary prints a ";".
    .replace(/,\s*(?=\d+\s*:)/g, "; ");
  for (const alt of text.split(/\s+or\s+/i)) {
    // "… or the reading from Year A" — prose, not a reference. The cycle-specific
    // alternative is filed under its own cycle, so drop the pointer.
    if (!/\d/.test(alt) || /\b(?:year|yr)\.?\s+[abc]\b/i.test(alt)) continue;
    const parts: string[] = [];
    let failed = false;
    let namedBook = false;
    for (const ref of alt.split(
      /\s+and\s+(?=(?:[1-3]\s+|I{1,3}\s+)?[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)*\s+(?:\d|[A-F]:))/,
    )) {
      const groups: string[] = [];
      for (const group of ref.split(";")) {
        if (group.trim().length === 0) continue;
        const g = normaliseGroup(group, book, chapter);
        if (!g) {
          failed = true;
          break;
        }
        book = g.book;
        chapter = g.chapter;
        namedBook = namedBook || g.hasBook;
        groups.push(g.text);
      }
      if (failed) break;
      parts.push(groups.join("; "));
    }
    if (failed) return null;
    // Repeat the book in every alternative ("Jn 9:1-41 or Jn 9:1, 6-9, …"): the
    // sources are inconsistent about it, and a bare alternative reads as if it
    // continued the previous book only by convention.
    const joined = parts.join(" and ");
    alternatives.push(alternatives.length > 0 && book && !namedBook ? `${book} ${joined}` : joined);
  }
  if (alternatives.length === 0) return null;
  const result = `${prefix}${alternatives.join(" or ")}`;
  return parseCitation(result) ? result : null;
}

/**
 * One source cell → canonical citations (several when the cell lists the
 * Sunday cycles separately). `unparsed` collects what could not be normalised
 * so the build prints it.
 */
export function normaliseCell(
  cell: string,
  opts?: { assumePsalm?: boolean },
): { citations: Array<{ cycle: "A" | "B" | "C" | null; citation: string }>; unparsed: string[] } {
  const citations: Array<{ cycle: "A" | "B" | "C" | null; citation: string }> = [];
  const unparsed: string[] = [];
  if (isEmptyCitationCell(cell)) return { citations, unparsed };
  // Enumerated lists ("1) Gen 1:1—2:2 … 2) Gen 22:1-18 …") are the Easter Vigil /
  // Pentecost extended-vigil choice sets; those come from the USCCB pages, which
  // give the formulary actually used, so they are skipped rather than reported.
  if (/(?:^|\s)\d\)\s/.test(cell)) return { citations, unparsed };
  // Split the cycles BEFORE stripping annotations: the "A) … B) … C) …" markers
  // are parentheses, which stripAnnotations removes.
  for (const part of splitByCycle(cell.replace(/\u00a0/g, " "))) {
    const stripped = stripAnnotations(part.text);
    if (isEmptyCitationCell(stripped)) continue;
    const c = normaliseCitation(stripped, opts);
    if (c) citations.push({ cycle: part.cycle, citation: c });
    else unparsed.push(part.text.trim());
  }
  return { citations, unparsed };
}
