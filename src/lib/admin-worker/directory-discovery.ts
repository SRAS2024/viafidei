/**
 * Catholic content directory discovery (spec section 5, discovery
 * method DIRECTORY). Same flow as internal-link discovery but starts
 * from a curated list of directory pages on the approved hosts — the
 * idea is that "list-of-saints" or "index-of-prayers" pages contain
 * dozens of high-quality links the worker can fan out from.
 *
 * Operators add directory URLs to `DIRECTORY_PAGES`; the discovery
 * helper fetches each one and runs it through the internal-link
 * extractor.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { CURATED_BUILT_CONTENT_TYPES, STRUCTURED_BUILT_CONTENT_TYPES } from "./content-types";
import { discoverFromInternalLinks } from "./internal-link-discovery";
import { writeAdminWorkerLog } from "./logs";
import { suppressedUrlPrefixes } from "./source-reputation";

export interface DirectoryPage {
  url: string;
  expectedContentType?: ChecklistContentType;
  note?: string;
}

/**
 * Built-in directories. These are landing pages on already-approved
 * hosts that list lots of items. The discovery layer reads them via
 * the internal-link extractor.
 */
export const DIRECTORY_PAGES: readonly DirectoryPage[] = [
  {
    url: "https://www.vatican.va/content/vatican/en/holy-father.html",
    expectedContentType: "CHURCH_DOCUMENT",
    note: "Vatican — papal documents index",
  },
  {
    url: "https://www.vatican.va/archive/ccc/index.htm",
    expectedContentType: "CHURCH_DOCUMENT",
    note: "Catechism — index of paragraphs",
  },

  // ── Expanded directories — landing/index pages on approved authority hosts
  //    that link to large numbers of items for the crawler to follow. ─────────
  {
    url: "https://www.newadvent.org/cathen/",
    expectedContentType: "SAINT",
    note: "Catholic Encyclopedia — A–Z index",
  },
  {
    url: "https://www.catholic.org/saints/",
    expectedContentType: "SAINT",
    note: "Catholic Online — saints directory",
  },
  {
    url: "https://www.catholic.org/saints/patron.php",
    expectedContentType: "SAINT",
    note: "Catholic Online — patron saints directory",
  },
  {
    url: "https://catholicsaints.info/",
    expectedContentType: "SAINT",
    note: "CatholicSaints.Info — saints index",
  },
  {
    url: "https://www.franciscanmedia.org/saint-of-the-day/",
    expectedContentType: "SAINT",
    note: "Franciscan Media — Saint of the Day archive",
  },
  {
    url: "https://www.catholic.org/prayers/",
    expectedContentType: "PRAYER",
    note: "Catholic Online — prayers directory",
  },
  {
    url: "https://www.ewtn.com/catholicism/devotions",
    expectedContentType: "DEVOTION",
    note: "EWTN — devotions & prayers directory",
  },
  {
    url: "http://www.preces-latinae.org/thesaurus/thesaurus.html",
    expectedContentType: "PRAYER",
    note: "Thesaurus Precum Latinarum — Latin prayers index",
  },
  {
    url: "https://www.praymorenovenas.com/list-of-novenas",
    expectedContentType: "NOVENA",
    note: "Pray More Novenas — full novena list",
  },
  {
    url: "https://www.papalencyclicals.net/",
    expectedContentType: "CHURCH_DOCUMENT",
    note: "Papal Encyclicals — full archive index",
  },
  {
    url: "https://www.papalencyclicals.net/councils/",
    expectedContentType: "CHURCH_DOCUMENT",
    note: "Ecumenical councils index",
  },
  {
    url: "https://www.newadvent.org/fathers/",
    expectedContentType: "DOCTOR",
    note: "New Advent — Church Fathers index",
  },
  {
    url: "https://www.newadvent.org/summa/",
    expectedContentType: "DOCTOR",
    note: "Summa Theologica — index",
  },
  {
    url: "https://www.ewtn.com/catholicism/teachings/marian",
    expectedContentType: "MARIAN_TITLE",
    note: "EWTN — Marian titles index",
  },
  {
    url: "https://gcatholic.org/dioceses/",
    expectedContentType: "PARISH",
    note: "GCatholic — worldwide dioceses & churches",
  },
  {
    url: "https://www.catholic-hierarchy.org/",
    expectedContentType: "PARISH",
    note: "Catholic-Hierarchy — dioceses index",
  },
  {
    url: "https://www.universalis.com/",
    expectedContentType: "LITURGICAL",
    note: "Universalis — Liturgy of the Hours index",
  },
  {
    url: "https://www.vaticannews.va/en/prayers.html",
    expectedContentType: "PRAYER",
    note: "Vatican News — prayers & devotions index (links out to individual prayers)",
  },
  {
    url: "https://masstimes.org/",
    expectedContentType: "PARISH",
    note: "Mass Times — parish/shrine/cathedral/basilica directory (links out to locations)",
  },
] as const;

export interface DirectoryDiscoveryOutcome {
  directories: number;
  fetched: number;
  inserted: number;
  rejected: number;
  /** Directory pages skipped, with the reason (for the audit log). */
  skipped: Array<{ url: string; reason: string }>;
}

export interface DirectoryDiscoveryOptions {
  /** The content type this discovery pass is targeting, when it has one. */
  contentType?: string | null;
  /** Pre-computed suppressed URL shapes (see `unclassifiablePrefixes`). */
  suppressedPrefixes?: ReadonlySet<string>;
}

/**
 * Types whose content is NOT built from arbitrary web pages — they grow on
 * their own curated / structured-feed ingest lanes. A directory page for one of
 * them can only ever seed URLs the web pipeline cannot publish.
 */
const NON_WEB_BUILT: ReadonlySet<string> = new Set([
  ...CURATED_BUILT_CONTENT_TYPES,
  ...STRUCTURED_BUILT_CONTENT_TYPES,
]);

/**
 * Which directory pages a pass should crawl.
 *
 * WHY THIS FILTER EXISTS. `discoverFromDirectories` used to crawl EVERY entry
 * on every call, whatever the pass was targeting. The orchestrator only reaches
 * DIRECTORY discovery for SAINT (PARISH bails out earlier — it is
 * structured-feed-built), so a pass hunting SAINTS was also crawling
 * `https://gcatholic.org/dioceses/`, `catholic-hierarchy.org` and
 * `masstimes.org`. That index links to thousands of /dioceses/diocese/* pages;
 * the crawler inserted them 100 at a time, the fetcher fetched them, and the
 * classifier rejected every one — Via Fidei has no DIOCESE content type. That
 * is the entry point of the LOOPING escalation of 2026-09-10, and no amount of
 * downstream retry-limiting fixes it: the URLs should never have been queued.
 *
 * So: a directory whose `expectedContentType` is not web-built is never
 * crawled by this web lane, and when the pass has a target type the matching
 * directories are preferred. Untyped directories always run, and if the filter
 * would leave nothing at all the full list runs — starving discovery would be a
 * worse failure than one wasted crawl.
 */
export function selectDirectoryPages(contentType?: string | null): {
  pages: DirectoryPage[];
  skipped: Array<{ url: string; reason: string }>;
} {
  const skipped: Array<{ url: string; reason: string }> = [];
  const webBuilt: DirectoryPage[] = [];
  for (const dir of DIRECTORY_PAGES) {
    if (dir.expectedContentType && NON_WEB_BUILT.has(dir.expectedContentType)) {
      skipped.push({
        url: dir.url,
        reason: `${dir.expectedContentType} is not web-built (grown by its own ingest lane)`,
      });
      continue;
    }
    webBuilt.push(dir);
  }
  if (!contentType) return { pages: webBuilt, skipped };
  const targeted = webBuilt.filter(
    (d) => !d.expectedContentType || d.expectedContentType === contentType,
  );
  if (targeted.length === 0) return { pages: webBuilt, skipped };
  for (const dir of webBuilt) {
    if (!targeted.includes(dir)) {
      skipped.push({
        url: dir.url,
        reason: `targeting ${contentType}, not ${dir.expectedContentType}`,
      });
    }
  }
  return { pages: targeted, skipped };
}

export async function discoverFromDirectories(
  prisma: PrismaClient,
  opts: DirectoryDiscoveryOptions = {},
): Promise<DirectoryDiscoveryOutcome> {
  const { pages, skipped } = selectDirectoryPages(opts.contentType ?? null);
  const suppressedPrefixes =
    opts.suppressedPrefixes ?? (await suppressedUrlPrefixes(prisma).catch(() => new Set<string>()));
  let fetched = 0;
  let inserted = 0;
  let rejected = 0;
  for (const dir of pages) {
    const outcome = await discoverFromInternalLinks(prisma, dir.url, { suppressedPrefixes });
    if (outcome.fetched) fetched += 1;
    inserted += outcome.inserted;
    rejected += outcome.rejected;
  }
  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "directory_discovery",
    message: `Directory discovery pass: ${fetched}/${pages.length} directories fetched, ${inserted} inserted, ${rejected} rejected, ${skipped.length} directory page(s) skipped.`,
    contentType: opts.contentType ?? undefined,
    safeMetadata: {
      directories: pages.length,
      fetched,
      inserted,
      rejected,
      skipped,
      suppressedPrefixes: [...suppressedPrefixes],
    },
  });
  return { directories: pages.length, fetched, inserted, rejected, skipped };
}
