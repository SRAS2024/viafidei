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

import { fetchJson, structuredNetworkEnabled } from "./http";
import { parseWikipediaArticleUrl } from "./wikipedia-url";

/**
 * Template names that act as a person/saint infobox across the language
 * editions the ingest reads: enwiki `{{Infobox saint}}`, itwiki `{{Santo}}` /
 * `{{Bio}}`, eswiki `{{Ficha de santo}}`, frwiki `{{Infobox Saint}}`, plwiki
 * `{{Święty infobox}}`, dewiki `{{Infobox …}}` (rare for persons).
 */
const INFOBOX_START_RE = /\{\{\s*(?:Infobox|Ficha de|Santo\b|Bio\b|Święty infobox|Personendaten)/i;

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
  // List wrappers.
  "unbulleted list",
  "ubl",
  "ublist",
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
function resolveTemplates(text: string): string {
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
      if (!UNWRAP_TEMPLATES.has(name)) return " ";
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

/** Clean one infobox value: refs, links, templates, markup → plain text. */
export function cleanInfoboxValue(raw: string): string {
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
  v = resolveTemplates(v);
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
    const value = cleanInfoboxValue(part.slice(eq + 1));
    if (value) out[key] = value;
  }
  return out;
}

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
}

/**
 * Fetch the raw wikitext of a Wikipedia article URL (any language edition).
 * Returns null when offline/disabled, the URL isn't an article, or the fetch
 * fails. Bounded to `maxChars` so a huge article never becomes a huge payload.
 */
export async function fetchArticleWikitext(
  articleUrl: string,
  opts: { maxChars?: number } = {},
): Promise<string | null> {
  if (!structuredNetworkEnabled()) return null;
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
  const data = await fetchJson<ParseApiResponse>(api);
  const wikitext = data?.parse?.wikitext;
  if (!wikitext) return null;
  const max = opts.maxChars ?? 400_000;
  return wikitext.length > max ? wikitext.slice(0, max) : wikitext;
}

/**
 * Fetch and parse the infoboxes of a Wikipedia article URL. Returns {} when
 * offline/disabled, the article has no infobox, or anything fails.
 */
export async function fetchArticleInfobox(articleUrl: string): Promise<Record<string, string>> {
  const wikitext = await fetchArticleWikitext(articleUrl);
  if (!wikitext) return {};
  try {
    return parseInfobox(wikitext);
  } catch {
    return {};
  }
}
