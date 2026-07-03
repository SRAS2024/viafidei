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

import { discoverFromInternalLinks } from "./internal-link-discovery";
import { writeAdminWorkerLog } from "./logs";

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
] as const;

export interface DirectoryDiscoveryOutcome {
  directories: number;
  fetched: number;
  inserted: number;
  rejected: number;
}

export async function discoverFromDirectories(
  prisma: PrismaClient,
): Promise<DirectoryDiscoveryOutcome> {
  let fetched = 0;
  let inserted = 0;
  let rejected = 0;
  for (const dir of DIRECTORY_PAGES) {
    const outcome = await discoverFromInternalLinks(prisma, dir.url);
    if (outcome.fetched) fetched += 1;
    inserted += outcome.inserted;
    rejected += outcome.rejected;
  }
  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "directory_discovery",
    message: `Directory discovery pass: ${fetched}/${DIRECTORY_PAGES.length} directories fetched, ${inserted} inserted, ${rejected} rejected.`,
    safeMetadata: { directories: DIRECTORY_PAGES.length, fetched, inserted, rejected },
  });
  return { directories: DIRECTORY_PAGES.length, fetched, inserted, rejected };
}
