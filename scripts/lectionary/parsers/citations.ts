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

const BOOK_TOKEN_RE = /^(?:([1-3]|I{1,3})\s+)?([A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)*)\s+(?=\d|[A-F]:)/;

/** Canonical USCCB-style abbreviation of a book (its first alias, else its name). */
export function canonicalBookAbbreviation(token: string): string | null {
  const info = findBook(token);
  if (!info) return null;
  return bookByCode(info.code).abbreviations[0] ?? info.name;
}

/** Placeholders the sources use for "no citation" cells. */
const EMPTY_RE =
  /^(?:x|\.|-|—|–|\(?no bibl\.? ref\.?\)?|\[no bibl\.? ref\.?\]|\[o antiphons\]|\[see te deum\]|see the sunday lectionary|\(see the sunday lectionary\)|\(see #[^)]*\)|see #.*|\[see .*\]|\(see .*\))$/i;

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
    .replace(/\b(?:opt|option|optional)\s*:/gi, " ")
    .replace(/[*†‡]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // A trailing pericope title after a spaced dash: "… – Temptation", "… - Man Born Blind".
  t = t.replace(/\s+[–—-]\s+[A-Za-z][^:]*$/u, "");
  return t.trim();
}

/** Split a cell like "A: Matt 17:1-9 B: Mark 9:2-10 C: Luke 9:28b-36" by Sunday cycle. */
export function splitByCycle(text: string): Array<{ cycle: "A" | "B" | "C" | null; text: string }> {
  const m = text.match(/^\s*A:\s*(.+?)\s+B:\s*(.+?)\s+C:\s*(.+?)\s*$/);
  if (!m) return [{ cycle: null, text }];
  return [
    { cycle: "A", text: m[1] },
    { cycle: "B", text: m[2] },
    { cycle: "C", text: m[3] },
  ];
}

const PREFIX_RE = /^(?:see|cf\.?)\s+/i;

function normaliseGroup(group: string, inheritedBook: string | null): { text: string; book: string | null } | null {
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
  // Verse letters are lower-case in the canonical form ("13:18BCDE" → "13:18bcde").
  let refs = g
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\+\s*/g, " and ")
    .replace(/\s*:\s*/g, ":");
  // Chapter crossing "26:14 – 27:66" / "5:20-6:2" → "26:14—27:66".
  refs = refs.replace(/(\d+[a-e]*)\s*[-‐‑–—]\s*(\d+):/g, "$1—$2:");
  // Plain verse ranges "3-4", "12 – 13" → "3-4".
  refs = refs.replace(/(\d+[a-e]*)\s*[‐‑–—-]\s*(\d+[a-e]*)(?!:)/g, "$1-$2");
  refs = refs.replace(/\s+and\s+/g, " and ").trim();
  if (refs.length === 0) return null;
  const withBook = m ? `${book} ${refs}` : refs;
  return { text: withBook, book };
}

/**
 * Normalise one citation cell (already stripped of annotations). Returns the
 * canonical string, or null when it cannot be made to parse.
 */
export function normaliseCitation(raw: string, opts?: { assumePsalm?: boolean }): string | null {
  let text = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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
  for (const alt of text.split(/\s+or\s+/i)) {
    const parts: string[] = [];
    for (const ref of alt.split(/\s+and\s+(?=(?:[1-3]\s+|I{1,3}\s+)?[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)*\s+(?:\d|[A-F]:))/)) {
      const groups: string[] = [];
      for (const group of ref.split(";")) {
        const g = normaliseGroup(group, book);
        if (!g) return null;
        book = g.book;
        groups.push(g.text);
      }
      parts.push(groups.join("; "));
    }
    alternatives.push(parts.join(" and "));
  }
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
  const stripped = stripAnnotations(cell);
  if (isEmptyCitationCell(stripped) || isEmptyCitationCell(cell)) return { citations, unparsed };
  // Enumerated lists ("1) Gen 1:1—2:2 … 2) Gen 22:1-18 …") describe multi-reading
  // vigils; those come from the USCCB pages instead.
  if (/^\d\)\s/.test(stripped) || /\s\d\)\s/.test(stripped)) return { citations, unparsed };
  for (const part of splitByCycle(stripped)) {
    const c = normaliseCitation(part.text, opts);
    if (c) citations.push({ cycle: part.cycle, citation: c });
    else unparsed.push(cell);
  }
  return { citations, unparsed };
}
