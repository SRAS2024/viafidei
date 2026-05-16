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
import {
  extractDocument,
  extractApprovedLinks,
  extractSitemapUrls,
  isSitemapIndex,
} from "./discovery";
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
  perRun: 200,
  maxBodyLength: 12_000,
};

/**
 * Higher per-run limit reserved for parish ingestion. Parish directories
 * publish far more discrete documents than (say) the Vatican prayer index,
 * and the locator's value is roughly proportional to how many real
 * parishes we have on file — so we let each run pull more rows than the
 * conservative default.
 */
const PARISH_LIMIT: LinkLimit = {
  perRun: 600,
  maxBodyLength: 8_000,
};

/**
 * Curated Vatican-canonical prayer URLs. Every one of these is a stable
 * `vatican.va/.../prayers/...` page that publishes a single prayer text.
 * Listed by name so we can guarantee a baseline of orthodox prayers per
 * run even if every index page is unreachable or restructured.
 */
const CURATED_VATICAN_PRAYERS = [
  // Pope John Paul II's classic prayer archive (multilingual).
  "https://www.vatican.va/special/rosary/documents/hf_jp-ii_pra_19951128_act-cons-totus-tuus_en.html",
  "https://www.vatican.va/special/rosary/documents/hf_jp-ii_pra_19950416_prayer-totus-tuus_en.html",
  "https://www.vatican.va/holy_father/john_paul_ii/prayers/documents/hf_jp-ii_19990222_prayer-act-consecration_en.html",
  // Common prayers republished by USCCB at known stable URLs.
  "https://www.usccb.org/prayers/our-father",
  "https://www.usccb.org/prayers/hail-mary",
  "https://www.usccb.org/prayers/glory-be",
  "https://www.usccb.org/prayers/apostles-creed",
  "https://www.usccb.org/prayers/nicene-creed",
  "https://www.usccb.org/prayers/act-contrition",
  "https://www.usccb.org/prayers/act-faith",
  "https://www.usccb.org/prayers/act-hope",
  "https://www.usccb.org/prayers/act-love",
  "https://www.usccb.org/prayers/angelus",
  "https://www.usccb.org/prayers/regina-caeli",
  "https://www.usccb.org/prayers/come-holy-spirit",
  "https://www.usccb.org/prayers/divine-praises",
  "https://www.usccb.org/prayers/grace-before-meals",
  "https://www.usccb.org/prayers/grace-after-meals",
  "https://www.usccb.org/prayers/jesus-prayer",
  "https://www.usccb.org/prayers/litany-loreto",
  "https://www.usccb.org/prayers/litany-sacred-heart",
  "https://www.usccb.org/prayers/litany-saint-joseph",
  "https://www.usccb.org/prayers/magnificat",
  "https://www.usccb.org/prayers/memorare",
  "https://www.usccb.org/prayers/morning-offering",
  "https://www.usccb.org/prayers/prayer-saint-michael",
  "https://www.usccb.org/prayers/salve-regina",
  "https://www.usccb.org/prayers/te-deum",
  "https://www.usccb.org/prayers/veni-creator-spiritus",
];

/**
 * Curated saint biography URLs at stable USCCB / Vatican locations.
 * Used to guarantee a baseline of major-feast saints regardless of
 * upstream index-page health.
 */
const CURATED_SAINTS = [
  "https://www.usccb.org/prayer-and-worship/liturgical-year/saints",
  "https://www.vatican.va/news_services/liturgy/saints/2002/ns_lit_doc_20020616_padre-pio_en.html",
  "https://www.vatican.va/news_services/liturgy/saints/2002/ns_lit_doc_20020731_kateri-tekakwitha_en.html",
  "https://www.vatican.va/news_services/liturgy/saints/2003/ns_lit_doc_20030504_jose-maria-rubio_en.html",
];

export type VaticanCrawlerOptions<K extends IngestedKind> = {
  key: string;
  description: string;
  kind: K;
  /**
   * Index pages — sitemaps (XML), topic listings, or curated landing
   * pages. The crawler auto-detects sitemap.xml by Content-Type or root
   * <urlset> / <sitemapindex> tag and flattens it; otherwise it walks
   * anchor links.
   */
  indexUrls: string[];
  /**
   * Direct canonical URLs that bypass discovery entirely. Use for
   * well-known stable pages (e.g. the Vatican's "Anima Christi" prayer)
   * where we don't want to depend on an index page existing.
   */
  directUrls?: string[];
  /**
   * Optional URL filter applied to discovered links *after* the
   * allowlist gate. The default is permissive — the per-kind
   * `toItem` plus the global validator are the real quality gates,
   * so being too strict here just causes empty runs.
   */
  linkFilter?: (url: URL) => boolean;
  /**
   * Hints about what a useful detail page looks like, so we can skip
   * obvious non-content URLs (login pages, image files, etc.) before
   * the more expensive fetch.
   */
  rejectExtensions?: ReadonlyArray<string>;
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

const DEFAULT_REJECT_EXT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".tar",
  ".gz",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".webp",
  ".mp3",
  ".mp4",
  ".mov",
  ".css",
  ".js",
  ".xml",
];

function urlToExternalKey(url: string): string {
  return url;
}

function isWithinLimit(text: string, limit: LinkLimit): string {
  if (text.length <= limit.maxBodyLength) return text;
  return text.slice(0, limit.maxBodyLength);
}

async function fetchBody(
  url: string,
): Promise<{ body: string; contentType: string | null } | null> {
  const gated = gateUrl(url);
  if (!gated) return null;
  try {
    const res = await fetchText(gated);
    if (!res.ok || !res.body) return null;
    return { body: res.body, contentType: res.contentType };
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  const res = await fetchBody(url);
  return res?.body ?? null;
}

function pathLooksLikeAsset(pathname: string, rejectExt: ReadonlyArray<string>): boolean {
  const lower = pathname.toLowerCase();
  return rejectExt.some((ext) => lower.endsWith(ext));
}

/**
 * Read URLs out of one index page. If the response is an XML sitemap
 * (urlset or sitemapindex) the <loc> values are returned; otherwise
 * anchor hrefs are extracted from the HTML.
 *
 * Sitemap indexes are recursed one level deep — most diocesan sitemaps
 * follow that shape, and a single level keeps the crawl bounded.
 */
async function readIndexPage(indexUrl: string): Promise<string[]> {
  const res = await fetchBody(indexUrl);
  if (!res) return [];
  const looksXml =
    /\.xml(\?|$)/i.test(indexUrl) ||
    (res.contentType ?? "").toLowerCase().includes("xml") ||
    /^\s*<\?xml/i.test(res.body) ||
    /<(?:urlset|sitemapindex)\b/i.test(res.body);
  if (looksXml) {
    if (isSitemapIndex(res.body)) {
      // Recurse one level: fetch each child sitemap and flatten its URLs.
      const children = extractSitemapUrls(res.body);
      const flattened: string[] = [];
      for (const child of children.slice(0, 10)) {
        const childRes = await fetchBody(child);
        if (!childRes) continue;
        flattened.push(...extractSitemapUrls(childRes.body));
      }
      return flattened;
    }
    return extractSitemapUrls(res.body);
  }
  const links = extractApprovedLinks(res.body, indexUrl);
  return links.map((l) => l.url);
}

export function buildVaticanCrawler<K extends IngestedKind>(
  options: VaticanCrawlerOptions<K>,
): SourceAdapter {
  const limit: LinkLimit = { ...DEFAULT_LIMIT, ...options.limit };
  const rejectExt = options.rejectExtensions ?? DEFAULT_REJECT_EXT;

  return {
    key: options.key,
    description: options.description,
    entityKinds: [options.kind],
    async fetch(_ctx: AdapterContext): Promise<AdapterResult> {
      const seenUrls = new Set<string>();
      const items: IngestedItem[] = [];

      async function tryUrl(url: string, linkText = ""): Promise<void> {
        if (items.length >= limit.perRun) return;
        if (seenUrls.has(url)) return;
        seenUrls.add(url);
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return;
        }
        if (!isApprovedHost(parsed.host)) return;
        if (pathLooksLikeAsset(parsed.pathname, rejectExt)) return;
        if (options.linkFilter && !options.linkFilter(parsed)) return;

        const detailHtml = await fetchHtml(url);
        if (!detailHtml) return;
        const doc = extractDocument(detailHtml);
        const title = doc.title?.trim() ?? linkText.trim();
        if (!title) return;
        const bodyText = isWithinLimit(doc.bodyText, limit);
        const item = options.toItem({
          url,
          linkText,
          title,
          description: doc.description,
          bodyText,
        });
        if (item) items.push(item);
      }

      // First: walk every curated direct URL. These don't depend on an
      // index page being well-structured or live, so they give us a
      // guaranteed baseline of high-quality content per run.
      for (const url of options.directUrls ?? []) {
        if (items.length >= limit.perRun) break;
        await tryUrl(url);
      }

      // Then: try each index page. Sitemap-formatted indexes give us
      // every URL in a clean list; HTML indexes are scraped for anchors.
      for (const indexUrl of options.indexUrls) {
        if (items.length >= limit.perRun) break;
        const urls = await readIndexPage(indexUrl);
        for (const url of urls) {
          if (items.length >= limit.perRun) break;
          await tryUrl(url);
        }
      }

      return { items };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Kind-specific factories                                            */
/* ------------------------------------------------------------------ */

export function buildVaticanPrayerCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.prayers",
    description: "Discovers prayers from approved Vatican sources",
    kind: "prayer",
    directUrls: CURATED_VATICAN_PRAYERS,
    indexUrls: [
      // Vatican prayer indexes (Pope archives publish prayers at varied paths).
      "https://www.vatican.va/special/rosary/index_prayers_en.htm",
      "https://www.vatican.va/special/rosary/index_prayers_la.htm",
      "https://www.vatican.va/special/rosary/index_prayers_it.htm",
      "https://www.vatican.va/special/rosary/index_prayers_es.htm",
      "https://www.vatican.va/holy_father/index.htm",
      "https://www.vatican.va/holy_father/francesco/index.htm",
      "https://www.vatican.va/holy_father/benedict_xvi/index.htm",
      "https://www.vatican.va/holy_father/john_paul_ii/index.htm",
      // USCCB prayer landing pages.
      "https://www.usccb.org/prayers",
      "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/prayers",
      // Bishops'-conference prayer landing pages (each contributes a
      // different selection of localised standard prayers).
      "https://www.cbcew.org.uk/home/our-faith/prayers/",
      "https://www.cccb.ca/evangelization-catechesis-catholic-education/prayers/",
      "https://www.catholic.org.au/prayer/",
      "https://www.catholicbishops.ie/prayers/",
      // Sitemap-first discovery (XML is parsed automatically).
      "https://www.usccb.org/sitemap.xml",
      "https://www.cbcew.org.uk/sitemap.xml",
      "https://www.cccb.ca/sitemap.xml",
      "https://www.catholic.org.au/sitemap.xml",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedPrayer | null => {
      const body = bodyText || description || "";
      // Only accept pages that look like a prayer: the title or URL mentions
      // "prayer", "litany", "novena", "act of", "memorare", etc. This is a
      // cheap content-shape gate that doesn't depend on the upstream URL
      // path structure (the old linkFilter was too rigid).
      const looksLikePrayer =
        /prayer|litany|novena|act of|memorare|hail mary|our father|nicene|apostles|magnificat|te deum|veni|angelus|salve|regina|consecration|anima christi/i.test(
          title,
        ) ||
        /\/prayer|\/litany|\/novena|\/orationes|\/preghiere|\/oraciones|\/gebete|\/prieres/i.test(
          url,
        );
      if (!looksLikePrayer) return null;
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

export function buildVaticanSaintsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.saints",
    description: "Discovers canonized saints from approved Vatican sources",
    kind: "saint",
    directUrls: CURATED_SAINTS,
    indexUrls: [
      "https://www.vatican.va/news_services/liturgy/saints/index_saints_en.html",
      "https://www.vatican.va/news_services/liturgy/saints/index_saints_it.html",
      "https://www.vatican.va/news_services/liturgy/saints/ns_lit_doc_index_saints_en.html",
      "https://www.vatican.va/news_services/liturgy/2024/documents/index.htm",
      "https://www.vatican.va/news_services/liturgy/2023/documents/index.htm",
      "https://www.vatican.va/news_services/liturgy/2022/documents/index.htm",
      "https://www.vatican.va/news_services/liturgy/2021/documents/index.htm",
      "https://www.vatican.va/news_services/liturgy/2020/documents/index.htm",
      "https://www.usccb.org/prayer-and-worship/liturgical-year/saints",
      "https://www.usccb.org/prayer-and-worship/liturgical-year/saints/index.cfm",
      // Bishops' conferences and major archdioceses publish saint biographies
      // and feast-day pages. Each one contributes a different patron-focus.
      "https://www.cccb.ca/faith-moral-issues/feast-days-saints/",
      "https://www.cbcew.org.uk/home/our-faith/saints/",
      "https://www.catholic.org.au/saints",
      "https://www.catholicbishops.ie/saints/",
      "https://www.archny.org/news/saints",
      "https://www.rcab.org/news/category/saints/",
      "https://www.archchicago.org/saints",
      "https://www.archphila.org/saints/",
      // Reference works and religious orders republish biographies in
      // depth — sitemap-first discovery flattens their full archives.
      "https://www.ewtn.com/sitemap.xml",
      "https://www.catholicculture.org/sitemap.xml",
      "https://www.newadvent.org/cathen/index.html",
      "https://www.catholic.com/sitemap.xml",
      "https://www.osv.com/sitemap.xml",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedSaint | null => {
      const biography = bodyText || description || "";
      if (biography.length < 40) return null;
      // Content-shape gate: title or URL must look like a saint biography.
      const looksLikeSaint =
        /\b(saint|st\.?|santo|santa|san|blessed|beata|beato|martyr|pope)\b/i.test(title) ||
        /\/saint|\/santi|\/santoral|\/holy-see\/saint|\/blessed/i.test(url);
      if (!looksLikeSaint) return null;
      const canonicalName = title.replace(/\s*[-|–]\s*(Vatican|USCCB|CCCB|EWTN).*/i, "").trim();
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

export function buildVaticanApparitionsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.apparitions",
    description: "Discovers approved Marian apparitions",
    kind: "apparition",
    indexUrls: [
      "https://www.vatican.va/roman_curia/congregations/cfaith/index.htm",
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/index.htm",
      "https://www.usccb.org/prayer-and-worship/devotions",
      "https://www.usccb.org/prayer-and-worship/devotions/marian-devotions",
      "https://www.cbcew.org.uk/home/our-faith/devotions/our-lady/",
      "https://www.cccb.ca/faith-moral-issues/feast-days-saints/",
      // Approved Marian-shrine websites: each is the canonical record
      // for one apparition site, so a single page on the shrine's home
      // already passes the Marian-vocabulary validator.
      "https://www.lourdes-france.org/",
      "https://www.fatima.pt/",
      "https://www.knock-shrine.ie/",
      "https://www.virgendeguadalupe.org.mx/",
      "https://basilica.mxv.mx/",
      "https://www.czestochowa.pl/",
      "https://www.jasnagora.pl/",
      "https://www.lasaletteshrine.org/",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedApparition | null => {
      const summary = bodyText || description || "";
      if (summary.length < 40) return null;
      const looksLikeApparition =
        /our lady|virgin|marian|apparition|madonna|nuestra señora|lourdes|fatima|guadalupe|akita|knock|la salette|banneux|beauraing|kibeho|champion/i.test(
          title,
        ) || /our-lady|apparition|marian|madonna|lourdes|fatima|guadalupe|akita|knock/i.test(url);
      if (!looksLikeApparition) return null;
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

export function buildVaticanDevotionsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.devotions",
    description: "Discovers devotions and spiritual practices from Vatican sources",
    kind: "devotion",
    indexUrls: [
      "https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html",
      "https://www.vatican.va/roman_curia/congregations/ccdds/documents/index.htm",
      "https://www.usccb.org/prayer-and-worship/devotions",
      "https://www.usccb.org/prayer-and-worship/devotions/eucharistic-devotion",
      "https://www.usccb.org/prayer-and-worship/devotions/rosary",
      "https://www.cbcew.org.uk/home/our-faith/devotions/",
      // Approved Marian Fathers / Divine Mercy devotional archives.
      "https://www.thedivinemercy.org/message/devotions",
      "https://www.marian.org/divinemercy/",
      // Religious orders publish characteristic devotions (Brown Scapular,
      // Sacred Heart, etc.) — each surface is allowlisted.
      "https://www.dominicans.org/prayers/",
      "https://www.franciscan.org/prayers/",
      "https://www.carmelites.com/prayers/",
      "https://www.jesuits.org/spirituality/",
    ],
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

export function buildVaticanParishesCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.parishes",
    description: "Discovers parishes from approved Catholic conference and diocesan directories",
    kind: "parish",
    // Pull from a diverse set of bishops' conferences and major archdiocesan
    // directories so the catalog isn't bottlenecked by USCCB alone. Each
    // archdiocese publishes its own listing pages and the union covers a
    // wide geographic spread.
    indexUrls: [
      "https://www.usccb.org/find-a-parish",
      "https://www.usccb.org/about/leadership/holy-see/index.cfm",
      "https://www.cccb.ca/dioceses-and-bishops/",
      "https://www.cbcew.org.uk/home/about-the-church/dioceses-and-bishops/",
      "https://www.catholic.org.au/dioceses",
      "https://www.archny.org/parishes/",
      "https://www.archchicago.org/parishes",
      "https://www.rcab.org/find-a-parish/",
      "https://www.archmil.org/Parishes.htm",
      "https://www.rcdow.org.uk/diocese/find-a-church/",
      "https://www.lacatholics.org/parishes/",
      "https://www.archphila.org/parishes/",
      "https://www.archatl.com/parishes/",
      "https://www.archbalt.org/find-a-parish/",
      "https://www.archstl.org/parishes",
      "https://www.archden.org/parish-locator/",
      "https://www.miamiarch.org/Parishes.php",
      "https://www.archsa.org/parishes-locator",
      "https://www.sfarchdiocese.org/parishes/",
      "https://www.seattlearchdiocese.org/find-a-parish/",
      "https://www.archtoronto.org/find-a-parish/",
      "https://www.diomelb.org.au/our-diocese/parishes",
      "https://www.sydneycatholic.org/parishes/",
      "https://www.dublindiocese.ie/parishes-of-the-diocese/",
      // Additional approved diocesan directories — broaden geographic
      // coverage so the 20k-parish target can be reached without leaning
      // on any one upstream.
      "https://www.dphx.org/parishes/",
      "https://www.dosp.org/parishes/",
      "https://www.dioceseoftrenton.org/parishes",
      "https://www.dioceseofbrooklyn.org/parishes/",
      "https://www.rcdony.org/parishes",
      "https://www.archomaha.org/parishes/",
      "https://www.archindy.org/parishes",
      "https://www.archdpdx.org/parishes",
      "https://www.archkck.org/parishes",
      // National / international Catholic parish-locator aggregators that
      // republish bishops'-conference data:
      "https://www.parishesonline.com/find-a-parish",
      "https://masstimes.org/",
      "https://www.thecatholicdirectory.com/",
      "https://gcatholic.org/dioceses/",
      "https://www.catholic-hierarchy.org/",
      // Sitemap-first discovery on every diocesan site that publishes one.
      "https://www.archny.org/sitemap.xml",
      "https://www.archchicago.org/sitemap.xml",
      "https://www.archphila.org/sitemap.xml",
      "https://www.archbalt.org/sitemap.xml",
      "https://www.archstl.org/sitemap.xml",
      "https://www.archden.org/sitemap.xml",
      "https://www.archomaha.org/sitemap.xml",
      "https://www.archindy.org/sitemap.xml",
      // Additional approved diocesan + archdiocesan sitemaps (US, UK,
      // Australia, Ireland, Germany, Poland). Each one flattens
      // hundreds-to-thousands of parish entries through the
      // sitemap-index recursion.
      "https://www.archatl.com/sitemap.xml",
      "https://www.miamiarch.org/sitemap.xml",
      "https://www.archsa.org/sitemap.xml",
      "https://www.sfarchdiocese.org/sitemap.xml",
      "https://www.seattlearchdiocese.org/sitemap.xml",
      "https://www.archtoronto.org/sitemap.xml",
      "https://www.lacatholics.org/sitemap.xml",
      "https://www.rcab.org/sitemap.xml",
      "https://www.archmil.org/sitemap.xml",
      "https://www.dphx.org/sitemap.xml",
      "https://www.dosp.org/sitemap.xml",
      "https://www.dioceseoftrenton.org/sitemap.xml",
      "https://www.dioceseofbrooklyn.org/sitemap.xml",
      "https://www.rcdony.org/sitemap.xml",
      "https://www.archdpdx.org/sitemap.xml",
      "https://www.archkck.org/sitemap.xml",
      "https://www.adw.org/sitemap.xml",
      "https://www.aod.org/sitemap.xml",
      "https://www.archdioceseofhartford.org/sitemap.xml",
      "https://www.rcan.org/sitemap.xml",
      "https://www.diopitt.org/sitemap.xml",
      "https://www.dioceseofcleveland.org/sitemap.xml",
      "https://www.catholicaoc.org/sitemap.xml",
      "https://www.archgh.org/sitemap.xml",
      "https://www.sdcatholic.org/sitemap.xml",
      "https://www.catholichawaii.org/sitemap.xml",
      "https://www.scd.org/sitemap.xml",
      "https://www.dolr.org/sitemap.xml",
      "https://www.richmonddiocese.org/sitemap.xml",
      "https://www.diocesseofcc.org/sitemap.xml",
      "https://www.raleighdiocese.org/sitemap.xml",
      "https://www.dosma.org/sitemap.xml",
      // UK
      "https://www.rcdow.org.uk/sitemap.xml",
      "https://www.rcdea.org.uk/sitemap.xml",
      // Australia & Ireland
      "https://www.diomelb.org.au/sitemap.xml",
      "https://www.sydneycatholic.org/sitemap.xml",
      "https://www.dublindiocese.ie/sitemap.xml",
      // Germany & Austria
      "https://www.erzbistumberlin.de/sitemap.xml",
      "https://www.erzbistum-muenchen.de/sitemap.xml",
      "https://www.erzbistum-koeln.de/sitemap.xml",
      "https://www.kirchen.net/sitemap.xml",
      "https://www.erzdioezese-wien.at/sitemap.xml",
      // Poland
      "https://www.diecezja.pl/sitemap.xml",
      "https://www.diecezja.krakow.pl/sitemap.xml",
      "https://www.diecezja.warszawa.pl/sitemap.xml",
      "https://www.kuria.lublin.pl/sitemap.xml",
      // Spain & Italy
      "https://www.archimadrid.es/sitemap.xml",
      "https://www.diocesimilano.it/sitemap.xml",
      "https://www.diocesedeparis.fr/sitemap.xml",
      // Latin America
      "https://www.arquisp.org.br/sitemap.xml",
      "https://www.arqrio.org/sitemap.xml",
      "https://www.arzbaires.org.ar/sitemap.xml",
    ],
    toItem: ({ url, title, description }): IngestedParish | null => {
      const name = sanitizeParishName(title);
      if (!name || name.length < 3) return null;
      // Reject obvious non-parish navigation/landing pages.
      if (/^(find|search|locate|browse|all)\s+(a\s+)?paris/i.test(name)) return null;
      if (/locator|directory|listing/i.test(name)) return null;
      // Content-shape gate (replaces the old linkFilter): require the URL
      // path OR the title to look like an individual parish/church page.
      // A diocesan home page or news article won't pass this.
      const looksLikeParish =
        /\/parish|\/parroquia|\/parrocchia|\/paroisse|\/find-a|\/our-paris|\/directory|\/church/i.test(
          url,
        ) ||
        /\b(saint|st\.?|holy|sacred|our lady|cathedral|basilica|chapel|parish|church)\b/i.test(
          name,
        );
      if (!looksLikeParish) return null;
      const dioceseFromHost = inferDioceseFromHost(url);
      return {
        kind: "parish",
        slug: buildSlug(name),
        name,
        websiteUrl: url,
        externalSourceKey: urlToExternalKey(url),
        ...(dioceseFromHost
          ? { diocese: dioceseFromHost }
          : description
            ? { diocese: description.slice(0, 120) }
            : {}),
      };
    },
    limit: PARISH_LIMIT,
  });
}

/**
 * Strip common boilerplate from parish-page titles. Many archdiocesan
 * sites pad titles with their own brand suffix (" | Archdiocese of X"),
 * which would otherwise distort dedup and search.
 */
function sanitizeParishName(rawTitle: string): string {
  const firstSegment = rawTitle.split(/\s*[|•·–]\s*/)[0]?.trim() ?? rawTitle;
  return firstSegment
    .replace(/\s*-\s*Archdiocese.*$/i, "")
    .replace(/\s*-\s*Diocese of.*$/i, "")
    .replace(/^(Parish:|Church:)\s*/i, "")
    .trim();
}

const HOST_DIOCESE_MAP: ReadonlyArray<{ pattern: RegExp; diocese: string }> = [
  { pattern: /archny\.org/i, diocese: "Archdiocese of New York" },
  { pattern: /archchicago\.org/i, diocese: "Archdiocese of Chicago" },
  { pattern: /rcab\.org/i, diocese: "Archdiocese of Boston" },
  { pattern: /archmil\.org/i, diocese: "Archdiocese of Milwaukee" },
  { pattern: /rcdow\.org\.uk/i, diocese: "Archdiocese of Westminster" },
  { pattern: /lacatholics\.org|rcaola\.org/i, diocese: "Archdiocese of Los Angeles" },
  { pattern: /archphila\.org/i, diocese: "Archdiocese of Philadelphia" },
  { pattern: /archatl\.com/i, diocese: "Archdiocese of Atlanta" },
  { pattern: /archbalt\.org/i, diocese: "Archdiocese of Baltimore" },
  { pattern: /archstl\.org/i, diocese: "Archdiocese of Saint Louis" },
  { pattern: /archden\.org/i, diocese: "Archdiocese of Denver" },
  { pattern: /miamiarch\.org/i, diocese: "Archdiocese of Miami" },
  { pattern: /archsa\.org/i, diocese: "Archdiocese of San Antonio" },
  { pattern: /sfarchdiocese\.org/i, diocese: "Archdiocese of San Francisco" },
  { pattern: /seattlearchdiocese\.org/i, diocese: "Archdiocese of Seattle" },
  { pattern: /archtoronto\.org/i, diocese: "Archdiocese of Toronto" },
  { pattern: /diomelb\.org\.au/i, diocese: "Archdiocese of Melbourne" },
  { pattern: /sydneycatholic\.org/i, diocese: "Archdiocese of Sydney" },
  { pattern: /dublindiocese\.ie/i, diocese: "Archdiocese of Dublin" },
];

function inferDioceseFromHost(url: string): string | null {
  for (const entry of HOST_DIOCESE_MAP) {
    if (entry.pattern.test(url)) return entry.diocese;
  }
  return null;
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
      "https://www.catholic.org.au/saints",
      "https://www.catholicbishops.ie/saints/",
      "https://www.archny.org/news/saints",
      "https://www.rcab.org/news/category/saints/",
      "https://www.archchicago.org/saints",
      // Bishops' conferences worldwide — each publishes patronal-saint
      // pages and feast-day catechesis. Names listed here are all in
      // the allowlist so gateUrl() accepts them at fetch time.
      "https://www.catholic.org.nz/about-us/saints/",
      "https://www.cbcp.net/saints/",
      "https://www.sacbc.org.za/saints/",
      "https://www.cbcindia.com/saints/",
      "https://www.dbk.de/glaube/heilige",
      "https://www.conferenciaepiscopal.es/santoral/",
      "https://www.chiesacattolica.it/santi/",
      "https://www.eglise.catholique.fr/approfondir-sa-foi/figures-de-saintete/",
      "https://www.episcopado.pt/santos/",
      "https://www.episkopat.pl/swieci/",
      "https://www.cnbb.org.br/santos/",
      "https://www.celam.org/santos/",
      // Major archdioceses with saint catechesis pages.
      "https://www.archphila.org/sitemap.xml",
      "https://www.archatl.com/sitemap.xml",
      "https://www.archbalt.org/sitemap.xml",
      "https://www.archstl.org/sitemap.xml",
      "https://www.lacatholics.org/sitemap.xml",
      "https://www.archtoronto.org/sitemap.xml",
      "https://www.sydneycatholic.org/sitemap.xml",
      "https://www.dublindiocese.ie/sitemap.xml",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedSaint | null => {
      const biography = bodyText || description || "";
      if (biography.length < 80) return null;
      const looksLikeSaint =
        /\b(saint|st\.?|santo|santa|san|blessed|beata|beato|martyr|pope|venerable)\b/i.test(
          title,
        ) || /\/saint|\/santi|\/santoral|\/blessed/i.test(url);
      if (!looksLikeSaint) return null;
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
      "https://www.catholic.org.au/devotions",
      "https://www.catholicbishops.ie/devotions/",
      "https://www.usccb.org/prayer-and-worship/devotions/eucharistic-devotion",
      "https://www.usccb.org/prayer-and-worship/devotions/marian-devotions",
      "https://www.cbcew.org.uk/home/our-faith/devotions/our-lady/",
      "https://www.cbcew.org.uk/home/our-faith/devotions/eucharistic-devotion/",
      // Bishops' conferences worldwide that publish localised devotional
      // catechesis (Sacred Heart, Brown Scapular, First Friday, etc.).
      "https://www.catholic.org.nz/about-us/devotional-life/",
      "https://www.cbcp.net/devotions/",
      "https://www.dbk.de/glaube/gebet-und-frommigkeit/",
      "https://www.conferenciaepiscopal.es/devociones/",
      "https://www.chiesacattolica.it/preghiere/",
      "https://www.eglise.catholique.fr/approfondir-sa-foi/la-priere/",
      "https://www.episkopat.pl/modlitwy/",
      "https://www.cnbb.org.br/devocoes/",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedDevotion | null => {
      const summary = description || bodyText.slice(0, 600) || "";
      const practiceText = bodyText.length > summary.length ? bodyText : undefined;
      if (summary.length < 30) return null;
      const looksLikeDevotion =
        /\b(devotion|rosary|adoration|consecration|novena|chaplet|stations|sacred heart|divine mercy|first friday|first saturday|brown scapular|miraculous medal)\b/i.test(
          title,
        ) ||
        /\/devotion|\/devozion|\/rosary|\/adoration|\/consecration|\/novena|\/chaplet/i.test(url);
      if (!looksLikeDevotion) return null;
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
      "https://www.catholicbishops.ie/prayers/",
      "https://www.cccb.ca/evangelization-catechesis-catholic-education/prayers/",
      "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/prayers/index.cfm",
      "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/prayers/prayers-of-catholics.cfm",
      // Worldwide bishops' conferences (allowlisted) — gives the prayer
      // catalog multilingual breadth.
      "https://www.catholic.org.nz/about-us/prayers/",
      "https://www.cbcp.net/prayers/",
      "https://www.sacbc.org.za/prayers/",
      "https://www.dbk.de/glaube/gebete",
      "https://www.conferenciaepiscopal.es/oraciones/",
      "https://www.chiesacattolica.it/preghiere-cristiane/",
      "https://www.eglise.catholique.fr/approfondir-sa-foi/la-priere/prieres/",
      "https://www.episcopado.pt/oracoes/",
      "https://www.episkopat.pl/modlitwy/",
      "https://www.cnbb.org.br/oracoes/",
      "https://www.katolsk.no/boenneliv",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedPrayer | null => {
      const body = bodyText || description || "";
      if (body.length < 30) return null;
      const looksLikePrayer =
        /prayer|litany|novena|act of|memorare|hail mary|our father|nicene|apostles|magnificat|te deum|veni|angelus|salve|regina|anima christi/i.test(
          title,
        ) || /\/prayer|\/litany|\/novena|\/orationes|\/preghiere|\/oraciones/i.test(url);
      if (!looksLikePrayer) return null;
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
 * Additional credible-Catholic prayer crawler — covers approved Catholic
 * reference and publishing sites (EWTN, Catholic Culture, Knights of
 * Columbus, religious orders) so the prayer catalog grows past what's
 * available on bishops'-conference sites alone. Each upstream is in the
 * source allowlist; non-allowlisted hosts are rejected at fetch time.
 */
export function buildCredibleCatholicPrayersCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "credible.prayers",
    description: "Prayers from credible Catholic publishing, religious-order and reference sites",
    kind: "prayer",
    indexUrls: [
      "https://www.ewtn.com/catholicism/devotions",
      "https://www.ewtn.com/catholicism/prayers",
      "https://www.catholicculture.org/culture/library/prayers/",
      "https://www.kofc.org/en/news-room/articles/prayers.html",
      "https://www.thedivinemercy.org/message/devotions",
      "https://www.marian.org/divinemercy/",
      "https://www.dominicans.org/prayers/",
      "https://www.franciscan.org/prayers/",
      "https://www.jesuits.org/spirituality/",
      "https://www.salesians.org/prayer-life",
      "https://www.carmelites.com/prayers/",
      "https://www.redemptorists.com/prayer-and-worship/",
      "https://www.osv.com/category/prayer/",
      "https://www.catholic.com/prayers",
      // Additional approved religious-order prayer archives.
      "https://www.augustinian.org/prayers",
      "https://www.benedictine.org/prayers",
      "https://www.passionist.org/prayers/",
      "https://www.vincentians.org/prayer/",
      "https://www.norbertines.org/prayers/",
      "https://www.carmelitefriars.org/prayers/",
      "https://www.trappist.net/prayers/",
      "https://www.fathersofmercy.com/prayers",
      // Catholic reference + publishing houses' prayer pages.
      "https://www.wordonfire.org/articles/prayers/",
      "https://www.ascensionpress.com/blogs/main/tagged/prayer",
      "https://www.ignatius.com/prayers/",
      "https://www.sophiainstitute.com/prayers/",
      "https://www.tanbooks.com/prayers/",
      "https://www.scepterpublishers.org/prayers/",
      // Sitemap-first discovery on the busiest of these.
      "https://www.ewtn.com/sitemap.xml",
      "https://www.catholicculture.org/sitemap.xml",
      "https://www.catholic.com/sitemap.xml",
      "https://www.wordonfire.org/sitemap.xml",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedPrayer | null => {
      const body = bodyText || description || "";
      if (body.length < 30) return null;
      const looksLikePrayer =
        /prayer|litany|novena|act of|memorare|hail mary|our father|nicene|apostles|magnificat|te deum|veni|angelus|salve|regina/i.test(
          title,
        ) || /\/prayer|\/litany|\/novena|\/orationes|\/preghiere|\/oraciones|\/devotion/i.test(url);
      if (!looksLikePrayer) return null;
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
 * Additional saint-biography crawler — religious-order and Catholic
 * reference sites that publish founders' biographies and feast-day
 * profiles (Dominicans, Franciscans, etc.). Helps the saints catalog
 * reach the 1,000-row target without leaning on any single upstream.
 */
export function buildCredibleCatholicSaintsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "credible.saints",
    description: "Saint biographies from credible Catholic reference and religious-order sites",
    kind: "saint",
    indexUrls: [
      "https://www.ewtn.com/catholicism/saints",
      "https://www.catholicculture.org/culture/liturgicalyear/calendar/",
      "https://www.dominicans.org/our-saints/",
      "https://www.franciscan.org/saints/",
      "https://www.jesuits.org/spirituality/saints-blesseds/",
      "https://www.salesians.org/saints",
      "https://www.carmelites.com/saints-blesseds/",
      "https://www.redemptorists.com/saints-and-blessed/",
      "https://www.osv.com/category/saints/",
      "https://www.catholic.com/encyclopedia/saints",
      "https://www.newadvent.org/cathen/13347a.htm", // New Advent: index of saints
      // Additional approved religious-order founder + martyr archives.
      "https://www.augustinian.org/saints",
      "https://www.benedictine.org/saints",
      "https://www.passionist.org/saints/",
      "https://www.vincentians.org/saints/",
      "https://www.norbertines.org/saints/",
      "https://www.carmelitefriars.org/saints/",
      "https://www.trappist.net/saints/",
      "https://www.ocist.org/saints/",
      // Approved Catholic reference / publishing pages.
      "https://www.wordonfire.org/articles/saints/",
      "https://www.ignatius.com/saints/",
      "https://www.sophiainstitute.com/saints/",
      "https://www.tanbooks.com/saints/",
      // Sitemap-first discovery for these major reference sites.
      "https://www.ewtn.com/sitemap.xml",
      "https://www.catholicculture.org/sitemap.xml",
      "https://www.osv.com/sitemap.xml",
      "https://www.wordonfire.org/sitemap.xml",
      "https://www.thecatholicthing.org/sitemap.xml",
      "https://www.ncregister.com/sitemap.xml",
      "https://www.catholicnewsagency.com/sitemap.xml",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedSaint | null => {
      const biography = bodyText || description || "";
      if (biography.length < 80) return null;
      const looksLikeSaint =
        /\b(saint|st\.?|santo|santa|san|blessed|beata|beato|martyr|pope|venerable|servant of god)\b/i.test(
          title,
        ) || /\/saint|\/santi|\/santoral|\/blessed|\/martyr/i.test(url);
      if (!looksLikeSaint) return null;
      const canonicalName = title
        .replace(/\s*[-|–]\s*(EWTN|Catholic Culture|OSV|New Advent).*/i, "")
        .replace(/^Saint\s+/i, "Saint ")
        .trim();
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
 * Catechesis / liturgy / Church history / sacrament / council content.
 *
 * Most catechetical material from the Holy See and the bishops' conferences
 * lives on a small number of stable index pages — encyclical landing pages,
 * Catechism online, the liturgy sections, and the synodal archive. We
 * narrow the path filter so only those documents become LiturgyEntry rows
 * (Christ-centred catechesis), and we let the categorize step decide
 * whether the row's `liturgyKind` is GLOSSARY, COUNCIL_TIMELINE, or GENERAL.
 */
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
      "https://www.vatican.va/archive/ITA0014/_INDEX.HTM", // Catechism IT
      "https://www.vatican.va/archive/ESL0506/_INDEX.HTM", // Catechism ES
      "https://www.vatican.va/holy_father/index.htm",
      "https://www.vatican.va/holy_father/francesco/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/francesco/apost_exhortations/index.htm",
      "https://www.vatican.va/holy_father/francesco/messages/index.htm",
      "https://www.vatican.va/holy_father/benedict_xvi/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/benedict_xvi/apost_exhortations/index.htm",
      "https://www.vatican.va/holy_father/john_paul_ii/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/john_paul_ii/apost_exhortations/index.htm",
      "https://www.vatican.va/roman_curia/congregations/ccdds/index.htm",
      "https://www.vatican.va/roman_curia/congregations/cfaith/documents/index.htm",
      "https://www.vatican.va/roman_curia/congregations/cclergy/index.htm",
      "https://www.usccb.org/beliefs-and-teachings",
      "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals",
      "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/marriage",
      "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/baptism",
      "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/eucharist",
      "https://www.usccb.org/prayer-and-worship/sacraments-and-sacramentals/penance",
      "https://www.cbcew.org.uk/home/our-faith/sacraments/",
      "https://www.cccb.ca/sacraments/",
      // Reference works the validator can accept as Catholic teaching:
      // each is on the allowlist so gateUrl() lets them through.
      "https://www.newadvent.org/cathen/",
      "https://www.catholicculture.org/culture/library/",
      "https://www.catholic.com/encyclopedia",
      "https://www.wordonfire.org/articles/teaching/",
      "https://www.ascensionpress.com/blogs/main/tagged/teaching",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      const looksLikeTeaching =
        /catechism|encyclical|liturgy|council|sacrament|teaching|mass|eucharist|baptism|confirmation|matrimony|holy orders|anointing|reconciliation|advent|lent|christmas|easter|paschal/i.test(
          title,
        ) || /catechism|encyclical|liturgy|council|sacrament|teaching|apost_/i.test(url);
      if (!looksLikeTeaching) return null;
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
      "https://www.usccb.org/prayer-and-worship/prayers-and-devotions/rosaries/index.cfm",
      "https://www.usccb.org/committees/divine-worship",
      "https://www.cccb.ca/evangelization-catechesis-catholic-education/",
      "https://www.catholic.org.au/faith",
      "https://www.cbcew.org.uk/home/our-faith/the-mass/",
      // Approved Marian Fathers / Divine Mercy guides on Confession,
      // Adoration, Marian consecration.
      "https://www.thedivinemercy.org/message/devotions",
      "https://www.marian.org/divinemercy/",
      // Catholic publishing houses publish "how to" spiritual guides
      // for the laity (Rosary, Confession, Adoration, Discernment).
      "https://www.osv.com/category/devotional/",
      "https://www.ascensionpress.com/blogs/main/tagged/prayer-guide",
      "https://www.sophiainstitute.com/spiritual-life/",
      "https://www.wordonfire.org/articles/devotion/",
      // Vocation discernment archives from approved religious orders.
      "https://www.discalcedcarmelitevocations.com/",
      "https://www.dominicans.org/vocations/",
      "https://www.franciscan.org/vocations/",
      "https://www.jesuits.org/vocations/",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedGuide | null => {
      const summary = description || bodyText.slice(0, 300) || "";
      const bodyTextOut = bodyText.length > summary.length ? bodyText : undefined;
      if (summary.length < 20) return null;
      const looksLikeGuide =
        /rosary|confession|reconciliation|penance|adoration|consecration|vocation|how to|guide|preparing|examination of conscience|spiritual/i.test(
          title,
        ) ||
        /rosary|confession|adoration|consecration|vocation|\/how-to|\/guide|\/spiritual/i.test(url);
      if (!looksLikeGuide) return null;
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
      "https://www.vatican.va/archive/hist_councils/i_vatican_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/trent/index.htm",
      "https://www.vatican.va/archive/hist_councils/v_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/iv_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/iii_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/ii_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/i_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/florence/index.htm",
      "https://www.vatican.va/archive/hist_councils/constance/index.htm",
      "https://www.vatican.va/holy_father/index.htm",
      "https://www.usccb.org/about/leadership/holy-see/papal-history",
      "https://www.usccb.org/about/leadership/holy-see/index.cfm",
      // Catholic reference works that publish council / papacy
      // summaries — all allowlisted.
      "https://www.newadvent.org/cathen/04423f.htm", // councils overview
      "https://www.catholicculture.org/culture/library/view.cfm",
      "https://www.catholic-hierarchy.org/",
      "https://www.gcatholic.org/dioceses/",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      const looksLikeHistory =
        /council|synod|nicaea|chalcedon|ephesus|trent|lateran|vatican i|vatican ii|history|pope|pontiff/i.test(
          title,
        ) ||
        /councils?|synod|history|papacy|vatican_council|trent|nicaea|chalcedon|lateran|ephesus/i.test(
          url,
        );
      if (!looksLikeHistory) return null;
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

/**
 * Dedicated crawler for Vatican Council documents. Walks every council
 * archive on vatican.va and stores each conciliar document as a
 * LiturgyEntry with slug prefix `council-` so the admin backlog
 * counter (Church Documents bucket) picks it up. The slug also lets
 * the history timeline group documents under their council heading.
 *
 * Index pages here are the council root directories plus the per-section
 * documents pages where actual conciliar texts live (Lumen Gentium,
 * Sacrosanctum Concilium, etc.).
 */
export function buildVaticanCouncilsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.councils",
    description: "Documents of the ecumenical councils (Trent, Vatican I, Vatican II, etc.)",
    kind: "liturgy",
    directUrls: [
      // Vatican II — the four constitutions, nine decrees, three declarations.
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19631204_sacrosanctum-concilium_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651207_gaudium-et-spes_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19641121_unitatis-redintegratio_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19641121_orientalium-ecclesiarum_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651028_christus-dominus_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651028_perfectae-caritatis_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651028_optatam-totius_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651207_presbyterorum-ordinis_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651207_ad-gentes_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19651118_apostolicam-actuositatem_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decree_19641204_inter-mirifica_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_gravissimum-educationis_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651028_nostra-aetate_en.html",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_decl_19651207_dignitatis-humanae_en.html",
    ],
    indexUrls: [
      "https://www.vatican.va/archive/hist_councils/index.htm",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/index.htm",
      "https://www.vatican.va/archive/hist_councils/i_vatican_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/i_vatican_council/documents/index.htm",
      "https://www.vatican.va/archive/hist_councils/trent/index.htm",
      "https://www.vatican.va/archive/hist_councils/v_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/iv_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/iii_lateran_council/index.htm",
      "https://www.vatican.va/archive/hist_councils/lyon/index.htm",
      "https://www.vatican.va/archive/hist_councils/florence/index.htm",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      // Council documents share the conciliar URL pattern
      // /archive/hist_councils/<council>/documents/<doc>_en.html.
      // Accept anything inside hist_councils OR whose title matches a
      // known conciliar text.
      const looksConciliar =
        /\/archive\/hist_councils\//i.test(url) ||
        /(lumen gentium|gaudium et spes|sacrosanctum concilium|dei verbum|unitatis|orientalium|christus dominus|perfectae caritatis|optatam totius|presbyterorum|ad gentes|apostolicam|inter mirifica|gravissimum|nostra aetate|dignitatis humanae|council of)/i.test(
          title,
        );
      if (!looksConciliar) return null;
      const slugBase = buildSlug(title) || buildSlug(url);
      const slug = slugBase.startsWith("council-") ? slugBase : `council-${slugBase}`;
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

/**
 * Dedicated crawler for the full Catechism of the Catholic Church. The
 * canonical English text lives at
 *   https://www.vatican.va/archive/ENG0015/__P[N].HTM
 * with a paginated structure of hundreds of paragraph-range pages. We
 * walk the index and let each detail page produce a LiturgyEntry with
 * slug prefix `catechism-` for the backlog counter.
 */
export function buildVaticanCatechismCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.catechism",
    description: "The Catechism of the Catholic Church (full text by paragraph range)",
    kind: "liturgy",
    indexUrls: [
      "https://www.vatican.va/archive/ENG0015/_INDEX.HTM", // EN
      "https://www.vatican.va/archive/ITA0014/_INDEX.HTM", // IT
      "https://www.vatican.va/archive/ESL0506/_INDEX.HTM", // ES
      "https://www.vatican.va/archive/compendium_ccc/documents/archive_2005_compendium-ccc_en.html",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      // The CCC index links out to per-section pages at /archive/ENG0015/__P*.HTM.
      // Accept anything in that path.
      const inCatechism = /\/archive\/(ENG0015|ITA0014|ESL0506|compendium_ccc)\//i.test(url);
      if (!inCatechism) return null;
      const slugBase = buildSlug(title) || buildSlug(url);
      const slug = slugBase.startsWith("catechism-") ? slugBase : `catechism-${slugBase}`;
      return {
        kind: "liturgy",
        slug,
        liturgyKind: "GLOSSARY",
        title,
        summary: description ?? undefined,
        body,
        externalSourceKey: urlToExternalKey(url),
      };
    },
  });
}

/**
 * Dedicated crawler for the full Code of Canon Law (CIC, 1983) and the
 * Code of Canons of the Eastern Churches (CCEO, 1990). Both codes are
 * published canonically by the Holy See in stable archive paths:
 *   • /archive/cod-iuris-canonici/eng/documents/...  (Latin Church, EN)
 *   • /archive/cod-iuris-canonici/ita/documents/...  (Latin Church, IT)
 *   • /archive/cod-iuris-canonici/esp/documents/...  (Latin Church, ES)
 *   • /archive/cod-iuris-canonici/cic_index_lt.html  (Latin original)
 *   • /archive/ENG1104/_INDEX.HTM                    (CCEO, EN)
 * We walk the indexes and let each canon-range page produce a LiturgyEntry
 * with slug prefix `canon-law-` for the backlog counter. Same dedup /
 * skip-on-existing semantics as every other adapter — archived rows
 * never get re-ingested.
 */
export function buildVaticanCanonLawCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.canonlaw",
    description:
      "The full Code of Canon Law (CIC 1983) and Code of Canons of the Eastern Churches (CCEO)",
    kind: "liturgy",
    indexUrls: [
      "https://www.vatican.va/archive/cod-iuris-canonici/cic_index_lt.html",
      "https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_index_en.html",
      "https://www.vatican.va/archive/cod-iuris-canonici/ita/documents/cic_index_it.html",
      "https://www.vatican.va/archive/cod-iuris-canonici/esp/documents/cic_index_sp.html",
      "https://www.vatican.va/archive/cod-iuris-canonici/fra/documents/cic_index_fr.html",
      "https://www.vatican.va/archive/cod-iuris-canonici/por/documents/cic_index_po.html",
      "https://www.vatican.va/archive/cod-iuris-canonici/deu/documents/cic_index_ge.html",
      // Code of Canons of the Eastern Churches (CCEO, 1990).
      "https://www.vatican.va/archive/ENG1104/_INDEX.HTM",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      // Accept any URL inside the canon-law archive or the CCEO archive.
      const inCanonLaw =
        /\/archive\/cod-iuris-canonici\//i.test(url) || /\/archive\/ENG1104\//i.test(url);
      if (!inCanonLaw) return null;
      const slugBase = buildSlug(title) || buildSlug(url);
      const slug = slugBase.startsWith("canon-law-") ? slugBase : `canon-law-${slugBase}`;
      return {
        kind: "liturgy",
        slug,
        liturgyKind: "GLOSSARY",
        title,
        summary: description ?? undefined,
        body,
        externalSourceKey: urlToExternalKey(url),
      };
    },
  });
}

/**
 * Dedicated crawler for papal encyclicals. The Holy See publishes every
 * encyclical at /holy_father/<pope>/encyclicals/documents/hf_<pope>_<date>_<name>_<lang>.html
 * — a stable pattern we can recognise from URL alone. Slug prefix
 * `encyclical-` so the backlog counter picks it up.
 */
export function buildVaticanEncyclicalsCrawler(): SourceAdapter {
  return buildVaticanCrawler({
    key: "vatican.encyclicals",
    description: "Papal encyclicals from the Holy See's archive (every pope)",
    kind: "liturgy",
    indexUrls: [
      "https://www.vatican.va/holy_father/index.htm",
      // Every pope from Pius IX (the first to issue an encyclical
      // archived on vatican.va) through Leo XIV. The Holy See publishes
      // each pope's encyclicals at the same URL pattern, so adding the
      // index page is enough — the per-document crawl picks up the
      // individual encyclicals from the link list.
      "https://www.vatican.va/holy_father/pius_ix/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/leo_xiii/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/pius_x/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/benedict_xv/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/pius_xi/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/pius_xii/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/john_xxiii/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/paul_vi/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/john_paul_i/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/john_paul_ii/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/benedict_xvi/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/francesco/encyclicals/index.htm",
      "https://www.vatican.va/holy_father/leo_xiv/encyclicals/index.htm",
    ],
    toItem: ({ url, title, description, bodyText }): IngestedLiturgy | null => {
      const body = bodyText || description || "";
      if (body.length < 60) return null;
      // Match the stable encyclicals URL pattern.
      const isEncyclical =
        /\/holy_father\/[^/]+\/encyclicals\/documents\/hf_[^/]+_en\.html$/i.test(url) ||
        /encyclical/i.test(title);
      if (!isEncyclical) return null;
      const slugBase = buildSlug(title) || buildSlug(url);
      const slug = slugBase.startsWith("encyclical-") ? slugBase : `encyclical-${slugBase}`;
      return {
        kind: "liturgy",
        slug,
        liturgyKind: "GENERAL",
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
    // Credible Catholic publishing / religious-order / reference adapters —
    // every upstream is in the allowlist; they exist so the catalog can
    // grow past what bishops'-conference sites alone publish.
    buildCredibleCatholicPrayersCrawler(),
    buildCredibleCatholicSaintsCrawler(),
    // Church-documents bucket: conciliar texts, the full Catechism, the
    // full Code of Canon Law (CIC 1983) and Code of Canons of the Eastern
    // Churches (CCEO 1990), plus every encyclical the Holy See archives.
    // Each one stamps a slug prefix the admin backlog tracker counts
    // under "Church Documents".
    buildVaticanCouncilsCrawler(),
    buildVaticanCatechismCrawler(),
    buildVaticanCanonLawCrawler(),
    buildVaticanEncyclicalsCrawler(),
  ];
}
