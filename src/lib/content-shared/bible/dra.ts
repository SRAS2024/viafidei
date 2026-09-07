/**
 * Douay-Rheims passage resolver.
 *
 * `resolveDouayPassage("Ps 116:12-13, 15 and 16bc, 17-18")` parses the
 * lectionary citation (citation.ts), maps every modern verse onto the
 * Douay-Rheims / Vulgate numbering (alignment.ts) and returns the text from
 * the vendored public-domain store (dra/*.json).
 *
 * Accuracy policy — a passage is returned ONLY when every verse maps with
 * certainty:
 *   - "exact":      every verse sits at the same chapter:verse in the Douay.
 *   - "remapped":   at least one verse was moved by a verified alignment rule
 *                   (Vulgate psalm numbering, chapter-boundary shifts, merges
 *                   or splits). The text is complete and correct; only the
 *                   numbering differs.
 *   - "unverified": some verse could not be mapped with certainty (a book or
 *                   chapter whose Vulgate numbering diverges without a
 *                   verified rule, a verse the Douay lacks, an unparseable
 *                   citation). `text` is null — the caller shows the citation
 *                   only. A wrong or shifted passage is never returned.
 *
 * Partial verses ("12a", "16bc") include the whole Douay verse, with a note.
 * When a citation offers alternatives ("Jn 20:1-9 or Lk 24:13-35") the first
 * is resolved. Server/worker only: the store is a static JSON import.
 */

import {
  ALIGNMENT,
  type AlignmentSpan,
  type DouayRef,
  UNALIGNABLE_BOOKS,
  vulgatePsalmNumber,
} from "./alignment";
import { type BookCode, bookByCode } from "./books";
import {
  type CitationAlternative,
  type CitationSegment,
  type EstherAddition,
  parseCitation,
} from "./citation";
import { DRA_BOOKS } from "./dra/index";
import { MODERN_VERSES } from "./modern-verses";

export type DouayAlignment = "exact" | "remapped" | "unverified";

export interface DouayPassage {
  /** The Douay-Rheims text (verses joined with a space), or null if unverified. */
  text: string | null;
  /** Douay-Rheims "chapter:verse" labels of the verses in `text`, in order. */
  verses: string[];
  /** Modern book name(s), e.g. "Isaiah", "Psalm", "Joel and 2 Corinthians". */
  bookLabel: string;
  /** The Douay-Rheims reference, e.g. "Psalm 97:1-6 (Vulgate numbering)"; "" if unverified. */
  douayCitation: string;
  alignment: DouayAlignment;
  note?: string;
}

/** Text of one Douay-Rheims verse (Douay numbering), or null if it does not exist. */
export function douayText(book: BookCode, chapter: number, verse: number): string | null {
  const text = DRA_BOOKS[book]?.chapters[String(chapter)]?.[String(verse)];
  return typeof text === "string" && text.length > 0 ? text : null;
}

/** Number of verses in a Douay-Rheims chapter (Douay numbering), or null. */
export function douayChapterLength(book: BookCode, chapter: number): number | null {
  const ch = DRA_BOOKS[book]?.chapters[String(chapter)];
  return ch ? Object.keys(ch).length : null;
}

const SINGLE_VERSE_LABEL = (ref: DouayRef) => `${ref[0]}:${ref[1]}`;

function modernChapterLength(book: BookCode, chapter: number | EstherAddition): number | null {
  if (typeof chapter !== "number") return null;
  const n = MODERN_VERSES[book]?.[chapter - 1];
  return typeof n === "number" ? n : null;
}

function findSpan(
  book: BookCode,
  chapter: number | EstherAddition,
  verse: number,
): AlignmentSpan | null {
  const spans = ALIGNMENT[book];
  if (!spans) return null;
  for (const span of spans) {
    if (span.chapter === chapter && verse >= span.from && verse <= span.to) return span;
  }
  return null;
}

interface MappedVerse {
  refs: DouayRef[];
  /** True when the verse sits at the same chapter:verse in the Douay. */
  identity: boolean;
  /** Set when a merge/split rule applied (for the note). */
  redivided?: string;
}

type MapResult = MappedVerse | { fail: string };

function chapterLabel(book: BookCode, chapter: number | EstherAddition): string {
  return `${bookByCode(book).name} ${chapter}`;
}

/** Map one modern verse to its Douay verse(s), or explain why it cannot be. */
function mapVerse(book: BookCode, chapter: number | EstherAddition, verse: number): MapResult {
  if (UNALIGNABLE_BOOKS.has(book)) {
    return {
      fail: `${bookByCode(book).name}'s Vulgate verse numbering diverges pervasively from the modern text and is not aligned`,
    };
  }
  const span = findSpan(book, chapter, verse);
  let mapped: MappedVerse;
  if (span) {
    const width = span.to - span.from + 1;
    if (span.dra.length === width) {
      mapped = { refs: [span.dra[verse - span.from]], identity: false };
    } else if (span.dra.length === 1) {
      mapped = {
        refs: [span.dra[0]],
        identity: false,
        redivided: `modern ${chapter}:${span.from}-${span.to} is one Douay verse (${SINGLE_VERSE_LABEL(span.dra[0])})`,
      };
    } else {
      mapped = {
        refs: [...span.dra],
        identity: false,
        redivided: `modern ${chapter}:${verse} spans Douay ${span.dra.map(SINGLE_VERSE_LABEL).join(", ")}`,
      };
    }
    mapped.identity =
      mapped.refs.length === 1 && mapped.refs[0][0] === chapter && mapped.refs[0][1] === verse;
  } else {
    if (typeof chapter !== "number") {
      return { fail: `${chapterLabel(book, chapter)} is not aligned with the Douay-Rheims` };
    }
    const draChapter = book === "PSA" ? vulgatePsalmNumber(chapter) : chapter;
    const modernCount = modernChapterLength(book, chapter);
    const draCount = douayChapterLength(book, draChapter);
    if (modernCount === null || draCount === null || modernCount !== draCount) {
      return {
        fail: `the verse numbering of ${chapterLabel(book, chapter)} is not verified against the Douay-Rheims`,
      };
    }
    if (verse > modernCount) {
      return { fail: `${chapterLabel(book, chapter)} has only ${modernCount} verses` };
    }
    mapped = { refs: [[draChapter, verse]], identity: draChapter === chapter };
  }
  for (const [c, v] of mapped.refs) {
    if (douayText(book, c, v) === null) {
      return { fail: `the Douay-Rheims has no verse ${bookByCode(book).douayName} ${c}:${v}` };
    }
  }
  return mapped;
}

interface Run {
  start: DouayRef;
  end: DouayRef;
}

/**
 * Compress Douay refs into runs and render them ("52:13-15", "52:13—53:12",
 * "66:2-3, 5-6, 8", "11:19; 12:1-6, 10"). A run may cross a chapter boundary
 * only inside one citation group (i.e. where the citation itself crossed it
 * with "—"); groups are rendered separated by "," (same chapter) or ";".
 */
function formatRefs(book: BookCode, groups: readonly (readonly DouayRef[])[]): string {
  const runs: Run[] = [];
  for (const group of groups) {
    let first = true;
    for (const ref of group) {
      const last = runs[runs.length - 1];
      if (last && !first) {
        const [c, v] = last.end;
        const continues =
          (ref[0] === c && ref[1] === v + 1) ||
          (ref[0] === c + 1 && ref[1] === 1 && douayChapterLength(book, c) === v);
        if (continues) {
          last.end = ref;
          continue;
        }
      }
      first = false;
      runs.push({ start: ref, end: ref });
    }
  }
  let out = "";
  let chapter: number | null = null;
  for (const run of runs) {
    const [c1, v1] = run.start;
    const [c2, v2] = run.end;
    const sameChapter = chapter === c1;
    const head = sameChapter ? `${v1}` : `${c1}:${v1}`;
    let piece: string;
    if (c1 === c2) piece = v1 === v2 ? head : `${head}-${v2}`;
    else piece = `${head}—${c2}:${v2}`;
    out += out.length === 0 ? piece : sameChapter ? `, ${piece}` : `; ${piece}`;
    chapter = c2;
  }
  return out;
}

interface ResolvedSegments {
  /** Every Douay verse, in reading order, without duplicates. */
  refs: DouayRef[];
  /** The same refs grouped by citation segment (chapter-crossing ranges join). */
  groups: DouayRef[][];
  identity: boolean;
  redivided: string[];
  partial: boolean;
}

/** Resolve all the segments of one book run; null + reason when unverified. */
function resolveSegments(
  book: BookCode,
  segments: readonly CitationSegment[],
): ResolvedSegments | { fail: string } {
  const refs: DouayRef[] = [];
  const groups: DouayRef[][] = [];
  const seen = new Set<string>();
  let identity = true;
  let partial = false;
  let joinNext = false;
  const redivided: string[] = [];
  for (const seg of segments) {
    if (!joinNext || groups.length === 0) groups.push([]);
    const group = groups[groups.length - 1];
    joinNext = seg.verses !== "all" && seg.verses[seg.verses.length - 1]?.to === null;
    const modernVerses: number[] = [];
    if (seg.verses === "all") {
      const n = modernChapterLength(book, seg.chapter);
      if (n === null) {
        return {
          fail: `the verse count of ${chapterLabel(book, seg.chapter)} is not verified against the Douay-Rheims`,
        };
      }
      for (let v = 1; v <= n; v++) modernVerses.push(v);
    } else {
      for (const range of seg.verses) {
        if (range.partial) partial = true;
        let to = range.to;
        if (to === null) {
          to = modernChapterLength(book, seg.chapter);
          if (to === null) {
            return {
              fail: `the verse count of ${chapterLabel(book, seg.chapter)} is not verified against the Douay-Rheims`,
            };
          }
        }
        for (let v = range.from; v <= to; v++) modernVerses.push(v);
      }
    }
    const done = new Set<number>();
    for (const v of modernVerses) {
      if (done.has(v)) continue;
      done.add(v);
      const m = mapVerse(book, seg.chapter, v);
      if ("fail" in m) return m;
      if (!m.identity) identity = false;
      if (m.redivided && !redivided.includes(m.redivided)) redivided.push(m.redivided);
      for (const ref of m.refs) {
        const key = SINGLE_VERSE_LABEL(ref);
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push(ref);
        group.push(ref);
      }
    }
  }
  return { refs, groups, identity, redivided, partial };
}

function unverified(bookLabel: string, note: string): DouayPassage {
  return { text: null, verses: [], bookLabel, douayCitation: "", alignment: "unverified", note };
}

/** Group an alternative's segments into consecutive runs of the same book. */
function bookRuns(alt: CitationAlternative): { book: BookCode; segments: CitationSegment[] }[] {
  const runs: { book: BookCode; segments: CitationSegment[] }[] = [];
  for (const seg of alt.segments) {
    const last = runs[runs.length - 1];
    if (last && last.book === seg.book) last.segments.push(seg);
    else runs.push({ book: seg.book, segments: [seg] });
  }
  return runs;
}

/**
 * Resolve a lectionary citation to Douay-Rheims text. Never throws; an
 * unparseable or unverifiable citation yields `text: null` ("unverified").
 */
export function resolveDouayPassage(citation: string): DouayPassage {
  const parsed = parseCitation(citation);
  if (!parsed) return unverified("", "The citation could not be parsed.");
  const alt = parsed.alternatives[0];
  const runs = bookRuns(alt);
  const bookLabel = runs.map((r) => bookByCode(r.book).name).join(" and ");

  const texts: string[] = [];
  const verses: string[] = [];
  const citationParts: string[] = [];
  const notes: string[] = [];
  let identity = true;
  let partial = false;

  for (const run of runs) {
    const resolved = resolveSegments(run.book, run.segments);
    if ("fail" in resolved) {
      return unverified(bookLabel, `Text withheld: ${resolved.fail}.`);
    }
    if (!resolved.identity) identity = false;
    if (resolved.partial) partial = true;
    const info = bookByCode(run.book);
    for (const ref of resolved.refs) {
      verses.push(SINGLE_VERSE_LABEL(ref));
      texts.push(douayText(run.book, ref[0], ref[1]) as string);
    }
    let part = `${info.douayName} ${formatRefs(run.book, resolved.groups)}`;
    if (run.book === "PSA") {
      const renumbered = run.segments.some(
        (s) => typeof s.chapter === "number" && vulgatePsalmNumber(s.chapter) !== s.chapter,
      );
      if (renumbered) {
        part += " (Vulgate numbering)";
        const modern = [...new Set(run.segments.map((s) => s.chapter))];
        notes.push(
          `Psalm ${modern.join(", ")} of the lectionary is Psalm ${modern
            .map((c) => (typeof c === "number" ? vulgatePsalmNumber(c) : c))
            .join(", ")} in the Douay-Rheims (Vulgate) numbering.`,
        );
      }
    } else if (!resolved.identity) {
      notes.push(`Verse numbers follow the Douay-Rheims: ${part}.`);
    }
    if (resolved.redivided.length > 0) {
      notes.push(
        `The Douay-Rheims divides verses differently here: ${resolved.redivided.join("; ")}.`,
      );
    }
    citationParts.push(part);
  }

  if (partial) {
    notes.push(
      "Where the lectionary reads only part of a verse (a/b/c), the whole Douay-Rheims verse is shown.",
    );
  }
  if (parsed.alternatives.length > 1) {
    notes.push(
      `The citation offers ${parsed.alternatives.length} alternative readings; the first is shown.`,
    );
  }

  return {
    text: texts.join(" "),
    verses,
    bookLabel,
    douayCitation: citationParts.join(" and "),
    alignment: identity ? "exact" : "remapped",
    ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
  };
}
