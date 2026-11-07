/**
 * Compare the Douay-Rheims store with a clean copy of the text, word by word.
 *
 *   npx tsx scripts/lectionary/check-douay-text.ts [--cache DIR] [--strict]
 *
 * Reads every chapter the Lectionary tables can display from drbo.org, five seconds
 * apart as its robots.txt asks, keeping each page in the cache folder so a second run
 * sends no requests. It prints every place the store's words differ from the page.
 *
 * A difference is known when tests/content/fixtures/douay-corrections.json accounts
 * for that very place: a reading the store keeps as the edition's own, or a correction
 * the printed editions decided against drbo.org, which has errors of its own. An entry
 * excuses its own words and nothing else in its verse. With --strict the script exits
 * non-zero when anything is left unexplained, so it can guard a change to the store or
 * to the tables. See src/lib/content-shared/bible/README.md.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BOOKS, type BookCode } from "../../src/lib/content-shared/bible/books";
import { parseCitation } from "../../src/lib/content-shared/bible/citation";
import { resolveDouayPassage } from "../../src/lib/content-shared/bible/dra";
import { DRA_BOOKS } from "../../src/lib/content-shared/bible/dra/index";
import { splitAlternatives } from "../../src/lib/content-shared/lectionary";
// NOTE: the explicit "/index" is required — src/lib/content-shared/lectionary.ts
// (the text layer) sits beside the package directory of the same name.
import { lectionaryEntry, lectionaryNumbers } from "../../src/lib/content-shared/lectionary/index";

/**
 * Every verse the Lectionary tables can ever display, keyed "PSA 102:8": every section of
 * every formulary, in all cycles, with every alternative a citation offers, resolved the
 * way the readings page resolves them. A citation the resolver withholds adds nothing.
 */
export function displayableVerses(): Map<string, string> {
  const verses = new Map<string, string>();
  for (const number of lectionaryNumbers()) {
    for (const section of lectionaryEntry(number)?.sections ?? []) {
      for (const citation of splitAlternatives(section.citation)) {
        const passage = resolveDouayPassage(citation);
        if (!passage.text) continue;
        const books = (parseCitation(citation)?.alternatives[0]?.segments ?? []).map((s) => s.book);
        const texts = passage.verseGroups.flat();
        passage.verses.forEach((label, i) => {
          const [chapter, verse] = label.split(":");
          // A citation can join two books, and the passage's labels do not name them.
          const book = books.find((b) => DRA_BOOKS[b].chapters[chapter]?.[verse] === texts[i]);
          if (book) verses.set(`${book} ${label}`, texts[i]);
        });
      }
    }
  }
  return verses;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&#39;": "'",
  "&quot;": '"',
  "&mdash;": "—",
  "&ndash;": "–",
};

/** drbo.org's text of a chapter, in order, without its notes. */
export function parseDrboChapter(html: string): string[] {
  const start = html.indexOf("class=textarea");
  const end = html.indexOf('class="booknametable"', start);
  const body = html
    .slice(Math.max(start, 0), end > 0 ? end : html.length)
    .replace(/<p class=note>[\s\S]*?<\/p>/g, "")
    // It prints the Hebrew numbering of the divided psalms in with the text.
    .replace(/Hebrews? Psalm \d+/g, " ");
  return body
    .split(/<a class=vn [^>]*>&nbsp;\d+&nbsp;<\/a>/)
    .slice(1)
    .map((verse) =>
      verse
        .split("</td>")[0]
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
}

/** A verse's words, for comparing: no capitals, no marks, one kind of apostrophe. */
export function comparableWords(text: string): string[] {
  return text
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter((word) => word.length > 0);
}

export interface WordDifference {
  store: string;
  page: string;
  /** The store's words just before it. */
  before: string;
  /** Index of the first differing store word. */
  at: number;
}

/** Where two lists of words differ: a longest-common-subsequence walk, end trimmed. */
export function wordDifferences(store: string[], page: string[]): WordDifference[] {
  let head = 0;
  while (head < store.length && head < page.length && store[head] === page[head]) head += 1;
  let tail = 0;
  while (
    tail < store.length - head &&
    tail < page.length - head &&
    store[store.length - 1 - tail] === page[page.length - 1 - tail]
  ) {
    tail += 1;
  }
  const a = store.slice(head, store.length - tail);
  const b = page.slice(head, page.length - tail);
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out: WordDifference[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    const from = i;
    const fromPage = j;
    while ((i < a.length || j < b.length) && !(i < a.length && j < b.length && a[i] === b[j])) {
      if (j >= b.length || (i < a.length && table[i + 1][j] >= table[i][j + 1])) i += 1;
      else j += 1;
    }
    out.push({
      store: a.slice(from, i).join(" "),
      page: b.slice(fromPage, j).join(" "),
      before: [...store.slice(0, head), ...a.slice(0, from)].slice(-3).join(" "),
      at: head + from,
    });
  }
  return out;
}

/** What this check reads of tests/content/fixtures/douay-corrections.json. */
export interface DouayLedger {
  corrections: { ref: string; was: string; now: string; drbo: boolean }[];
  kept: { ref: string; store: string; drbo: string }[];
}

export interface ChapterDifference extends WordDifference {
  /** The verse it falls in. */
  ref: string;
  known: boolean;
}

/** Does this entry of the ledger account for this very difference, in this verse? */
function accountedFor(
  difference: WordDifference,
  ref: string,
  words: string[],
  [from, to]: [number, number],
  ledger: DouayLedger,
): boolean {
  const kept = ledger.kept.some(
    (entry) =>
      entry.ref === ref &&
      comparableWords(entry.store).join(" ") === difference.store &&
      comparableWords(entry.drbo).join(" ") === difference.page,
  );
  if (kept) return true;

  // A correction drbo.org does not have: drbo.org differs from it by what the correction changed,
  // inside the words it corrected, wherever in the verse those words stand.
  const stored = difference.store ? difference.store.split(" ").length : 0;
  return ledger.corrections.some((entry) => {
    if (entry.ref !== ref || entry.drbo) return false;
    const now = comparableWords(entry.now);
    let inPlace = false;
    for (let start = from; start + now.length <= to && !inPlace; start += 1) {
      inPlace =
        start <= difference.at &&
        difference.at + stored <= start + now.length &&
        now.every((word, i) => words[start + i] === word);
    }
    if (!inPlace) return false;
    return wordDifferences(now, comparableWords(entry.was)).some(
      (changed) => changed.store === difference.store && changed.page === difference.page,
    );
  });
}

/**
 * A chapter's differences from drbo.org's page, each with its verse and whether the ledger accounts
 * for it. Whole chapters, because drbo.org numbers some verses its own way (Psalms 9, 115 and 147, and
 * the last verses of Psalms 28 and 150): words are compared, and verses are told apart only to name
 * the place.
 */
export function explainChapter(
  book: BookCode,
  chapter: string,
  verses: Record<string, string>,
  page: string[],
  ledger: DouayLedger,
): ChapterDifference[] {
  const words: string[] = [];
  const owner: string[] = [];
  const span = new Map<string, [number, number]>();
  for (const [verse, text] of Object.entries(verses)) {
    const from = words.length;
    for (const word of comparableWords(text)) {
      words.push(word);
      owner.push(verse);
    }
    span.set(verse, [from, words.length]);
  }
  return wordDifferences(words, page).map((difference) => {
    const here = owner[Math.min(difference.at, owner.length - 1)];
    const claimants = [here];
    // A word lost at a verse's end falls at the next verse's first place, so that verse's
    // neighbour can claim it too.
    if (!difference.store && difference.at > 0 && owner[difference.at - 1] !== here) {
      claimants.push(owner[difference.at - 1]);
    }
    const known = claimants.some((verse) =>
      accountedFor(
        difference,
        `${book} ${chapter}:${verse}`,
        words,
        span.get(verse) as [number, number],
        ledger,
      ),
    );
    return { ...difference, ref: `${book} ${chapter}:${here}`, known };
  });
}

/** drbo.org's order of the books: unlike ours, the Machabees close the Old Testament. */
function drboOrder(): BookCode[] {
  const codes: BookCode[] = BOOKS.map((b) => b.code).filter(
    (code) => code !== "1MA" && code !== "2MA",
  );
  codes.splice(codes.indexOf("MAL") + 1, 0, "1MA", "2MA");
  return codes;
}

/** A chapter's page there: BBCCC.htm. */
export function drboPage(book: BookCode, chapter: string): string {
  const number = drboOrder().indexOf(book) + 1;
  return `${String(number).padStart(2, "0")}${chapter.padStart(3, "0")}.htm`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchChapter(cache: string, page: string): Promise<string> {
  const path = join(cache, page);
  if (existsSync(path)) return readFileSync(path, "latin1");
  await sleep(5000);
  const response = await fetch(`https://www.drbo.org/chapter/${page}`);
  if (!response.ok) throw new Error(`drbo.org ${page}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, bytes);
  return bytes.toString("latin1");
}

function argument(argv: string[], flag: string, fallback: string): string {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
}

export async function main(argv: string[]): Promise<number> {
  const cache = argument(argv, "--cache", join(tmpdir(), "drbo-chapters"));
  const strict = argv.includes("--strict");
  mkdirSync(cache, { recursive: true });

  const ledger = JSON.parse(
    readFileSync(
      new URL("../../tests/content/fixtures/douay-corrections.json", import.meta.url),
      "utf8",
    ),
  ) as DouayLedger;

  const chapters = new Set([...displayableVerses().keys()].map((ref) => ref.split(":")[0]));

  let unexplained = 0;
  let total = 0;
  for (const key of chapters) {
    const [book, chapter] = key.split(" ") as [BookCode, string];
    const html = await fetchChapter(cache, drboPage(book, chapter));
    const page = comparableWords(parseDrboChapter(html).join(" "));
    const verses = DRA_BOOKS[book].chapters[chapter];
    for (const difference of explainChapter(book, chapter, verses, page, ledger)) {
      total += 1;
      if (!difference.known) unexplained += 1;
      console.log(
        `${difference.known ? "known      " : "UNEXPLAINED"} ${difference.ref}  ${difference.before} [${difference.store}] drbo.org [${difference.page}]`,
      );
    }
  }
  console.log(`${chapters.size} chapters, ${total} differences, ${unexplained} unexplained`);
  return strict && unexplained > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith("check-douay-text.ts")) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
