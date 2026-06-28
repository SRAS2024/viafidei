/**
 * Structured-data extraction toolkit — keyless, deterministic, dependency-free.
 *
 * Most real-world Catholic pages embed machine-readable structured data the
 * plain text reader throws away: schema.org JSON-LD, OpenGraph/Twitter cards,
 * Dublin Core and standard `<meta>` tags, and (h)microdata. These carry exactly
 * the fields the extractors fight to recover from prose — the canonical title,
 * a clean description, publication/modification dates, the author/publisher,
 * and the entity type (Person, Article, Event, Place…). This module lifts all
 * of them out with pure string parsing (no DOM library, no network, no AI) and
 * normalises them into a single `StructuredFacts` object the source reader
 * folds into extraction, so every content type gains accurate dates, names,
 * and descriptions wherever a page bothered to mark them up.
 *
 * Everything here is a pure function over an HTML string and is fully
 * fail-open: malformed markup yields empty results, never an exception.
 */

/** Normalised, extractor-friendly facts distilled from a page's structured data. */
export interface StructuredFacts {
  title?: string;
  description?: string;
  /** schema.org @type / OpenGraph type, lower-cased (e.g. "person", "article"). */
  type?: string;
  author?: string;
  publisher?: string;
  datePublished?: string;
  dateModified?: string;
  /** Any other dated facts discovered (birth/death/start/end/founding…). */
  dates: string[];
  /** Proper names discovered (entity name, author, etc.), de-duplicated. */
  names: string[];
  /** Canonical / same-as URLs. */
  urls: string[];
  /**
   * Labelled key→value facts lifted from definition lists (`<dl>`) and
   * two-column fact tables — how most Catholic reference pages present feast
   * days, patronages, birth/death years, reign dates, etc. Keys are lower-cased.
   */
  properties: Record<string, string>;
}

export interface StructuredData {
  jsonLd: unknown[];
  openGraph: Record<string, string>;
  meta: Record<string, string>;
  microdata: Array<{ type?: string; props: Record<string, string> }>;
  facts: StructuredFacts;
}

const ISO_DATE = /\d{4}-\d{2}-\d{2}(?:T[\d:.+Z-]*)?/;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&nbsp;/g, " ");
}

function clean(s: unknown, max = 600): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = decodeEntities(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : undefined;
}

/**
 * Parse every `<script type="application/ld+json">` block. Tolerates arrays,
 * `@graph` wrappers, trailing commas (a common real-world error), and multiple
 * blocks. Returns a flat list of JSON-LD node objects.
 */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim().replace(/,\s*([}\]])/g, "$1");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    for (const node of flattenJsonLd(parsed)) out.push(node);
  }
  return out;
}

function flattenJsonLd(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) return obj["@graph"].flatMap(flattenJsonLd);
    return [obj];
  }
  return [];
}

/** Extract OpenGraph + Twitter card properties (`og:*`, `twitter:*`). */
export function extractOpenGraph(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const prop = attr(tag, "property") ?? attr(tag, "name");
    if (!prop || !/^(og|twitter|article|book|profile):/i.test(prop)) continue;
    const content = clean(attr(tag, "content"));
    if (content) out[prop.toLowerCase()] = content;
  }
  return out;
}

/**
 * Extract standard + Dublin Core `<meta>` tags keyed by name (lower-cased):
 * description, author, keywords, `dc.*`, `dcterms.*`, `citation_*`, etc.
 */
export function extractMetaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const name = attr(tag, "name") ?? attr(tag, "itemprop");
    if (!name) continue;
    const content = clean(attr(tag, "content"));
    if (content) out[name.toLowerCase()] = content;
  }
  return out;
}

/**
 * Lightweight microdata: collect `itemprop` values, grouped under the nearest
 * `itemtype`. Not a full HTML parser — a pragmatic sweep that captures the flat
 * property set most pages expose (good enough to recover names + dates).
 */
export function extractMicrodata(
  html: string,
): Array<{ type?: string; props: Record<string, string> }> {
  const items: Array<{ type?: string; props: Record<string, string> }> = [];
  const scopeRe = /<[^>]*\bitemscope\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = scopeRe.exec(html)) !== null) {
    const typeUrl = attr(m[0], "itemtype");
    const type = typeUrl ? typeUrl.replace(/.*\//, "").toLowerCase() : undefined;
    items.push({ type, props: {} });
  }
  // Collect itemprop values globally. Two passes: paired elements (capture inner
  // text or content/datetime attr) and void elements (meta/link/img: attr only).
  const flat: Record<string, string> = {};
  const pairedRe = /<([a-z0-9]+)\b([^>]*\bitemprop=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = pairedRe.exec(html)) !== null) {
    const key = m[3].trim().toLowerCase();
    const attrs = `<x ${m[2]}>`;
    const value = attr(attrs, "content") ?? attr(attrs, "datetime") ?? clean(m[4]);
    if (key && value && !flat[key]) flat[key] = value;
  }
  const voidRe = /<(?:meta|link|img)\b([^>]*\bitemprop=["']([^"']+)["'][^>]*)\/?>/gi;
  while ((m = voidRe.exec(html)) !== null) {
    const key = m[2].trim().toLowerCase();
    const value = attr(`<x ${m[1]}>`, "content");
    if (key && value && !flat[key]) flat[key] = value;
  }
  if (Object.keys(flat).length) {
    if (items.length) items[0].props = flat;
    else items.push({ type: undefined, props: flat });
  }
  return items;
}

/**
 * Lift labelled key→value facts from definition lists (`<dt>`/`<dd>`) and
 * two-column fact tables (`<th>`/`<td>` or two `<td>`s) — the shape most
 * Catholic reference pages (and Wikipedia infoboxes) use for feast day,
 * patronage, birth/death, reign, founded, etc. Keys lower-cased; values cleaned.
 */
export function extractDefinitionFacts(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (k: string | undefined, v: string | undefined) => {
    const key = clean(k, 60)
      ?.toLowerCase()
      .replace(/[:\s]+$/, "");
    const val = clean(v, 300);
    if (key && val && key.length <= 60 && !out[key]) out[key] = val;
  };
  // Definition lists: pair each <dt> with the following <dd>.
  const dlRe = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
  let m: RegExpExecArray | null;
  while ((m = dlRe.exec(html)) !== null) add(m[1], m[2]);
  // Two-column rows: <th>label</th><td>value</td> or <td>label</td><td>value</td>.
  const rowRe =
    /<tr\b[^>]*>\s*<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  while ((m = rowRe.exec(html)) !== null) add(m[1], m[2]);
  return out;
}

function attr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const m = re.exec(tag);
  if (!m) return undefined;
  return m[2] ?? m[3] ?? undefined;
}

function pushName(facts: StructuredFacts, value: unknown): void {
  const v = clean(value, 200);
  if (v && !facts.names.includes(v)) facts.names.push(v);
}

function pushDate(facts: StructuredFacts, value: unknown): void {
  if (typeof value !== "string") return;
  const m = value.match(ISO_DATE);
  const v = m ? m[0] : undefined;
  if (v && !facts.dates.includes(v)) facts.dates.push(v);
}

function nameOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const n = (value as Record<string, unknown>).name;
    if (typeof n === "string") return n;
  }
  return undefined;
}

/**
 * Extract all structured data from an HTML string and distil a normalised
 * `StructuredFacts`. JSON-LD wins over microdata wins over OpenGraph wins over
 * plain meta for the singular fields (title/description/dates), reflecting how
 * reliable each source tends to be.
 */
export function extractStructuredData(html: string): StructuredData {
  const safe = typeof html === "string" ? html : "";
  const jsonLd = extractJsonLd(safe);
  const openGraph = extractOpenGraph(safe);
  const meta = extractMetaTags(safe);
  const microdata = extractMicrodata(safe);

  const facts: StructuredFacts = { dates: [], names: [], urls: [], properties: {} };

  // Definition-list / fact-table properties (feast day, patronage, dates…).
  facts.properties = extractDefinitionFacts(safe);
  for (const v of Object.values(facts.properties)) pushDate(facts, v);

  // Lowest priority first; later assignments override. Only the string-valued
  // singular fields are set here.
  const setIf = (
    key: "title" | "description" | "type" | "author" | "publisher",
    value: string | undefined,
  ) => {
    if (value && !facts[key]) facts[key] = value;
  };

  // 1. Plain + Dublin Core meta.
  setIf("description", clean(meta["description"] ?? meta["dc.description"]));
  setIf("title", clean(meta["dc.title"] ?? meta["citation_title"]));
  setIf("author", clean(meta["author"] ?? meta["dc.creator"] ?? meta["citation_author"]));
  pushDate(facts, meta["citation_publication_date"] ?? meta["dc.date"]);

  // 2. OpenGraph / article.
  setIf("title", clean(openGraph["og:title"] ?? openGraph["twitter:title"]));
  setIf("description", clean(openGraph["og:description"] ?? openGraph["twitter:description"]));
  setIf("type", openGraph["og:type"]?.toLowerCase());
  setIf("publisher", clean(openGraph["og:site_name"]));
  if (openGraph["article:published_time"]) {
    facts.datePublished = openGraph["article:published_time"].match(ISO_DATE)?.[0];
    pushDate(facts, openGraph["article:published_time"]);
  }
  if (openGraph["article:modified_time"]) {
    facts.dateModified = openGraph["article:modified_time"].match(ISO_DATE)?.[0];
    pushDate(facts, openGraph["article:modified_time"]);
  }
  if (openGraph["og:url"]) facts.urls.push(openGraph["og:url"]);

  // 3. Microdata.
  for (const item of microdata) {
    if (item.type && !facts.type) facts.type = item.type;
    const p = item.props;
    setIf("title", clean(p["name"] ?? p["headline"]));
    setIf("description", clean(p["description"]));
    pushName(facts, p["name"]);
    pushDate(facts, p["datepublished"] ?? p["birthdate"] ?? p["startdate"] ?? p["foundingdate"]);
    pushDate(facts, p["datemodified"] ?? p["deathdate"] ?? p["enddate"]);
  }

  // 4. JSON-LD (highest priority for the singular fields).
  for (const node of jsonLd) {
    if (!node || typeof node !== "object") continue;
    const o = node as Record<string, unknown>;
    const type = Array.isArray(o["@type"]) ? o["@type"][0] : o["@type"];
    if (typeof type === "string") facts.type = type.toLowerCase();
    const title = clean(o.name ?? o.headline);
    if (title) facts.title = title;
    const desc = clean(o.description);
    if (desc) facts.description = desc;
    const author = nameOf(o.author) ?? nameOf(o.creator);
    if (author) facts.author = clean(author, 200);
    const publisher = nameOf(o.publisher);
    if (publisher) facts.publisher = clean(publisher, 200);
    if (typeof o.datePublished === "string") {
      facts.datePublished = o.datePublished.match(ISO_DATE)?.[0] ?? facts.datePublished;
      pushDate(facts, o.datePublished);
    }
    if (typeof o.dateModified === "string") {
      facts.dateModified = o.dateModified.match(ISO_DATE)?.[0] ?? facts.dateModified;
      pushDate(facts, o.dateModified);
    }
    pushName(facts, o.name);
    pushName(facts, author);
    for (const k of ["birthDate", "deathDate", "startDate", "endDate", "foundingDate"]) {
      pushDate(facts, o[k]);
    }
    if (typeof o.url === "string") facts.urls.push(o.url);
    if (typeof o.sameAs === "string") facts.urls.push(o.sameAs);
    if (Array.isArray(o.sameAs)) {
      for (const u of o.sameAs) if (typeof u === "string") facts.urls.push(u);
    }
  }

  facts.urls = [...new Set(facts.urls)];
  return { jsonLd, openGraph, meta, microdata, facts };
}

/**
 * True when the facts carry any usable signal — used by callers to skip
 * enrichment entirely when a page has no structured data (the common case for
 * bare HTML), so it is a strict no-op rather than appending empty noise.
 */
export function hasStructuredFacts(facts: StructuredFacts): boolean {
  return Boolean(
    facts.title ||
    facts.description ||
    facts.type ||
    facts.author ||
    facts.publisher ||
    facts.datePublished ||
    facts.dateModified ||
    facts.dates.length ||
    facts.names.length ||
    Object.keys(facts.properties).length,
  );
}

/**
 * Render facts as a compact, labelled text block the prose extractors can read
 * as additional signal. Returns "" when there is nothing to add, so appending
 * it is a no-op on pages without structured data.
 */
export function structuredFactsToText(facts: StructuredFacts): string {
  if (!hasStructuredFacts(facts)) return "";
  const lines: string[] = ["[structured data]"];
  if (facts.title) lines.push(`Title: ${facts.title}`);
  if (facts.type) lines.push(`Type: ${facts.type}`);
  if (facts.author) lines.push(`Author: ${facts.author}`);
  if (facts.publisher) lines.push(`Publisher: ${facts.publisher}`);
  if (facts.datePublished) lines.push(`Published: ${facts.datePublished}`);
  if (facts.dateModified) lines.push(`Modified: ${facts.dateModified}`);
  if (facts.dates.length) lines.push(`Dates: ${facts.dates.join(", ")}`);
  for (const [k, v] of Object.entries(facts.properties).slice(0, 12)) {
    lines.push(`${k}: ${v}`);
  }
  if (facts.description) lines.push(`Description: ${facts.description}`);
  return lines.join("\n");
}
