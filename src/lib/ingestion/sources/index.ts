export {
  isApprovedHost,
  isApprovedUrl,
  gateUrl,
  listApprovedHosts,
} from "./vatican-allowlist";
export {
  extractApprovedLinks,
  extractDocument,
  safeUrl,
  type DiscoveredLink,
  type ExtractedDocument,
} from "./discovery";
export {
  categorizePrayer,
  categorizeDevotion,
  buildSlug,
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
  buildAllVaticanCrawlers,
  type VaticanCrawlerOptions,
} from "./vatican-adapters";
export {
  registerVaticanAdapters,
  ensureVaticanSchedule,
  hasRegisteredAdapters,
} from "./bootstrap";
