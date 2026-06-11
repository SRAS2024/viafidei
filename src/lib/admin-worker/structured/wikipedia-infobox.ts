/**
 * Wikipedia infobox reader for structured-knowledge ingestion.
 *
 * The lead abstract often omits the very facts the corroboration gate needs —
 * a saint's feast day usually lives in the article's INFOBOX, not its prose.
 * This module fetches an article's wikitext (same keyless Wikimedia API family)
 * and parses the first infobox into a cleaned field map, so the ingestors can
 * corroborate sensitive facts against it and enrich records with cited optional
 * fields (birth/death dates, canonization details, patronage).
 *
 * The parser is deterministic and conservative: brace-balanced template
 * extraction, top-level parameter splitting, and value cleaning that strips
 * refs/links/markup — anything it can't clean confidently comes back empty and
 * the caller skips rather than guesses.
 */

import { fetchJson, structuredNetworkEnabled } from "./http";

/** Extract the first `{{Infobox …}}` block from wikitext (brace-balanced). */
export function extractInfoboxBlock(wikitext: string): string | null {
  const start = wikitext.search(/\{\{\s*Infobox/i);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i += 1) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth += 1;
      i += 1;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return wikitext.slice(start, i + 1);
    }
  }
  return null;
}

/** Clean one infobox value: refs, links, templates, markup → plain text. */
export function cleanInfoboxValue(raw: string): string {
  let v = raw;
  // Drop references and HTML comments entirely.
  v = v.replace(/<ref[^>]*\/>/gi, "");
  v = v.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  v = v.replace(/<!--[\s\S]*?-->/g, "");
  // Date templates → ISO-ish "YYYY-MM-DD" from their numeric arguments.
  v = v.replace(
    /\{\{\s*(?:birth|death)[ _]date[^}]*?(\d{3,4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})[^}]*\}\}/gi,
    (_m, y: string, mo: string, d: string) => `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
  );
  // Wrapper templates that just hold text: keep the last positional argument.
  v = v.replace(/\{\{\s*(?:nowrap|small|circa|c\.)\s*\|([^{}|]*)\}\}/gi, "$1");
  // Any remaining templates: drop (innermost-out, a few passes).
  for (let i = 0; i < 4 && /\{\{/.test(v); i += 1) {
    v = v.replace(/\{\{[^{}]*\}\}/g, " ");
  }
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

/**
 * Parse an infobox block into a key → cleaned-value map. Parameter names are
 * lower-cased with spaces/dashes normalised to underscores.
 */
export function parseInfobox(wikitext: string): Record<string, string> {
  const block = extractInfoboxBlock(wikitext);
  if (!block) return {};
  // Strip the outer {{ … }} and split on TOP-LEVEL pipes only.
  const inner = block.slice(2, -2);
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

interface ParseApiResponse {
  parse?: { wikitext?: string };
}

/**
 * Fetch and parse the infobox of an English Wikipedia article URL. Returns {}
 * when offline/disabled, the article has no infobox, or anything fails.
 */
export async function fetchArticleInfobox(articleUrl: string): Promise<Record<string, string>> {
  if (!structuredNetworkEnabled()) return {};
  const m = articleUrl.match(/\/wiki\/(.+)$/);
  if (!m) return {};
  const title = decodeURIComponent(m[1]);
  const api =
    `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}` +
    `&prop=wikitext&format=json&formatversion=2&redirects=1`;
  const data = await fetchJson<ParseApiResponse>(api);
  const wikitext = data?.parse?.wikitext;
  if (!wikitext) return {};
  try {
    return parseInfobox(wikitext);
  } catch {
    return {};
  }
}
