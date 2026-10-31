/**
 * Wikipedia infobox reader for structured-knowledge ingestion.
 *
 * The lead abstract often omits the very facts the corroboration gate needs —
 * a saint's feast day usually lives in the article's INFOBOX, not its prose.
 * This module fetches an article's wikitext (same keyless Wikimedia API family)
 * and parses its infoboxes into a cleaned field map, so the ingestors can
 * corroborate sensitive facts against it and enrich records with cited optional
 * fields (birth/death dates, canonization details, patronage).
 *
 * The parser is deterministic and conservative: brace-balanced template
 * extraction, top-level parameter splitting, and value cleaning that strips
 * refs/links/markup — anything it can't clean confidently comes back empty and
 * the caller skips rather than guesses.
 */

import { fetchJson, noteUnreadSource, type SourceReadLedger } from "./http";
import { parseWikipediaArticleUrl } from "./wikipedia-url";

/**
 * Template names that act as a person/saint infobox across the language
 * editions the ingest reads: enwiki `{{Infobox saint}}` and its redirect
 * `{{Saint}}`, itwiki `{{Santo}}` / `{{Bio}}`, eswiki `{{Ficha de santo}}`,
 * frwiki `{{Infobox Saint}}`, plwiki `{{Święty infobox}}`, dewiki
 * `{{Infobox …}}` (rare for persons). `{{Saint}}` is matched only as the
 * whole template name: Edward Colman's and Humphrey Middlemore's articles
 * state their feasts in one, and missing it sent both to the weaker prose rule.
 */
const INFOBOX_START_RE =
  /\{\{\s*(?:Infobox|Ficha de|Santo\b|Bio\b|Święty infobox|Personendaten|Saint\s*(?=\||\n|\}\}))/i;

/** Extract the first `{{Infobox …}}` block from wikitext (brace-balanced). */
export function extractInfoboxBlock(wikitext: string): string | null {
  return extractInfoboxBlocks(wikitext)[0] ?? null;
}

/**
 * Extract EVERY infobox-like template block from wikitext (brace-balanced, in
 * document order). Saint articles regularly carry a second infobox (a
 * `{{Infobox saint}}` after an `{{Infobox person}}`, or a papal infobox first);
 * reading only the first one silently dropped the feast day that lived in the
 * second, so the corroboration gate skipped a perfectly documented saint.
 */
export function extractInfoboxBlocks(wikitext: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (let guard = 0; guard < 8; guard += 1) {
    const rel = wikitext.slice(from).search(INFOBOX_START_RE);
    if (rel === -1) break;
    const start = from + rel;
    let depth = 0;
    let end = -1;
    for (let i = start; i < wikitext.length - 1; i += 1) {
      if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
        depth += 1;
        i += 1;
      } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
        depth -= 1;
        i += 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break; // unbalanced — stop rather than guess
    blocks.push(wikitext.slice(start, end));
    from = end;
  }
  return blocks;
}

/**
 * Split wikitext on TOP-LEVEL pipes, respecting `{{…}}` and `[[…]]` nesting.
 *
 * Shared by the infobox parameter splitter and the wrapper-template unwrapper,
 * because both have the same trap: `[[Eastern Orthodoxy|Orthodox Churches]]`
 * carries a pipe that is NOT an argument separator, and splitting on it turns
 * one feast date into two fragments.
 */
export function splitTopLevelPipes(inner: string): string[] {
  const parts: string[] = [];
  let depthTpl = 0;
  let depthLink = 0;
  let cur = "";
  for (let i = 0; i < inner.length; i += 1) {
    const two = inner.slice(i, i + 2);
    if (two === "{{") {
      depthTpl += 1;
      cur += two;
      i += 1;
    } else if (two === "}}") {
      depthTpl -= 1;
      cur += two;
      i += 1;
    } else if (two === "[[") {
      depthLink += 1;
      cur += two;
      i += 1;
    } else if (two === "]]") {
      depthLink -= 1;
      cur += two;
      i += 1;
    } else if (inner[i] === "|" && depthTpl === 0 && depthLink === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += inner[i];
    }
  }
  parts.push(cur);
  return parts;
}

/**
 * Templates that merely WRAP a value: the value IS their positional arguments,
 * so they must be unwrapped rather than deleted.
 *
 * MEASURED BUG this closes (live, 2026-09-08). `{{Infobox saint}}` and
 * `{{Infobox Christian leader}}` write a multi-date feast as
 * `| feast_day = {{unbulleted list|20 December (…)|26 August (…)}}` and a
 * canonization date as `{{start date|1997|10|19}}`. The cleaner deleted every
 * template it did not recognise, so those values cleaned to the empty string
 * and — because `parseInfoboxBlock` only records non-empty values — the
 * parameter vanished from the parsed map entirely. Pope Zephyrinus (Q101306)
 * states BOTH his feast days in exactly that list template, and the saint
 * ingest's corroboration gate saw an infobox with no feast at all and reported
 * `feast_uncorroborated`. The same erasure silently emptied `patronage`
 * (usually `{{plainlist}}` / `{{hlist}}`) and the canonization dates that
 * branch 3 of the saint corpus takes its status from.
 *
 * Deliberately an ALLOWLIST: an unrecognised template is still dropped, because
 * a template we cannot read is not evidence of anything.
 */
const UNWRAP_TEMPLATES: ReadonlySet<string> = new Set([
  // List wrappers. `{{cslist}}` is how René Goupil's infobox writes "26
  // September (Canada) | 19 October (United States)"; dropping it left his
  // feast parameter empty and the ingest fell back to prose.
  "unbulleted list",
  "ubl",
  "ublist",
  "cslist",
  "comma separated list",
  "comma-separated list",
  "sslist",
  "semicolon separated list",
  "andlist",
  "ordered list",
  "plainlist",
  "plain list",
  "flatlist",
  "flat list",
  "hlist",
  "bulleted list",
  "collapsible list",
  "indented plainlist",
  // Pure presentation wrappers.
  "nowrap",
  "nobr",
  "small",
  "big",
  "nobold",
  "noitalic",
  // NOT `{{lang|la|…}}`: its first positional argument is a language code, so
  // unwrapping it would inject "la; " into the value. Dropping it is cleaner.
  // Approximate-date wrappers whose argument is the date text itself.
  "circa",
  "c.",
  "ca",
  "start date",
  "end date",
  "start-date",
  "end-date",
]);

/** Line-leading `*` / `#` bullets inside a list argument → "; " separators. */
function debullet(arg: string): string {
  return arg
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[*#]+\s*/, "").trim())
    .filter(Boolean)
    .join("; ");
}

/**
 * Resolve templates innermost-first: unwrap the ones on the allowlist to their
 * positional arguments (joined with "; "), drop everything else. Bounded passes
 * so deeply nested markup can never spin.
 */
function resolveTemplates(text: string, unwrapAll = false): string {
  let v = text;
  for (let pass = 0; pass < 6 && /\{\{/.test(v); pass += 1) {
    let changed = false;
    // `[^{}]*` can only match an INNERMOST template, so each pass peels one
    // level and the allowlist is applied to a fully-resolved argument list.
    v = v.replace(/\{\{([^{}]*)\}\}/g, (_whole, inner: string) => {
      changed = true;
      const parts = splitTopLevelPipes(inner);
      const name = (parts[0] ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, " ");
      if (!unwrapAll && !UNWRAP_TEMPLATES.has(name)) return " ";
      const args = parts
        .slice(1)
        // Drop named parameters (`class=…`, `title=…`): chrome, not content.
        .filter((p) => !/^\s*[A-Za-z][A-Za-z0-9 _-]*=/.test(p))
        .map(debullet)
        .filter(Boolean);
      return args.length ? ` ${args.join("; ")} ` : " ";
    });
    if (!changed) break;
  }
  return v;
}

/**
 * Clean one infobox value: refs, links, templates, markup → plain text.
 * `unwrapAll` unwraps EVERY template to its positional arguments instead of
 * dropping the unrecognised ones — the fallback for a feast parameter that
 * would otherwise clean to nothing (see `parseInfoboxBlock`).
 */
export function cleanInfoboxValue(raw: string, opts: { unwrapAll?: boolean } = {}): string {
  let v = raw;
  // Drop references and HTML comments entirely.
  v = v.replace(/<ref[^>]*\/>/gi, "");
  v = v.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  v = v.replace(/<!--[\s\S]*?-->/g, "");
  // Date templates → ISO-ish "YYYY-MM-DD" from their numeric arguments.
  // `start`/`end` are here as well as on the unwrap list so a full
  // `{{start date|1997|10|19}}` reads as a date rather than "1997; 10; 19";
  // the unwrap list still catches the year-only `{{start date|1997}}`.
  v = v.replace(
    /\{\{\s*(?:birth|death|start|end)[ _]date[^}]*?(\d{3,4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})[^}]*\}\}/gi,
    (_m, y: string, mo: string, d: string) => `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
  );
  // Wrapper templates hold the value; anything unrecognised is dropped.
  v = resolveTemplates(v, opts.unwrapAll === true);
  // Links: [[target|label]] → label, [[target]] → target.
  v = v.replace(/\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]/g, "$1");
  // External links: [url label] → label.
  v = v.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1");
  v = v.replace(/\[https?:\/\/\S+\]/g, " ");
  // Bold/italic markup, leftover braces/brackets, HTML tags, list bullets.
  v = v.replace(/'{2,}/g, "");
  v = v.replace(/<[^>]+>/g, " ");
  v = v.replace(/[{}[\]]/g, " ");
  v = v.replace(/^\s*\*+\s*/gm, "");
  return v.replace(/\s+/g, " ").trim();
}

/** Parse ONE infobox block into a key → cleaned-value map. */
function parseInfoboxBlock(block: string): Record<string, string> {
  // Strip the outer {{ … }} and split on TOP-LEVEL pipes only.
  const parts = splitTopLevelPipes(block.slice(2, -2));

  const out: Record<string, string> = {};
  // parts[0] is the template name ("Infobox saint"); the rest are params.
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part
      .slice(0, eq)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (!key) continue;
    const raw = part.slice(eq + 1);
    let value = cleanInfoboxValue(raw);
    // A feast parameter must never vanish because it sits in a wrapper we do
    // not know: an absent infobox feast sends the ingest to the prose rule,
    // which is the weaker one. Read its template arguments instead.
    if (!value && FEAST_KEYS.has(key) && raw.trim()) {
      value = cleanInfoboxValue(raw, { unwrapAll: true });
    }
    if (value) out[key] = value;
  }
  return out;
}

/** Infobox parameters that state a feast day, across the editions we read. */
const FEAST_KEYS: ReadonlySet<string> = new Set([
  "feast_day",
  "feast",
  "feastday",
  "ricorrenza",
  "festividad",
  "fête",
  "fete",
  "gedenktag",
  "wspomnienie",
]);

/**
 * Parse the infoboxes of a page into ONE key → cleaned-value map. Parameter
 * names are lower-cased with spaces/dashes normalised to underscores. Every
 * infobox on the page contributes; when two carry the same parameter the FIRST
 * (top-most) infobox wins, matching how a reader sees the page.
 */
export function parseInfobox(wikitext: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of extractInfoboxBlocks(wikitext)) {
    for (const [k, v] of Object.entries(parseInfoboxBlock(block))) {
      if (!(k in out)) out[k] = v;
    }
  }
  return out;
}

interface ParseApiResponse {
  parse?: { wikitext?: string };
  /** A MediaWiki API error — returned with HTTP 200, so `fetchJson` succeeds. */
  error?: { code?: string };
}

/**
 * API errors that ANSWER the question — the page does not exist or cannot be
 * one — as opposed to a server that could not answer it this time
 * (`internal_api_error_*`, `ratelimited`, `readonly`, …).
 */
const ABSENT_PAGE_ERRORS: ReadonlySet<string> = new Set([
  "missingtitle",
  "invalidtitle",
  "pagecannotexist",
]);

/**
 * Fetch the raw wikitext of a Wikipedia article URL (any language edition).
 * Returns null when offline/disabled, the URL isn't an article, or the fetch
 * fails. Bounded to `maxChars` so a huge article never becomes a huge payload.
 * A read that failed transiently — including an API error that is not about
 * the page — is recorded in `opts.ledger`.
 */
export async function fetchArticleWikitext(
  articleUrl: string,
  opts: { maxChars?: number; ledger?: SourceReadLedger } = {},
): Promise<string | null> {
  const parsed = parseWikipediaArticleUrl(articleUrl);
  if (!parsed) return null;
  let title: string;
  try {
    title = decodeURIComponent(parsed.title);
  } catch {
    title = parsed.title;
  }
  const api =
    `https://${parsed.lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}` +
    `&prop=wikitext&format=json&formatversion=2&redirects=1`;
  // `fetchJson` is also the network gate: offline it answers null (and records
  // the read as unread) without a request.
  const data = await fetchJson<ParseApiResponse>(api, { ledger: opts.ledger });
  const apiError = data?.error?.code;
  if (apiError && !ABSENT_PAGE_ERRORS.has(apiError)) noteUnreadSource(opts.ledger, api);
  const wikitext = data?.parse?.wikitext;
  if (!wikitext) return null;
  const max = opts.maxChars ?? 400_000;
  return wikitext.length > max ? wikitext.slice(0, max) : wikitext;
}

/**
 * Fetch and parse the infoboxes of a Wikipedia article URL. Returns {} when
 * offline/disabled, the article has no infobox, or anything fails — so a
 * caller whose verdict depends on the difference passes `opts.ledger`, where a
 * read that did not complete is recorded.
 */
export async function fetchArticleInfobox(
  articleUrl: string,
  opts: { ledger?: SourceReadLedger } = {},
): Promise<Record<string, string>> {
  const wikitext = await fetchArticleWikitext(articleUrl, { ledger: opts.ledger });
  if (!wikitext) return {};
  try {
    return parseInfobox(wikitext);
  } catch {
    return {};
  }
}

/** Longest article body kept for the prose checks. */
const PROSE_MAX_CHARS = 200_000;

/**
 * The article's running text as plain prose: the wikitext with its infoboxes
 * removed and refs, templates, links and markup cleaned the same way an
 * infobox value is. Used for the feast-wording corroboration, which must see
 * the body ("His feast is kept on 23 August" is rarely in the lead) but never
 * the infobox, whose dates are judged by their own, stricter rule.
 */
export function articleProse(wikitext: string): string {
  let body = wikitext;
  for (const block of extractInfoboxBlocks(wikitext)) body = body.replace(block, " ");
  // Section headings carry no dates worth reading, but keep their words.
  body = body.replace(/^=+\s*(.*?)\s*=+\s*$/gm, "$1.");
  const prose = cleanInfoboxValue(body);
  return prose.length > PROSE_MAX_CHARS ? prose.slice(0, PROSE_MAX_CHARS) : prose;
}

/** What one Action API parse call yields: the infobox fields and the body prose. */
export interface ArticleSource {
  infobox: Record<string, string>;
  /** Plain-text article body without its infoboxes ("" when unavailable). */
  prose: string;
}

/**
 * Fetch an article's wikitext ONCE and return both its infobox and its body
 * prose. Returns empty parts when offline/disabled or anything fails; a read
 * that did not complete is recorded in `opts.ledger` when one is passed.
 */
export async function fetchArticleSource(
  articleUrl: string,
  opts: { ledger?: SourceReadLedger } = {},
): Promise<ArticleSource> {
  const wikitext = await fetchArticleWikitext(articleUrl, { ledger: opts.ledger });
  if (!wikitext) return { infobox: {}, prose: "" };
  let infobox: Record<string, string> = {};
  let prose = "";
  try {
    infobox = parseInfobox(wikitext);
  } catch {
    infobox = {};
  }
  try {
    prose = articleProse(wikitext);
  } catch {
    prose = "";
  }
  return { infobox, prose };
}
