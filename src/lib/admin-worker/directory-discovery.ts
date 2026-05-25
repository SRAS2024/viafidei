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
