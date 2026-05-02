import { fetchText } from "../../http/client";
import type {
  AdapterContext,
  AdapterResult,
  IngestedApparition,
  IngestedDevotion,
  IngestedItem,
  IngestedKind,
  IngestedParish,
  IngestedPrayer,
  IngestedSaint,
  SourceAdapter,
} from "../types";
import { extractDocument, extractApprovedLinks } from "./discovery";
import { gateUrl, isApprovedHost } from "./vatican-allowlist";
import { buildSlug, categorizeDevotion, categorizePrayer } from "./categorize";

/**
 * Adapter that walks one or more Vatican-approved index pages, follows the
 * outbound links it discovers (also restricted to the allowlist), and emits
 * IngestedItem records of a single kind.
 *
 * The adapter is resilient: if upstream is unreachable it returns an empty
 * batch instead of throwing, so the cron run records a clean SUCCESS. Per-link
 * fetch failures are simply skipped.
 */

type LinkLimit = {
  /** Max number of detail pages to fetch in a single run. */
  perRun: number;
  /** Maximum body length (chars) accepted from a single document. */
  maxBodyLength: number;
};

const DEFAULT_LIMIT: LinkLimit = {
  perRun: 25,
  maxBodyLength: 12_000,
};

export type VaticanCrawlerOptions<K extends IngestedKind> = {
  key: string;
  description: string;
  kind: K;
  /**
   * One or more allowlisted index pages — sitemaps, topic listings, or
   * curated landing pages on a Vatican-approved host.
   */
  indexUrls: string[];
  /**
   * Optional URL filter applied to discovered links *after* the allowlist
   * gate. Use to restrict to a single document tree (e.g. only follow
   * /content/.../prayers/ paths).
   */
  linkFilter?: (url: URL) => boolean;
  /** How an HTML detail document maps onto the ingested item kind. */
  toItem: (input: {
    url: string;
    linkText: string;
    title: string;
    description: string | null;
    bodyText: string;
  }) => IngestedItem | null;
  limit?: Partial<LinkLimit>;
};

function urlToExternalKey(url: string): string {
  return url;
}

function isWithinLimit(text: string, limit: LinkLimit): string {
  if (text.length <= limit.maxBodyLength) return text;
  return text.slice(0, limit.maxBodyLength);
}

async function fetchHtml(url: string): Promise<string | null> {
  const gated = gateUrl(url);
  if (!gated) return null;
  try {
    const res = await fetchText(gated);
    if (!res.ok || !res.body) return null;
    return res.body;
  } catch {
    return null;
  }
}

export function buildVaticanCrawler<K extends IngestedKind>(
  options: VaticanCrawlerOptions<K>,
): SourceAdapter {
  const limit: LinkLimit = { ...DEFAULT_LIMIT, ...options.limit };

  return {
    key: options.key,
    description: options.description,
    entityKinds: [options.kind],
    async fetch(_ctx: AdapterContext): Promise<AdapterResult> {
      const seenUrls = new Set<string>();
      const items: IngestedItem[] = [];

      for (const indexUrl of options.indexUrls) {
        if (items.length >= limit.perRun) break;
        const indexHtml = await fetchHtml(indexUrl);
        if (!indexHtml) continue;
        const links = extractApprovedLinks(indexHtml, indexUrl);
        for (const link of links) {
          if (items.length >= limit.perRun) break;
          if (seenUrls.has(link.url)) continue;
          seenUrls.add(link.url);

          let parsed: URL;
          try {
            parsed = new URL(link.url);
          } catch {
            continue;
          }
          if (!isApprovedHost(parsed.host)) continue;
          if (options.linkFilter && !options.linkFilter(parsed)) continue;

          const detailHtml = await fetchHtml(link.url);
          if (!detailHtml) continue;

          const doc = extractDocument(detailHtml);
          const title = doc.title?.trim() ?? link.text.trim();
          if (!title) continue;
          const bodyText = isWithinLimit(doc.bodyText, limit);

          const item = options.toItem({
            url: link.url,
            linkText: link.text,
            title,
            description: doc.description,
            bodyText,
          });
          if (item) items.push(item);
        }
      }

      return { items };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Kind-specific factories                                            */
/* ------------------------------------------------------------------ */

const PRAYER_PATH_HINTS = ["/prayers/", "/preghiere/", "/oraciones/", "/orationes/"];

export function buildVaticanPrayerCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.prayers",
    description: "Discovers prayers from approved Vatican sources",
    kind: "prayer",
    indexUrls: [
      "https://www.vatican.va/special/rosary/index_prayers_en.htm",
      "https://www.vatican.va/special/rosary/index_prayers_la.htm",
      "https://www.usccb.org/prayers",
    ],
    linkFilter: (u) =>
      PRAYER_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)) ||
      /prayer/i.test(u.pathname),
    toItem: ({ url, title, description, bodyText }): IngestedPrayer | null => {
      const body = bodyText || description || "";
      if (body.length < 30) return null;
      return {
        kind: "prayer",
        slug: buildSlug(title),
        defaultTitle: title,
        category: categorizePrayer({ title, body }),
        body,
        externalSourceKey: urlToExternalKey(url),
      };
    },
  });
}

const SAINT_PATH_HINTS = ["/saints/", "/santi/", "/santoral/", "/holy-see/saint"];

export function buildVaticanSaintsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.saints",
    description: "Discovers canonized saints from approved Vatican sources",
    kind: "saint",
    indexUrls: [
      "https://www.vatican.va/news_services/liturgy/saints/index_saints_en.html",
      "https://www.usccb.org/prayer-and-worship/liturgical-year/saints",
    ],
    linkFilter: (u) =>
      SAINT_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)) ||
      /saint/i.test(u.pathname) ||
      /santo/i.test(u.pathname),
    toItem: ({ url, title, description, bodyText }): IngestedSaint | null => {
      const biography = bodyText || description || "";
      if (biography.length < 40) return null;
      const canonicalName = title.replace(/\s*[-|–]\s*Vatican.*/i, "").trim();
      return {
        kind: "saint",
        slug: buildSlug(canonicalName),
        canonicalName,
        patronages: [],
        biography,
        externalSourceKey: urlToExternalKey(url),
      };
    },
  });
}

const APPARITION_PATH_HINTS = [
  "/apparition",
  "/marian",
  "/our-lady-of",
  "/madonna",
  "/aparici",
];

export function buildVaticanApparitionsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.apparitions",
    description: "Discovers approved Marian apparitions",
    kind: "apparition",
    indexUrls: [
      "https://www.vatican.va/roman_curia/congregations/cfaith/index.htm",
      "https://www.usccb.org/prayer-and-worship/devotions",
    ],
    linkFilter: (u) =>
      APPARITION_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)) ||
      /lourdes|fatima|guadalupe|akita|knock/i.test(u.pathname),
    toItem: ({ url, title, description, bodyText }): IngestedApparition | null => {
      const summary = bodyText || description || "";
      if (summary.length < 40) return null;
      return {
        kind: "apparition",
        slug: buildSlug(title),
        title,
        approvedStatus: "Approved by the Holy See",
        summary,
        externalSourceKey: urlToExternalKey(url),
      };
    },
  });
}

const DEVOTION_PATH_HINTS = ["/devotion", "/devozion", "/rosary", "/adoration", "/consecration"];

export function buildVaticanDevotionsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.devotions",
    description: "Discovers devotions and spiritual practices from Vatican sources",
    kind: "devotion",
    indexUrls: [
      "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html",
      "https://www.usccb.org/prayer-and-worship/devotions",
    ],
    linkFilter: (u) =>
      DEVOTION_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)),
    toItem: ({ url, title, description, bodyText }): IngestedDevotion | null => {
      const summary = description || bodyText.slice(0, 600) || "";
      const practiceText = bodyText.length > summary.length ? bodyText : undefined;
      if (summary.length < 30) return null;
      const cat = categorizeDevotion({ title, summary });
      return {
        kind: "devotion",
        slug: buildSlug(title, cat === "general" ? undefined : cat),
        title,
        summary,
        practiceText,
        externalSourceKey: urlToExternalKey(url),
        tagSlugs: cat === "general" ? undefined : [cat],
      };
    },
  });
}

const PARISH_PATH_HINTS = ["/parish", "/parishes", "/parroquia", "/parrocchia", "/find-a-mass"];

export function buildVaticanParishesCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.parishes",
    description: "Discovers parishes from approved Catholic conference directories",
    kind: "parish",
    indexUrls: [
      "https://www.usccb.org/find-a-parish",
    ],
    linkFilter: (u) =>
      PARISH_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)),
    toItem: ({ url, title, description }): IngestedParish | null => {
      const name = title.split("|")[0]?.trim() ?? title;
      if (!name || name.length < 3) return null;
      return {
        kind: "parish",
        slug: buildSlug(name),
        name,
        websiteUrl: url,
        externalSourceKey: urlToExternalKey(url),
        // Fields like address/city are filled later by a structured-source
        // adapter; we leave them blank here rather than guess.
        ...(description ? { diocese: description.slice(0, 120) } : {}),
      };
    },
  });
}

export function buildAllVaticanCrawlers(): SourceAdapter[] {
  return [
    buildVaticanPrayerCrawler(),
    buildVaticanSaintsCrawler(),
    buildVaticanApparitionsCrawler(),
    buildVaticanDevotionsCrawler(),
    buildVaticanParishesCrawler(),
  ];
}
