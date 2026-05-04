import { fetchText } from "../../http/client";
import type {
  AdapterContext,
  AdapterResult,
  IngestedApparition,
  IngestedDevotion,
  IngestedGuide,
  IngestedItem,
  IngestedKind,
  IngestedLiturgy,
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

const APPARITION_PATH_HINTS = ["/apparition", "/marian", "/our-lady-of", "/madonna", "/aparici"];

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
    linkFilter: (u) => DEVOTION_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)),
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
    indexUrls: ["https://www.usccb.org/find-a-parish"],
    linkFilter: (u) => PARISH_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)),
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

/**
 * Additional saint-source crawler that pulls Vatican biographies hosted on
 * Vatican-affiliated and conference-of-bishops sites that publish saint
 * profiles in English. Runs alongside the primary saints crawler so a single
 * misconfigured upstream doesn't blank the catalog.
 */
export function buildBishopsConferenceSaintsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "bishops.saints",
    description: "Saint biographies from approved bishops' conference websites",
    kind: "saint",
    indexUrls: [
      "https://www.usccb.org/prayer-and-worship/liturgical-year/saints",
      "https://www.cccb.ca/faith-moral-issues/feast-days-saints/",
      "https://www.cbcew.org.uk/home/our-faith/saints/",
    ],
    linkFilter: (u) =>
      SAINT_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)) ||
      /saint|bless/i.test(u.pathname),
    toItem: ({ url, title, description, bodyText }): IngestedSaint | null => {
      const biography = bodyText || description || "";
      if (biography.length < 80) return null;
      const canonicalName = title.replace(/\s*[-|–]\s*(USCCB|CCCB|CBCEW).*/i, "").trim();
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

/**
 * Crawler for Catholic devotional content from approved sources beyond the
 * Vatican's own site — bishops' conferences and liturgical reference sites
 * republish Vatican-approved devotional material in many languages.
 */
export function buildCatholicDevotionsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "catholic.devotions",
    description: "Devotional practices from bishops' conferences and approved liturgical sources",
    kind: "devotion",
    indexUrls: [
      "https://www.usccb.org/prayer-and-worship/devotions",
      "https://www.cbcew.org.uk/home/our-faith/devotions/",
      "https://www.cccb.ca/faith-moral-issues/devotions/",
    ],
    linkFilter: (u) => DEVOTION_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)),
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

/**
 * Prayer crawler for additional bishops'-conference republished prayers
 * (act-of-contrition, novenas, litanies) — gives the catalog more breadth
 * than the rosary-centric vatican.va tree.
 */
export function buildCatholicPrayersCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "catholic.prayers",
    description: "Prayers from bishops' conferences and approved liturgical reference",
    kind: "prayer",
    indexUrls: [
      "https://www.usccb.org/prayers",
      "https://www.cbcew.org.uk/home/our-faith/prayers/",
      "https://www.catholic.org.au/prayer/",
    ],
    linkFilter: (u) =>
      PRAYER_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)) ||
      /prayer|litany|novena/i.test(u.pathname),
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

/**
 * Catechesis / liturgy / Church history / sacrament / council content.
 *
 * Most catechetical material from the Holy See and the bishops' conferences
 * lives on a small number of stable index pages — encyclical landing pages,
 * Catechism online, the liturgy sections, and the synodal archive. We
 * narrow the path filter so only those documents become LiturgyEntry rows
 * (Christ-centred catechesis), and we let the categorize step decide
 * whether the row's `liturgyKind` is GLOSSARY, COUNCIL_TIMELINE, or GENERAL.
 */
const TEACHING_PATH_HINTS = [
  "/content/catechism",
  "/archive/cathechism",
  "/archive/catechism",
  "/holy_father",
  "/encyclicals",
  "/apost_letters",
  "/apost_exhortations",
  "/motu_proprio",
  "/liturgy",
  "/councils",
  "/synod",
  "/liturgical-year",
  "/sacraments",
  "/beliefs-and-teachings",
];

function pickLiturgyKind(input: { url: string; title: string }): IngestedLiturgy["liturgyKind"] {
  const u = input.url.toLowerCase();
  const t = input.title.toLowerCase();
  if (/council|nicaea|trent|vatican\s+i|vatican\s+ii|chalcedon|ephesus/.test(u + t)) {
    return "COUNCIL_TIMELINE";
  }
  if (/marriage|matrimony/.test(u + t)) return "MARRIAGE_RITE";
  if (/funeral|burial/.test(u + t)) return "FUNERAL_RITE";
  if (/ordin/.test(u + t)) return "ORDINATION_RITE";
  if (/liturgical[- ]year|advent|lent|christmas|easter/.test(u + t)) return "LITURGICAL_YEAR";
  if (/mass|eucharist/.test(u + t)) return "MASS_STRUCTURE";
  if (/symbol|sign|vestment/.test(u + t)) return "SYMBOLISM";
  if (/glossary|dictionary|term/.test(u + t)) return "GLOSSARY";
  return "GENERAL";
}

export function buildVaticanTeachingCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.teaching",
    description:
      "Catechetical, liturgical, sacramental and council content from the Holy See, USCCB, and bishops' conferences",
    kind: "liturgy",
    indexUrls: [
      "https://www.vatican.va/archive/ENG0015/_INDEX.HTM", // Catechism EN
      "https://www.vatican.va/holy_father/index.htm",
      "https://www.vatican.va/roman_curia/congregations/ccdds/index.htm",
      "https://www.usccb.org/beliefs-and-teachings",
      "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals",
    ],
    linkFilter: (u) =>
      TEACHING_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)) ||
      /catechism|encyclical|liturgy|council|sacrament|teaching/i.test(u.pathname),
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      return {
        kind: "liturgy",
        slug: buildSlug(title),
        liturgyKind: pickLiturgyKind({ url, title }),
        title,
        summary: description ?? undefined,
        body,
        externalSourceKey: urlToExternalKey(url),
      };
    },
  });
}

/**
 * Spiritual life guides from approved sources. Most guides on the Vatican
 * and bishops' conference sites are devotional landing pages: how to pray
 * the Rosary, how to receive Communion well, preparing for Confirmation.
 * They map naturally onto SpiritualLifeGuide rows.
 */
const GUIDE_PATH_HINTS = [
  "/how-to",
  "/guide-to",
  "/preparing",
  "/learn",
  "/spiritual-life",
  "/prayer-and-worship",
];

function pickGuideKind(input: { title: string }): IngestedGuide["guideKind"] {
  const t = input.title.toLowerCase();
  if (/rosary|rosario/.test(t)) return "ROSARY";
  if (/confession|reconciliation|penance/.test(t)) return "CONFESSION";
  if (/adoration|eucharist/.test(t)) return "ADORATION";
  if (/consecration|marian/.test(t)) return "CONSECRATION";
  if (/vocation|discern/.test(t)) return "VOCATION";
  if (/devotion|novena/.test(t)) return "DEVOTION";
  return "GENERAL";
}

export function buildVaticanGuidesCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.guides",
    description:
      "Spiritual-life guides (rosary, confession, adoration, consecration, vocation discernment) from approved Catholic sources",
    kind: "guide",
    indexUrls: [
      "https://www.usccb.org/prayer-and-worship",
      "https://www.cbcew.org.uk/home/our-faith/prayers/",
    ],
    linkFilter: (u) =>
      GUIDE_PATH_HINTS.some((p) => u.pathname.toLowerCase().includes(p)) ||
      /rosary|confession|adoration|consecration|vocation/i.test(u.pathname),
    toItem: ({ url, title, description, bodyText }): IngestedGuide | null => {
      const summary = description || bodyText.slice(0, 300) || "";
      const bodyTextOut = bodyText.length > summary.length ? bodyText : undefined;
      if (summary.length < 20) return null;
      return {
        kind: "guide",
        slug: buildSlug(title),
        guideKind: pickGuideKind({ title }),
        title,
        summary,
        bodyText: bodyTextOut,
        externalSourceKey: urlToExternalKey(url),
      };
    },
  });
}

/**
 * Church history events and ecumenical councils, persisted as LiturgyEntry
 * rows with kind COUNCIL_TIMELINE so they appear in /liturgy-history/timeline.
 * Index pages here focus on documents the Holy See itself catalogues as
 * "councils" and historical synthesis pages from bishops' conferences.
 */
export function buildVaticanHistoryCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.history",
    description:
      "Church history, ecumenical councils, and synodal archives from approved Catholic sources",
    kind: "liturgy",
    indexUrls: [
      "https://www.vatican.va/archive/hist_councils/index.htm",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/index.htm",
      "https://www.usccb.org/about/leadership/holy-see/papal-history",
    ],
    linkFilter: (u) =>
      /councils?|synod|history|papacy/i.test(u.pathname) ||
      /vatican_council|trent|nicaea|chalcedon|lateran|ephesus/i.test(u.pathname),
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      const slugBase = buildSlug(title);
      // History events go under church-history-* by convention so the
      // timeline loader picks them up.
      const slug = slugBase.startsWith("council-") ? slugBase : `church-history-${slugBase}`;
      return {
        kind: "liturgy",
        slug,
        liturgyKind: "COUNCIL_TIMELINE",
        title,
        summary: description ?? undefined,
        body,
        externalSourceKey: urlToExternalKey(url),
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
    // Newer adapters that broaden the catalog — same allowlist, additional
    // index pages on approved conference-of-bishops and liturgical sites.
    buildBishopsConferenceSaintsCrawler(),
    buildCatholicDevotionsCrawler(),
    buildCatholicPrayersCrawler(),
    // Catechetical / liturgical / sacramental / council / history / guides.
    buildVaticanTeachingCrawler(),
    buildVaticanGuidesCrawler(),
    buildVaticanHistoryCrawler(),
  ];
}
