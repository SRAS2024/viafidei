export { isApprovedHost, isApprovedUrl, gateUrl, listApprovedHosts } from "./vatican-allowlist";
export {
  extractApprovedLinks,
  extractDocument,
  extractSitemapUrls,
  isSitemapIndex,
  safeUrl,
  type DiscoveredLink,
  type ExtractedDocument,
} from "./discovery";
export {
  categorizePrayer,
  categorizeDevotion,
  buildSlug,
  PRAYER_CATEGORY_ORDER,
  type PrayerCategory,
  type DevotionCategory,
} from "./categorize";
export {
  buildVaticanCrawler,
  buildVaticanPrayerCrawler,
  buildVaticanSaintsCrawler,
  buildVaticanApparitionsCrawler,
  buildVaticanDevotionsCrawler,
  buildVaticanParishesCrawler,
  buildVaticanCanonLawCrawler,
  buildVaticanCatechismCrawler,
  buildVaticanEncyclicalsCrawler,
  buildAllVaticanCrawlers,
  type VaticanCrawlerOptions,
} from "./vatican-adapters";
export {
  registerVaticanAdapters,
  ensureVaticanSchedule,
  hasRegisteredAdapters,
  listAdapterSecondaryHosts,
} from "./bootstrap";
