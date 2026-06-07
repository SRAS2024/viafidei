/**
 * Configured fixed URL lists (spec section 5, discovery method
 * CONFIGURED_URL). The operator maintains a catalogue of known-good
 * URLs per content type and the navigator inserts them as
 * CandidateSourceUrl rows on every pass.
 *
 * The catalogue is a JSON config so it lives in code review and ships
 * with the deploy — no DB editing required. Each entry MUST be on an
 * approved authority host or it is silently dropped.
 */

import type {
  CandidateSourceDiscoveryMethod,
  ChecklistContentType,
  PrismaClient,
} from "@prisma/client";

import { isApprovedAuthorityHost } from "@/lib/checklist";
import { discoverCandidate, isJunkUrl } from "./web-navigator";
import { writeAdminWorkerLog } from "./logs";

export interface ConfiguredUrlEntry {
  url: string;
  predictedContentType?: ChecklistContentType;
  /** Note for the operator (why this URL is on the list). */
  note?: string;
}

/**
 * Built-in catalogue. Operators can add to this file via PR or
 * supplement it at runtime with `addConfiguredUrl()` below.
 *
 * The entries here are intentionally small + Vatican-only to start;
 * the catalogue grows by PR as the operator validates URLs.
 */
export const BUILTIN_CONFIGURED_URLS: readonly ConfiguredUrlEntry[] = [
  {
    url: "https://www.vatican.va/archive/ccc_css/archive/catechism/credo.htm",
    predictedContentType: "CHURCH_DOCUMENT",
    note: "Catechism — The Creed",
  },
  {
    url: "https://www.vatican.va/archive/ccc_css/archive/catechism/sacraments.htm",
    predictedContentType: "SACRAMENT",
    note: "Catechism — Sacraments",
  },
  {
    url: "https://www.vatican.va/archive/ccc_css/archive/catechism/prayer.htm",
    predictedContentType: "PRAYER",
    note: "Catechism — Christian Prayer",
  },
] as const;

const RUNTIME_EXTRA: ConfiguredUrlEntry[] = [];

export function addConfiguredUrl(entry: ConfiguredUrlEntry): void {
  RUNTIME_EXTRA.push(entry);
}

export function listConfiguredUrls(): readonly ConfiguredUrlEntry[] {
  return [...BUILTIN_CONFIGURED_URLS, ...RUNTIME_EXTRA];
}

export interface ConfiguredUrlsOutcome {
  total: number;
  inserted: number;
  rejected: number;
}

export async function discoverFromConfiguredUrls(
  prisma: PrismaClient,
): Promise<ConfiguredUrlsOutcome> {
  const entries = listConfiguredUrls();
  let inserted = 0;
  let rejected = 0;
  for (const entry of entries) {
    let host = "";
    try {
      host = new URL(entry.url).host;
    } catch {
      rejected += 1;
      continue;
    }
    if (!isApprovedAuthorityHost(host)) {
      rejected += 1;
      continue;
    }
    if (isJunkUrl(entry.url).junk) {
      rejected += 1;
      continue;
    }
    const row = await discoverCandidate(prisma, {
      url: entry.url,
      sourceHost: host,
      discoveryMethod: "CONFIGURED_URL" as CandidateSourceDiscoveryMethod,
      predictedContentType: entry.predictedContentType,
      // Configured URLs are highest-confidence — the operator has
      // hand-picked them.
      predictedUsefulness: 0.9,
    });
    if (row) inserted += 1;
    else rejected += 1;
  }
  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "configured_urls_discovery",
    message: `Configured URL pass: ${inserted} inserted, ${rejected} rejected (of ${entries.length}).`,
    safeMetadata: { total: entries.length, inserted, rejected },
  });
  return { total: entries.length, inserted, rejected };
}
