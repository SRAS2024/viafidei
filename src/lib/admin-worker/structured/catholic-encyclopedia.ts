/**
 * The Catholic Encyclopedia (1913) as a public-domain biography and feast
 * witness for the SAINT ingest, read from its Wikisource transcription.
 *
 * The 1913 text is in the public domain; Wikisource transcribes it, one page
 * per article ("Catholic Encyclopedia (1913)/St. Ita"). New Advent's online
 * edition carries its own copyright notice, so text is only ever taken from
 * Wikisource — New Advent is linked, never read.
 *
 * FINDING THE ARTICLE — only for a saint whose Wikidata item links the
 * Encyclopedia, and only on evidence that ties the page to that saint:
 *   1. Wikidata names it: an item that is `main subject` (P921) the saint and
 *      `published in` (P1433) the Encyclopedia, with its Wikisource page.
 *   2. The saint has a Catholic Encyclopedia ID (P3241, New Advent's
 *      "08201c": volume 8, page 201, third article) and the saint's English
 *      Wikipedia article cites an Encyclopedia article — `{{Catholic|wstitle=
 *      …}}`, a `[[wikisource:Catholic Encyclopedia (1913)/…]]` link, or a
 *      newadvent.org/cathen/<id>.htm citation. The page it names must sit in
 *      the volume of the saint's ID (and, when the citation carries an ID, be
 *      that ID's volume), and when the Wikisource header links a Wikipedia
 *      article it must be the saint's own.
 *
 * WHAT IT SUPPLIES:
 *   - a biography: the article's first substantive paragraph(s), verbatim,
 *     cut on a sentence — never composed, never paraphrased;
 *   - feast evidence: the article's EXPLICIT feast statements about its
 *     subject ("His feast is kept on 6 October", "Feast, 15 Jan.", "Serapion is
 *     commemorated in the Roman Martyrology on 30 October"), read under the
 *     ingest's strict rules: Wikidata's day alone corroborates; any other day
 *     contradicts, and the row is refused.
 *
 * Network: one Action API `parse` call per page read, through the shared
 * Wikimedia queue in http.ts (serial, the worker's User-Agent, Retry-After
 * honoured); a read that does not complete is recorded in the caller's ledger.
 */

import { monthName } from "./corroboration";
import { fetchJson, noteUnreadSource, type SourceReadLedger } from "./http";

/** The source, as cited and credited. */
export const CATHOLIC_ENCYCLOPEDIA = {
  id: "catholic-encyclopedia-1913",
  title: "Catholic Encyclopedia (1913)",
} as const;

/** Wikisource page-name prefix of every article of the Encyclopedia. */
const PAGE_PREFIX = "Catholic Encyclopedia (1913)/";
const WIKISOURCE_WIKI = "https://en.wikisource.org/wiki/";

/** Longest biography taken from an article (cut on a sentence). */
export const CE_BIOGRAPHY_MAX_CHARS = 1_500;
/** A first paragraph shorter than this is followed by the next one. */
const CE_BIOGRAPHY_TARGET_CHARS = 300;
/** Shortest biography the SAINT schema accepts. */
const BIOGRAPHY_MIN_CHARS = 100;

/* ── URLs and identifiers ─────────────────────────────────────────────── */

/** The Wikisource URL of an Encyclopedia article ("St. Ita" → …/St._Ita). */
export function catholicEncyclopediaUrl(title: string): string {
  const name = `${PAGE_PREFIX}${title}`.replace(/ /g, "_");
  return WIKISOURCE_WIKI + name.split("/").map(encodeURIComponent).join("/");
}

/** The article title of a Wikisource Encyclopedia URL, or null when it is not one. */
export function catholicEncyclopediaTitle(url: string): string | null {
  if (!url.startsWith(WIKISOURCE_WIKI)) return null;
  let name: string;
  try {
    name = decodeURIComponent(url.slice(WIKISOURCE_WIKI.length).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  name = name.replace(/_/g, " ");
  if (!name.startsWith(PAGE_PREFIX)) return null;
  const title = name.slice(PAGE_PREFIX.length).trim();
  return title || null;
}

const NEW_ADVENT_ID_RE = /^\d{5}[a-z]$/;

/** New Advent's page for a Catholic Encyclopedia ID (P3241) — linked, never read. */
export function newAdventUrl(id: string): string | null {
  const v = id.trim().toLowerCase();
  return NEW_ADVENT_ID_RE.test(v) ? `https://www.newadvent.org/cathen/${v}.htm` : null;
}

/** The printed volume a Catholic Encyclopedia ID points into ("08201c" → 8). */
export function newAdventVolume(id: string): number | null {
  const v = id.trim().toLowerCase();
  if (!NEW_ADVENT_ID_RE.test(v)) return null;
  const n = Number(v.slice(0, 2));
  return n >= 1 && n <= 17 ? n : null;
}

/* ── Citations of the Encyclopedia in an English Wikipedia article ────── */

/** An Encyclopedia article the English article cites. */
export interface CatholicEncyclopediaRef {
  /** The article title, i.e. the page "Catholic Encyclopedia (1913)/<title>". */
  title: string;
  /** The New Advent ID the citation links, when it links one. */
  newAdventId?: string;
}

const CE_TEMPLATE_RE =
  /\{\{\s*(?:Catholic|Catholic[ _]Encyclopedia|CE1913|Cite[ _]CE1913|Cite[ _]Catholic[ _]Encyclopedia|CathEncy)\s*\|([^{}]*)\}\}/gi;
const CE_POSTER_RE = /\{\{\s*CE1913[ _]poster\s*\|\s*([^|{}=]+?)\s*(?:\|[^{}]*)?\}\}/gi;
const CE_INTERWIKI_RE =
  /\[\[\s*:?(?:wikisource|s)\s*:\s*Catholic[ _]Encyclopedia[ _]\(1913\)\/([^\]|#]+)/gi;
const NEW_ADVENT_LINK_RE = /newadvent\.org\/cathen\/(\d{5}[a-z])\.htm/gi;

/** Named parameters of a template body ("wstitle=X|volume=8" → map). */
function templateParams(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of body.split("|")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key && value && !out.has(key)) out.set(key, value);
  }
  return out;
}

/**
 * The article title a citation names ("Thurston, Herbert. \"St. Alfwold.\" The
 * Catholic Encyclopedia" → "St. Alfwold"; "CATHOLIC ENCYCLOPEDIA: Pope
 * Liberius" → "Pope Liberius"), or null when it names none.
 */
export function citedArticleTitle(raw: string): string | null {
  let t = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/&quot;/g, '"');
  const quoted = /"([^"]{2,140})"/.exec(t) ?? /“([^”]{2,140})”/.exec(t);
  if (quoted) {
    t = quoted[1];
  } else {
    const italics = [...t.matchAll(/''([^']{2,140})''/g)]
      .map((m) => m[1])
      .filter((x) => !/catholic encyclopedia/i.test(x));
    if (italics.length > 0) t = italics[0];
  }
  t = t
    .replace(/^\s*(?:the\s+)?catholic encyclopedia(?:\s+online)?\s*[:\-–—]\s*/i, "")
    .replace(/\s*(?:,|\bon\b|\bin\b|[-–—])\s*(?:the\s+)?catholic encyclopedia\b.*$/i, "")
    .replace(/''+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "")
    .trim();
  if (!t || t.length > 120 || /^(?:the\s+)?catholic encyclopedia$/i.test(t)) return null;
  if (/https?:|[{}[\]|]/.test(t)) return null;
  return t;
}

/** The `{{…}}` or `[…]` markup around position `at` (the citation of a link). */
function enclosingCitation(wikitext: string, at: number): string {
  const tpl = wikitext.lastIndexOf("{{", at);
  const tplClosed = tpl >= 0 && wikitext.indexOf("}}", tpl) < at;
  const bracket = wikitext.lastIndexOf("[", at);
  const bracketClosed = bracket >= 0 && wikitext.indexOf("]", bracket) < at;
  const useTemplate = tpl >= 0 && !tplClosed && (bracket < tpl || bracketClosed);
  if (useTemplate) {
    const end = wikitext.indexOf("}}", at);
    return wikitext.slice(tpl, end >= 0 ? end + 2 : at + 200);
  }
  if (bracket >= 0 && !bracketClosed && at - bracket < 20) {
    const end = wikitext.indexOf("]", at);
    return wikitext.slice(bracket, end >= 0 ? end + 1 : at + 200);
  }
  return "";
}

/**
 * Every Encyclopedia article an English Wikipedia article's wikitext cites,
 * in document order, deduplicated. A citation that names no title is
 * skipped, and a New Advent link keeps its ID so the caller can match it
 * against the saint's P3241.
 */
export function catholicEncyclopediaRefsIn(wikitext: string): CatholicEncyclopediaRef[] {
  const found: Array<{ at: number; ref: CatholicEncyclopediaRef }> = [];
  for (const m of wikitext.matchAll(CE_TEMPLATE_RE)) {
    const params = templateParams(m[1]);
    const id = /newadvent\.org\/cathen\/(\d{5}[a-z])\.htm/i.exec(params.get("url") ?? "")?.[1];
    let title: string | null = null;
    for (const key of ["wstitle", "chapter", "entry", "article", "title"]) {
      const value = params.get(key);
      if (value) title = key === "wstitle" ? value.trim() : citedArticleTitle(value);
      if (title) break;
    }
    if (title)
      found.push({
        at: m.index ?? 0,
        ref: { title, ...(id ? { newAdventId: id.toLowerCase() } : {}) },
      });
  }
  for (const m of wikitext.matchAll(CE_POSTER_RE)) {
    found.push({ at: m.index ?? 0, ref: { title: m[1].trim() } });
  }
  for (const m of wikitext.matchAll(CE_INTERWIKI_RE)) {
    found.push({ at: m.index ?? 0, ref: { title: m[1].replace(/_/g, " ").trim() } });
  }
  for (const m of wikitext.matchAll(NEW_ADVENT_LINK_RE)) {
    const at = m.index ?? 0;
    const citation = enclosingCitation(wikitext, at);
    if (!citation) continue;
    let title: string | null = null;
    if (citation.startsWith("{{")) {
      const params = templateParams(citation.slice(2, -2));
      for (const key of ["wstitle", "chapter", "entry", "article", "title"]) {
        const value = params.get(key);
        if (value) title = key === "wstitle" ? value.trim() : citedArticleTitle(value);
        if (title) break;
      }
    } else {
      // "[https://www.newadvent.org/cathen/09178c.htm "St. Leonard of Port Maurice"]"
      const label = citation.replace(/^\[\S+\s*/, "").replace(/\]$/, "");
      title = citedArticleTitle(label);
    }
    if (title) found.push({ at, ref: { title, newAdventId: m[1].toLowerCase() } });
  }
  found.sort((a, b) => a.at - b.at);
  const out: CatholicEncyclopediaRef[] = [];
  for (const { ref } of found) {
    const same = out.find((r) => r.title === ref.title);
    if (!same) out.push({ ...ref });
    else if (!same.newAdventId && ref.newAdventId) same.newAdventId = ref.newAdventId;
  }
  return out;
}

/* ── One article ───────────────────────────────────────────────────────── */

export interface CatholicEncyclopediaArticle {
  /** The Wikisource page — what is cited and credited. */
  url: string;
  /** The article title ("St. Ita"). */
  title: string;
  /** The printed volume the Wikisource header names, when it names one. */
  volume: number | null;
  /** The Wikipedia article the Wikisource header links, when it links one. */
  wikipedia: string | null;
  /**
   * The article's text, paragraph by paragraph, in order: bibliography
   * (`<small>`), Wikisource editors' notes and the header left out.
   */
  paragraphs: string[];
}

/** `| volume = 8` and friends from the `{{CE13 …}}` header of the wikitext. */
function headerParam(wikitext: string, name: string): string | null {
  const header = /\{\{\s*CE13\b([\s\S]*?)\n\}\}/.exec(wikitext)?.[1] ?? "";
  const m = new RegExp(`\\|\\s*${name}\\s*=([^\\n|]*)`).exec(header);
  const v = m?.[1]?.trim();
  return v ? v : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * The article's paragraphs from Wikisource's rendered HTML — the only form
 * that also carries the text of pages transcluded from the scans (`<pages
 * index=…>`), which have no prose in their wikitext at all.
 */
export function articleParagraphs(html: string): string[] {
  // Everything before the end of the header block (its `ws-data` part closes
  // it) is navigation and notes, not the article.
  let body = html;
  const header = html.indexOf('id="ws-data"');
  if (header >= 0) {
    const close = html.indexOf("</div>", header);
    body = close >= 0 ? html.slice(close + "</div>".length) : html.slice(header);
  }
  const out: string[] = [];
  for (const m of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
    const inner = m[1];
    // The bibliography is set small.
    if (/^\s*(?:<br\s*\/?>\s*)*<small\b/i.test(inner)) continue;
    const text = decodeEntities(
      inner
        .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        // Line breaks and blocks separate words; inline markup does not.
        .replace(/<br\s*\/?>|<\/?(?:div|li|ul|ol|table|tr|td|th|blockquote)\b[^>]*>/gi, " ")
        .replace(/<[^>]+>/g, ""),
    )
      .replace(/[​­]/g, "")
      .replace(/\s+/g, " ")
      // "Gregory Bæticus , Bishop" / "( Hrabanus" — spacing left by the markup.
      .replace(/\s+([,.;:)\]])/g, "$1")
      .replace(/([([])\s+/g, "$1")
      .trim();
    if (!text) continue;
    // A Wikisource editor's note ("[Note: In 1970, Anne Line was canonized …]")
    // is not 1913 text.
    if (/^\[\s*note\b/i.test(text)) continue;
    out.push(text);
  }
  return out;
}

/** Parse one fetched page (its title, wikitext and rendered HTML). */
export function parseCatholicEncyclopediaPage(input: {
  title: string;
  wikitext: string;
  html: string;
}): CatholicEncyclopediaArticle {
  const volume = Number(headerParam(input.wikitext, "volume"));
  return {
    url: catholicEncyclopediaUrl(input.title),
    title: input.title,
    volume: Number.isInteger(volume) && volume >= 1 && volume <= 17 ? volume : null,
    wikipedia: headerParam(input.wikitext, "wikipedia"),
    paragraphs: articleParagraphs(input.html),
  };
}

interface ParseResponse {
  parse?: { title?: string; text?: string; wikitext?: string };
  /** A MediaWiki API error — returned with HTTP 200, so `fetchJson` succeeds. */
  error?: { code?: string };
}

/** API errors that ANSWER the question: there is no such page. */
const ABSENT_PAGE_ERRORS: ReadonlySet<string> = new Set([
  "missingtitle",
  "invalidtitle",
  "pagecannotexist",
]);

/**
 * Read one Encyclopedia article from Wikisource (one `parse` call: the
 * wikitext for the header, the rendered HTML for the text). Null when the
 * page does not exist, a redirect leaves the Encyclopedia, or the read did not
 * complete — the last is recorded in `opts.ledger`.
 */
export async function fetchCatholicEncyclopediaArticle(
  title: string,
  opts: { ledger?: SourceReadLedger } = {},
): Promise<CatholicEncyclopediaArticle | null> {
  const api =
    "https://en.wikisource.org/w/api.php?action=parse&prop=text%7Cwikitext&format=json" +
    "&formatversion=2&redirects=1&disablelimitreport=1&disableeditsection=1&page=" +
    encodeURIComponent(`${PAGE_PREFIX}${title}`);
  const data = await fetchJson<ParseResponse>(api, { ledger: opts.ledger });
  const apiError = data?.error?.code;
  if (apiError && !ABSENT_PAGE_ERRORS.has(apiError)) noteUnreadSource(opts.ledger, api);
  const landed = data?.parse?.title ?? "";
  const html = data?.parse?.text;
  const wikitext = data?.parse?.wikitext;
  if (!html || !wikitext || !landed.startsWith(PAGE_PREFIX)) return null;
  return parseCatholicEncyclopediaPage({
    title: landed.slice(PAGE_PREFIX.length),
    wikitext,
    html,
  });
}

/** "Íte_of Killeedy" and "Íte of Killeedy" are the same article. */
function sameArticleTitle(a: string, b: string): boolean {
  const norm = (s: string) => {
    let t = s;
    try {
      t = decodeURIComponent(t);
    } catch {
      // keep as is
    }
    t = t.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  return norm(a) === norm(b);
}

/**
 * Find and read the saint's Encyclopedia article (see the module comment for
 * the two routes and their checks). Reads at most `maxReads` pages. Null when
 * no page could be tied to the saint.
 */
export async function resolveCatholicEncyclopediaArticle(input: {
  /** Wikisource URLs Wikidata gives for the saint (P921 + P1433). */
  wikisourceUrls: readonly string[];
  /** The saint's Catholic Encyclopedia IDs (P3241). */
  newAdventIds: readonly string[];
  /** The Encyclopedia articles the saint's English Wikipedia article cites. */
  refs: readonly CatholicEncyclopediaRef[];
  /** That English article's title, for the Wikisource header check. */
  wikipediaTitle: string | null;
  ledger?: SourceReadLedger;
  maxReads?: number;
}): Promise<CatholicEncyclopediaArticle | null> {
  let reads = input.maxReads ?? 2;
  for (const url of input.wikisourceUrls) {
    const title = catholicEncyclopediaTitle(url);
    if (!title || reads <= 0) continue;
    reads -= 1;
    const article = await fetchCatholicEncyclopediaArticle(title, { ledger: input.ledger });
    if (article && article.paragraphs.length > 0) return article;
  }

  const ids = input.newAdventIds.map((id) => id.trim().toLowerCase()).filter(Boolean);
  const volumes = new Set(ids.map(newAdventVolume).filter((v): v is number => v !== null));
  if (volumes.size === 0) return null;
  // Citations that carry one of the saint's own IDs first, then bare titles;
  // a citation of ANOTHER ID is about another article.
  const ranked = [
    ...input.refs.filter((r) => r.newAdventId && ids.includes(r.newAdventId)),
    ...input.refs.filter((r) => !r.newAdventId),
  ];
  for (const ref of ranked) {
    if (reads <= 0) break;
    reads -= 1;
    const article = await fetchCatholicEncyclopediaArticle(ref.title, { ledger: input.ledger });
    if (!article || article.paragraphs.length === 0) continue;
    const wantVolume = ref.newAdventId ? newAdventVolume(ref.newAdventId) : null;
    const volumeOk =
      article.volume === null
        ? wantVolume !== null
        : wantVolume !== null
          ? article.volume === wantVolume
          : volumes.has(article.volume);
    if (!volumeOk) continue;
    if (
      article.wikipedia &&
      (!input.wikipediaTitle || !sameArticleTitle(article.wikipedia, input.wikipediaTitle))
    ) {
      continue;
    }
    return article;
  }
  return null;
}

/* ── The biography ─────────────────────────────────────────────────────── */

/** Words whose full stop is not a sentence end in the Encyclopedia's prose. */
const CE_ABBREVIATIONS = new Set([
  "st",
  "sts",
  "ss",
  "b",
  "d",
  "c",
  "ca",
  "cf",
  "fr",
  "mt",
  "ven",
  "bl",
  "vol",
  "ed",
  "ibid",
  "op",
  "cit",
  "col",
  "cap",
  "ch",
  "lib",
  "no",
  "nos",
  "n",
  "p",
  "pp",
  "sq",
  "sqq",
  "ff",
  "ms",
  "mss",
  "viz",
  "rev",
  "dr",
  "mgr",
  "jan",
  "feb",
  "mar",
  "apr",
  "aug",
  "sept",
  "sep",
  "oct",
  "nov",
  "dec",
  "s",
  "ps",
  "i.e",
  "e.g",
  "a.d",
  "b.c",
]);

/** Indices just past each sentence end ("… 570. She became …" → after "."). */
function sentenceEnds(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/([A-Za-zÀ-ž0-9.)'"’”]+)([.!?])["'’”)]?(?=\s+["'“(]?[A-Z]|$)/g)) {
    const word = m[1].replace(/[)'"’”]+$/, "");
    const base = word.replace(/\.$/, "").toLowerCase();
    if (
      m[2] === "." &&
      (CE_ABBREVIATIONS.has(base) || /^[A-Z]$/.test(word) || /^[IVXLC]+$/.test(word))
    ) {
      continue;
    }
    out.push((m.index ?? 0) + m[0].length);
  }
  return out;
}

/**
 * Cut `text` to at most `max` characters on a sentence end — also when it
 * fits but stops mid-sentence ("His works are;" before a list) — or null when
 * no sentence end leaves enough text.
 */
function cutOnSentence(text: string, max: number): string | null {
  if (text.length <= max && /[.!?]["'’”)]?$/.test(text)) return text;
  const ends = sentenceEnds(text).filter((e) => e <= max);
  const last = ends[ends.length - 1];
  return last && last >= BIOGRAPHY_MIN_CHARS ? text.slice(0, last).trim() : null;
}

/**
 * A paragraph of the article's prose: not a signature ("W. H. Grattan-Flood."),
 * not a bibliography ("POLLEN, Acts of English Martyrs …", "Acta SS., …").
 */
function isProse(paragraph: string): boolean {
  if (paragraph.length < 60) return false;
  if (/^[A-Z][A-Z'’-]{2,}[,.]/.test(paragraph)) return false;
  if (/^Acta\s+(?:SS|Sanctorum)\b/.test(paragraph)) return false;
  return true;
}

/**
 * The biography the article supplies: its first prose paragraph — and the
 * next ones while the text is still short — verbatim, at most
 * CE_BIOGRAPHY_MAX_CHARS and cut on a sentence. Null when the article opens
 * with too little prose to make one.
 */
export function catholicEncyclopediaBiography(article: CatholicEncyclopediaArticle): string | null {
  let text = "";
  for (const p of article.paragraphs) {
    if (!isProse(p)) {
      if (text) break;
      continue;
    }
    text = text ? `${text} ${p}` : p;
    if (text.length >= CE_BIOGRAPHY_TARGET_CHARS) break;
  }
  if (text.length < BIOGRAPHY_MIN_CHARS) return null;
  return cutOnSentence(text, CE_BIOGRAPHY_MAX_CHARS);
}

/* ── Feast statements ──────────────────────────────────────────────────── */

const MONTH_WORDS: ReadonlyArray<readonly [RegExp, number]> = Array.from({ length: 12 }, (_, i) => {
  const name = monthName(i + 1);
  const abbr = name.slice(0, 3);
  const extra = name === "September" ? "|Sept" : "";
  return [new RegExp(`^(?:${name}|${abbr}${extra})\\.?$`, "i"), i + 1] as const;
});

function monthOf(word: string): number | null {
  for (const [re, n] of MONTH_WORDS) if (re.test(word)) return n;
  return null;
}

const ORDINAL_WORDS: Readonly<Record<string, number>> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
};

/** "23", "23rd", "twenty-third", "thirty first" → 23 / 31. */
function dayOf(word: string): number | null {
  const w = word.toLowerCase().replace(/\s+/g, "-");
  const digits = /^(\d{1,2})(?:st|nd|rd|d|th)?$/.exec(w);
  if (digits) return Number(digits[1]);
  if (ORDINAL_WORDS[w]) return ORDINAL_WORDS[w];
  const compound =
    /^(twenty|thirty)-(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)$/.exec(w);
  if (compound) return (compound[1] === "twenty" ? 20 : 30) + ORDINAL_WORDS[compound[2]];
  return null;
}

const MONTH_PATTERN =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Aug|Sept|Sep|Oct|Nov|Dec)\\.?";
const DAY_PATTERN =
  "(?:\\d{1,2}(?:st|nd|rd|d|th)?|(?:twenty|thirty)[- ](?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth)";
/** "15 January", "the 6th of October", "26 or 27 February", "January 8", "17 Sept." */
const DATE_RE = new RegExp(
  `\\b(${DAY_PATTERN})(?:\\s+(?:or|and|to)\\s+(${DAY_PATTERN}))?\\s+(?:of\\s+)?(${MONTH_PATTERN})(?![A-Za-z])|\\b(${MONTH_PATTERN})\\s+(${DAY_PATTERN})\\b`,
  "gi",
);
/** A year right after the date: an event ("d. 15 January, 570"), not a feast. */
const EVENT_YEAR_RE = /^\s*,?\s*(?:(?:about|c\.|circa|in)\s+)?\d{3,4}(?!\d)/i;

interface DateMention {
  days: string[];
}

function datesIn(clause: string): DateMention[] {
  const out: DateMention[] = [];
  for (const m of clause.matchAll(DATE_RE)) {
    const end = (m.index ?? 0) + m[0].length;
    if (EVENT_YEAR_RE.test(clause.slice(end, end + 14))) continue;
    const month = monthOf(m[3] ?? m[4] ?? "");
    const dayWords = m[3] ? [m[1], m[2]].filter(Boolean) : [m[5]];
    if (!month) continue;
    const days = dayWords
      .map((w) => dayOf(w!))
      .filter((d): d is number => d !== null && d >= 1 && d <= 31)
      .map((d) => `${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    if (days.length > 0) out.push({ days });
  }
  return out;
}

/**
 * Words that make a clause about a feast or a commemoration. Only these: a
 * bare "celebrated" or "kept" is as often Easter or a council ("Symmachus
 * celebrated Easter on 25 March").
 */
const FEAST_WORD_RE = /\b(?:feasts?|festival|commemorat\w*|martyrology)\b/i;
/** How close the subject's name must stand to the feast word to own it. */
const NAME_TO_FEAST_WINDOW = 60;
/** The clause's feast is the subject's own: a pronoun, the saint, or "Feast, …". */
const OWN_FEAST_RE =
  /\b(?:his|her|their|its)\s+(?:principal\s+|joint\s+)?(?:feast|festival|commemoration|memory|name|cult)\b|\b(?:he|she|they)\s+(?:is|are|was|were)\s+(?:now\s+)?(?:commemorated|honou?red|venerated|celebrated|mentioned)\b|\bthe\s+saint'?s\s+feast\b|^\s*feast\b|\bthe\s+feast(?:\s+day)?\s+(?:is|being|was|occurs)\b|\bwhich\s+is\s+(?:kept|celebrated|observed)\b|\bon\s+which\s+day\b|\bmentions\s+(?:him|her|them)\b/i;
/** "the feast of St. Michael", "the feast of Corpus Christi": another feast. */
const FEAST_OF_RE =
  /\b[Ff]easts?\s+(?:day\s+)?of\s+(?:[Tt]he\s+|[Oo]ur\s+|[Ss]ts?\.?\s+|SS\.\s+|[Ss]aints?\s+|[Bb]lessed\s+|[Bb]l\.\s+|[Pp]ope\s+)*([A-Z][A-Za-zÀ-ž'’-]+)/g;

function fold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/æ/gi, "ae").toLowerCase();
}

const NAME_STOPWORDS = new Set([
  "st",
  "sts",
  "ss",
  "saint",
  "saints",
  "blessed",
  "bl",
  "venerable",
  "ven",
  "pope",
  "of",
  "the",
  "and",
  "de",
  "da",
  "di",
  "von",
  "van",
  "la",
  "le",
]);

/** The folded name words of an article title and a label ("St. Ita", "Íte of Killeedy"). */
export function subjectNameWords(...names: readonly string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    for (const w of fold(n.replace(/\([^)]*\)/g, " ")).split(/[^a-z]+/)) {
      if (w.length >= 3 && !NAME_STOPWORDS.has(w)) out.add(w);
    }
  }
  return [...out];
}

/** Does one of the subject's names stand within the window of a feast word? */
function nameNearFeastWord(clause: string, names: ReadonlySet<string>): boolean {
  const folded = fold(clause);
  const feastAt = [...folded.matchAll(new RegExp(FEAST_WORD_RE.source, "gi"))].map(
    (m) => m.index ?? 0,
  );
  for (const name of names) {
    for (const m of folded.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
      const at = m.index ?? 0;
      if (feastAt.some((f) => Math.abs(f - at) <= NAME_TO_FEAST_WINDOW)) return true;
    }
  }
  return false;
}

/** The article's prose cut into sentences. */
function sentencesOf(paragraphs: readonly string[]): string[] {
  const out: string[] = [];
  for (const p of paragraphs) {
    let start = 0;
    for (const end of [...sentenceEnds(p), p.length]) {
      const sentence = p.slice(start, end).trim();
      start = end;
      if (sentence) out.push(sentence);
    }
  }
  return out;
}

/**
 * Within a feast sentence, the clauses whose dates are feast dates: those
 * that name the feast or say it is kept ("…transferred to January 2; in the
 * Dioceses of Besancon … it is now celebrated on January 4"), not those that
 * date something else ("the gathering of his relics is noted in the
 * calendars on 27 June, their translation on 4 March; his feast is
 * celebrated on 28 September").
 */
const FEAST_CLAUSE_RE =
  /\b(?:feasts?|festival|commemorat\w*|martyrology|celebrat\w*|kept|observed|fixed|transferred|assigned|appointed)\b/i;

/**
 * The calendar days the article EXPLICITLY states as its subject's feast or
 * commemoration ("MM-DD", sorted). A sentence counts only when it is about a
 * feast, the feast is the subject's own (a pronoun, the subject's name beside
 * the feast word, or "Feast, 15 Jan."), and it does not name another feast
 * instead ("on the feast of Corpus Christi"); within it, only the clauses that
 * speak of keeping the feast give dates, and a date followed by a year is an
 * event.
 */
export function catholicEncyclopediaFeastDays(
  article: Pick<CatholicEncyclopediaArticle, "paragraphs">,
  subjectNames: readonly string[],
): string[] {
  const names = new Set(subjectNames.map(fold));
  const days = new Set<string>();
  for (const sentence of sentencesOf(article.paragraphs)) {
    if (!FEAST_WORD_RE.test(sentence)) continue;
    const ownByPronoun = OWN_FEAST_RE.test(sentence);
    const ownByName = nameNearFeastWord(sentence, names);
    if (!ownByPronoun && !ownByName) continue;
    // A sentence that only speaks of ANOTHER feast ("the feast of St.
    // Michael") is not about the subject's, unless it also says "his feast".
    const otherFeast = [...sentence.matchAll(FEAST_OF_RE)].some((m) => !names.has(fold(m[1])));
    if (otherFeast && !ownByPronoun) continue;
    for (const clause of sentence.split(/;\s*/)) {
      if (!FEAST_CLAUSE_RE.test(clause)) continue;
      for (const mention of datesIn(clause)) for (const d of mention.days) days.add(d);
    }
  }
  return [...days].sort();
}

export type CatholicEncyclopediaFeastVerdict =
  | { kind: "corroborated" }
  | { kind: "contradicted" | "ambiguous"; days: string[] }
  | { kind: "silent" };

/**
 * Wikidata's feast day against the article's own statements: silent when it
 * states none; corroborated when it states that day and no other; ambiguous
 * when it states that day among others; contradicted when it states only
 * other days.
 */
export function catholicEncyclopediaFeastVerdict(
  article: Pick<CatholicEncyclopediaArticle, "paragraphs">,
  feastDay: string,
  subjectNames: readonly string[],
): CatholicEncyclopediaFeastVerdict {
  const days = catholicEncyclopediaFeastDays(article, subjectNames);
  if (days.length === 0) return { kind: "silent" };
  if (!days.includes(feastDay)) return { kind: "contradicted", days };
  if (days.length > 1) return { kind: "ambiguous", days };
  return { kind: "corroborated" };
}
