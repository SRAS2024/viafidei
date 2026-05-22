/**
 * Production source registry (spec §1).
 *
 * Curated list of real Catholic sources the factory should know
 * about by default. Each entry carries every field the spec names:
 *
 *   - name + host + baseUrl
 *   - discoveryMethod (sitemap / rss / fixed_url_list / official_api / factory_handler)
 *   - supportedContentTypes (canIngest* purpose flag set)
 *   - tier (1 = tier_1, most trusted; 3 = tier_3, least trusted but allowed)
 *   - role (primary_content_source / validation_source / enrichment_source / discovery_only_source)
 *   - allowedFields (which package fields the source may originate)
 *   - canProvidePrimaryContent / canProvideValidationOnly / canProvideEnrichmentOnly
 *   - licenseStatus (cc, public_domain, copyright_with_permission, reference_only)
 *   - fetchLimitPerRun / buildLimitPerRun / dailyCap
 *
 * The list is intentionally short and conservative — only adds
 * sources that are publicly accessible, have clear licensing, and
 * have a discoverable sitemap or feed. A startup task upserts every
 * entry into IngestionSource so a fresh deployment has a working
 * source registry on first boot.
 *
 * Each addition here is reviewed against:
 *   - whether the source's terms permit factory ingestion
 *   - whether the source maintains a sitemap or RSS feed
 *   - whether the source is well-established (not a personal blog)
 */

export type ProductionSourceEntry = {
  name: string;
  host: string;
  baseUrl: string;
  discoveryMethod:
    | "sitemap"
    | "rss"
    | "fixed_url_list"
    | "official_api"
    | "factory_handler"
    | "not_configured";
  discoveryFeedUrl: string | null;
  tier: 1 | 2 | 3;
  role:
    | "primary_content_source"
    | "validation_source"
    | "enrichment_source"
    | "discovery_only_source";
  supportedContentTypes: ReadonlyArray<
    | "Prayer"
    | "Saint"
    | "MarianApparition"
    | "Parish"
    | "Devotion"
    | "Novena"
    | "Sacrament"
    | "Rosary"
    | "Consecration"
    | "Liturgy"
    | "History"
    | "ScriptureText"
  >;
  allowedFields: ReadonlyArray<string>;
  canProvidePrimaryContent: boolean;
  canProvideValidationOnly: boolean;
  canProvideEnrichmentOnly: boolean;
  licenseStatus: "cc" | "public_domain" | "copyright_with_permission" | "reference_only";
  fetchLimitPerRun: number | null;
  buildLimitPerRun: number | null;
  dailyCap: number | null;
  /**
   * Optional curated allowlist of fully-qualified source URLs. When
   * set, the factory-native discoverer will only enqueue source_fetch
   * jobs for URLs in this list (the sitemap is ignored). Used for
   * sources whose discovery feed is broad and includes article /
   * news / event pages that would otherwise pile up wrong-content
   * rejections downstream.
   */
  fixedUrlList?: ReadonlyArray<string>;
  /**
   * Optional URL path patterns to drop at discovery time. Used by
   * sources with broad sitemaps (e.g. publishers that surface
   * articles, news, and events alongside their primary content).
   * Matched as case-insensitive substrings.
   */
  denyPaths?: ReadonlyArray<string>;
  /**
   * Optional URL path patterns that a URL MUST match (at least one)
   * to pass discovery. When non-empty, URLs that don't match are
   * dropped at discovery time. Combine with denyPaths for tight
   * scoping.
   */
  allowPaths?: ReadonlyArray<string>;
  notes?: string;
};

/**
 * Map a ProductionSourceEntry to the IngestionSource Prisma row's
 * canIngest* flags. Keeps the entry list tight and the flag-mapping
 * logic in one place.
 */
export function purposeFlagsForEntry(entry: ProductionSourceEntry): Record<string, boolean> {
  const flags: Record<string, boolean> = {
    canIngestPrayers: false,
    canIngestSaints: false,
    canIngestApparitions: false,
    canIngestParishes: false,
    canIngestDevotions: false,
    canIngestNovenas: false,
    canIngestSacraments: false,
    canIngestRosaryGuides: false,
    canIngestConsecrations: false,
    canIngestSpiritualGuides: false,
    canIngestLiturgy: false,
    canIngestHistory: false,
    canProvideScriptureText: false,
  };
  for (const ct of entry.supportedContentTypes) {
    switch (ct) {
      case "Prayer":
        flags.canIngestPrayers = true;
        break;
      case "Saint":
        flags.canIngestSaints = true;
        break;
      case "MarianApparition":
        flags.canIngestApparitions = true;
        break;
      case "Parish":
        flags.canIngestParishes = true;
        break;
      case "Devotion":
        flags.canIngestDevotions = true;
        break;
      case "Novena":
        flags.canIngestNovenas = true;
        break;
      case "Sacrament":
        flags.canIngestSacraments = true;
        break;
      case "Rosary":
        flags.canIngestRosaryGuides = true;
        break;
      case "Consecration":
        flags.canIngestConsecrations = true;
        break;
      case "Liturgy":
        flags.canIngestLiturgy = true;
        break;
      case "History":
        flags.canIngestHistory = true;
        break;
      case "ScriptureText":
        flags.canProvideScriptureText = true;
        break;
    }
  }
  return flags;
}

// ─── Curated registry ──────────────────────────────────────────────
//
// Every entry must be a publicly-accessible, established Catholic
// source with clear licensing. A discovery feed URL (sitemap/RSS) is
// preferred; `not_configured` is reserved for sources we know about
// but can't yet automate discovery on.

export const PRODUCTION_SOURCE_REGISTRY: ReadonlyArray<ProductionSourceEntry> = [
  {
    name: "Vatican.va",
    host: "vatican.va",
    baseUrl: "https://www.vatican.va",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.vatican.va/sitemap.xml",
    tier: 1,
    role: "primary_content_source",
    supportedContentTypes: [
      "Prayer",
      "Saint",
      "MarianApparition",
      "Sacrament",
      "Liturgy",
      "History",
      "Devotion",
      "Consecration",
      "Novena",
      "Rosary",
    ],
    allowedFields: [
      "title",
      "prayerText",
      "biographyIdentity",
      "feastDay",
      "approvalStatus",
      "sacramentKey",
      "sacramentGroup",
      "dateOrEra",
      "authority",
      "eventIdentity",
      "structure",
    ],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "public_domain",
    fetchLimitPerRun: 50,
    buildLimitPerRun: 25,
    dailyCap: 500,
    notes: "Holy See — official Vatican site. Public-domain content. Highest-tier primary source.",
  },
  {
    name: "USCCB",
    host: "usccb.org",
    baseUrl: "https://www.usccb.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.usccb.org/sitemap.xml",
    tier: 1,
    role: "primary_content_source",
    supportedContentTypes: [
      "Prayer",
      "Saint",
      "Sacrament",
      "Liturgy",
      "History",
      "Devotion",
      "Parish",
    ],
    allowedFields: [
      "title",
      "prayerText",
      "biographyIdentity",
      "feastDay",
      "sacramentKey",
      "sacramentGroup",
      "city",
      "country",
      "website",
      "diocese",
    ],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 40,
    buildLimitPerRun: 20,
    dailyCap: 400,
    notes:
      "United States Conference of Catholic Bishops. Tier-1 primary source for US-focused content.",
  },
  {
    name: "USCCB Bible",
    host: "bible.usccb.org",
    baseUrl: "https://bible.usccb.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://bible.usccb.org/sitemap.xml",
    tier: 1,
    role: "primary_content_source",
    supportedContentTypes: ["ScriptureText"],
    allowedFields: ["scriptureReference", "scriptureText"],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "reference_only",
    fetchLimitPerRun: 20,
    buildLimitPerRun: 10,
    dailyCap: 200,
    notes:
      "USCCB-hosted NABRE Bible. Reference-only license — text is shown as scripture-reference blocks rather than copied.",
  },
  {
    name: "Catholic Culture",
    host: "catholicculture.org",
    baseUrl: "https://www.catholicculture.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.catholicculture.org/sitemap.xml",
    tier: 2,
    role: "validation_source",
    supportedContentTypes: ["Prayer", "Saint", "History", "Devotion"],
    allowedFields: ["title", "prayerText", "biographyIdentity", "feastDay"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: true,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 30,
    buildLimitPerRun: 0,
    dailyCap: 300,
    notes:
      "Long-established Catholic site. Useful as a validation source — confirms feast days, prayer text, and historical dates.",
  },
  {
    name: "Catholic.org",
    host: "catholic.org",
    baseUrl: "https://www.catholic.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.catholic.org/sitemap.xml",
    tier: 2,
    role: "validation_source",
    supportedContentTypes: ["Prayer", "Saint", "Devotion"],
    allowedFields: ["title", "prayerText", "biographyIdentity", "feastDay", "patronage"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: true,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 20,
    buildLimitPerRun: 0,
    dailyCap: 200,
    notes:
      "Established Catholic content site. Used as validation source for saint patronage and prayer text.",
  },
  {
    name: "EWTN",
    host: "ewtn.com",
    baseUrl: "https://www.ewtn.com",
    discoveryMethod: "rss",
    discoveryFeedUrl: "https://www.ewtn.com/catholicism/library/rss",
    tier: 2,
    role: "enrichment_source",
    supportedContentTypes: ["Prayer", "Saint", "Devotion", "Consecration", "Novena", "Rosary"],
    allowedFields: ["title", "prayerText", "biographyIdentity", "patronage", "structure"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: true,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 30,
    buildLimitPerRun: 0,
    dailyCap: 300,
    notes:
      "EWTN. Used as enrichment source — Catechism citations, related-prayer hints, devotion descriptions.",
  },
  {
    name: "Vatican News",
    host: "vaticannews.va",
    baseUrl: "https://www.vaticannews.va",
    discoveryMethod: "rss",
    discoveryFeedUrl: "https://www.vaticannews.va/en.rss.xml",
    tier: 1,
    role: "validation_source",
    supportedContentTypes: ["History", "Saint", "MarianApparition"],
    allowedFields: ["title", "dateOrEra", "authority", "approvalStatus"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: true,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 20,
    buildLimitPerRun: 0,
    dailyCap: 200,
    notes:
      "Vatican News (Holy See official news). Strong validation source for canonization announcements, papal acts, apparition approvals.",
  },
  {
    name: "Wikipedia (Catholicism portal)",
    host: "en.wikipedia.org",
    baseUrl: "https://en.wikipedia.org/wiki/Portal:Catholicism",
    discoveryMethod: "official_api",
    discoveryFeedUrl: null,
    tier: 3,
    role: "discovery_only_source",
    supportedContentTypes: ["Saint", "MarianApparition", "History"],
    allowedFields: ["title", "biographyIdentity"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "cc",
    fetchLimitPerRun: 10,
    buildLimitPerRun: 0,
    dailyCap: 100,
    notes:
      "Wikipedia is a discovery-only source — surfaces candidate URLs but never publishes without validation from a tier-1 source.",
  },
  {
    name: "New Advent",
    host: "newadvent.org",
    baseUrl: "https://www.newadvent.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.newadvent.org/sitemap.xml",
    tier: 2,
    role: "validation_source",
    supportedContentTypes: [
      "Prayer",
      "Saint",
      "History",
      "Liturgy",
      "Sacrament",
      "MarianApparition",
    ],
    allowedFields: [
      "title",
      "biographyIdentity",
      "feastDay",
      "dateOrEra",
      "authority",
      "eventIdentity",
      "approvalStatus",
    ],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: true,
    canProvideEnrichmentOnly: false,
    licenseStatus: "public_domain",
    fetchLimitPerRun: 30,
    buildLimitPerRun: 0,
    dailyCap: 300,
    notes:
      "New Advent — Catholic Encyclopedia + Fathers of the Church + Summa Theologica. Strong validation source for saints + Church history + sacrament explanations.",
  },
  {
    name: "Catholic News Agency",
    host: "catholicnewsagency.com",
    baseUrl: "https://www.catholicnewsagency.com",
    discoveryMethod: "rss",
    discoveryFeedUrl: "https://www.catholicnewsagency.com/rss/news.xml",
    tier: 2,
    role: "validation_source",
    supportedContentTypes: ["Saint", "History", "MarianApparition"],
    allowedFields: ["title", "biographyIdentity", "dateOrEra", "approvalStatus"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: true,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 25,
    buildLimitPerRun: 0,
    dailyCap: 250,
    notes:
      "Catholic News Agency. Validation source for canonization announcements, papal acts, and recent apparition rulings.",
  },
  {
    name: "Our Sunday Visitor",
    host: "osvnews.com",
    baseUrl: "https://www.osvnews.com",
    discoveryMethod: "rss",
    discoveryFeedUrl: "https://www.osvnews.com/feed/",
    tier: 2,
    role: "validation_source",
    supportedContentTypes: ["Saint", "Devotion", "History", "Sacrament"],
    allowedFields: ["title", "biographyIdentity", "feastDay", "dateOrEra"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: true,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 20,
    buildLimitPerRun: 0,
    dailyCap: 200,
    notes:
      "Our Sunday Visitor (OSV). Long-established Catholic publisher. Validation source for saint feasts, devotional content, and sacramental teaching.",
  },
  {
    name: "Praying the Rosary",
    host: "rosary-center.org",
    baseUrl: "https://www.rosary-center.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.rosary-center.org/sitemap.xml",
    tier: 2,
    role: "primary_content_source",
    supportedContentTypes: ["Rosary", "Prayer", "Devotion"],
    allowedFields: ["title", "prayerText", "structure", "scriptureReference"],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 20,
    buildLimitPerRun: 10,
    dailyCap: 200,
    notes:
      "Rosary Center & Confraternity. Long-running Dominican site dedicated to the Rosary. Primary source for Rosary structure + mysteries + meditations.",
  },
  {
    name: "Pray More Novenas",
    host: "praymorenovenas.com",
    baseUrl: "https://www.praymorenovenas.com",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.praymorenovenas.com/sitemap.xml",
    tier: 2,
    role: "primary_content_source",
    supportedContentTypes: ["Novena", "Prayer"],
    allowedFields: ["title", "prayerText", "structure", "days", "dailyPrayers"],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 25,
    buildLimitPerRun: 15,
    dailyCap: 250,
    notes:
      "Pray More Novenas. Established Catholic novena library. Primary source for novena structure + daily prayers.",
  },
  {
    name: "33 Days to Morning Glory",
    host: "marian.org",
    baseUrl: "https://www.marian.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.marian.org/sitemap.xml",
    tier: 2,
    role: "primary_content_source",
    supportedContentTypes: ["Consecration", "Devotion", "Novena"],
    allowedFields: ["title", "structure", "days", "dailyPrayers"],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 15,
    buildLimitPerRun: 10,
    dailyCap: 150,
    // marian.org's full sitemap includes articles, news, events,
    // livestream, and donation pages alongside its actual devotion /
    // novena / consecration material. Without these path filters,
    // the factory would burn dozens of build attempts on /articles/
    // and /events/ URLs that the wrong-content detector correctly
    // rejects. denyPaths blocks the noisy sections; allowPaths
    // requires every passing URL to live under a path that actually
    // hosts devotional content. The global non-content URL filter
    // would catch most of these anyway — these per-source filters
    // are the second-line defence per spec #3.
    denyPaths: [
      "/articles/",
      "/article/",
      "/news/",
      "/events/",
      "/event/",
      "/calendar/",
      "/livestream/",
      "/live-stream/",
      "/watch-live/",
      "/podcast/",
      "/video/",
      "/press/",
      "/store/",
      "/shop/",
      "/cart/",
      "/donate/",
      "/donations/",
      "/give/",
      "/register/",
      "/registration/",
      "/newsletter/",
      "/subscribe/",
      "/tag/",
      "/category/",
      "/author/",
    ],
    allowPaths: [
      "/consecration",
      "/consecrations",
      "/33-days",
      "/33days",
      "/devotion",
      "/devotions",
      "/devotional",
      "/divine-mercy",
      "/novena",
      "/novenas",
      "/prayers",
      "/prayer",
    ],
    notes:
      "Marian Fathers of the Immaculate Conception. Primary source for Marian consecrations + Divine Mercy devotion content. Discovery is scoped via denyPaths (/articles, /news, /events, /livestream, /donate) and allowPaths (/consecration, /33-days, /devotion, /novena) because the full sitemap also serves news and event pages that the wrong-content detector would otherwise reject.",
  },
  {
    name: "Adoremus",
    host: "adoremus.org",
    baseUrl: "https://www.adoremus.org",
    discoveryMethod: "rss",
    discoveryFeedUrl: "https://www.adoremus.org/feed/",
    tier: 2,
    role: "primary_content_source",
    supportedContentTypes: ["Liturgy", "Sacrament", "History"],
    allowedFields: ["title", "dateOrEra", "authority", "sacramentKey", "structure"],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 20,
    buildLimitPerRun: 10,
    dailyCap: 200,
    notes:
      "Adoremus Society for the Renewal of the Sacred Liturgy. Strong primary source for liturgical formation content + Mass structure + sacramental teaching.",
  },
  {
    name: "FindAParish (USCCB)",
    host: "parishesonline.com",
    baseUrl: "https://www.parishesonline.com",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "https://www.parishesonline.com/sitemap.xml",
    tier: 2,
    role: "primary_content_source",
    supportedContentTypes: ["Parish"],
    allowedFields: ["title", "city", "country", "website", "diocese"],
    canProvidePrimaryContent: true,
    canProvideValidationOnly: false,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 50,
    buildLimitPerRun: 25,
    dailyCap: 500,
    notes:
      "Parishes Online (an OSV directory). Primary source for parish identity records — name, city, country, website, diocese.",
  },
  {
    name: "GCatholic",
    host: "gcatholic.org",
    baseUrl: "http://www.gcatholic.org",
    discoveryMethod: "sitemap",
    discoveryFeedUrl: "http://www.gcatholic.org/sitemap.xml",
    tier: 2,
    role: "validation_source",
    supportedContentTypes: ["Parish", "History"],
    allowedFields: ["title", "city", "country", "diocese", "dateOrEra", "authority"],
    canProvidePrimaryContent: false,
    canProvideValidationOnly: true,
    canProvideEnrichmentOnly: false,
    licenseStatus: "copyright_with_permission",
    fetchLimitPerRun: 20,
    buildLimitPerRun: 0,
    dailyCap: 200,
    notes:
      "GCatholic.org. Comprehensive directory of dioceses, cathedrals, and parishes worldwide. Validation source for parish + diocese identity and history of Church administration.",
  },
];

/**
 * Group every entry by content type. Used by the admin source-groups
 * dashboard and by the source plan to confirm coverage.
 */
export function groupSourcesByContentType(
  entries: ReadonlyArray<ProductionSourceEntry> = PRODUCTION_SOURCE_REGISTRY,
): Record<string, ReadonlyArray<ProductionSourceEntry>> {
  const groups: Record<string, ProductionSourceEntry[]> = {};
  for (const e of entries) {
    for (const ct of e.supportedContentTypes) {
      if (!groups[ct]) groups[ct] = [];
      groups[ct].push(e);
    }
  }
  return groups as Record<string, ReadonlyArray<ProductionSourceEntry>>;
}

/**
 * Look up the registry entry for a given host. Returns null when the
 * host is not in the curated registry (operator-added sources, fixture
 * sources, etc.). Used by the discovery dispatcher to read
 * source-specific URL filters (denyPaths / allowPaths / fixedUrlList)
 * without storing them on the IngestionSource row.
 */
export function getProductionSourceEntryByHost(
  host: string,
): ProductionSourceEntry | null {
  for (const entry of PRODUCTION_SOURCE_REGISTRY) {
    if (entry.host === host) return entry;
  }
  return null;
}
