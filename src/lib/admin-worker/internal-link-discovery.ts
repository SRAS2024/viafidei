/**
 * Internal-link discovery (spec section 5, discovery method
 * INTERNAL_LINK). Fetches an already-approved seed page, extracts the
 * `<a href>` URLs from the HTML body via a pure-text regex (no DOM
 * parser), and inserts the survivors as CandidateSourceUrl rows.
 *
 * Hard rules:
 *   - only approved authority hosts (host-allowlist enforced)
 *   - junk-URL classifier filters obvious dead URLs
 *   - rejects javascript:, mailto:, tel:, fragment-only links
 *   - capped at 100 links per seed to keep one pass bounded
 */

import type { CandidateSourceDiscoveryMethod, PrismaClient } from "@prisma/client";

import { isApprovedAuthorityHost } from "@/lib/checklist";
import { discoverCandidate, isJunkUrl } from "./web-navigator";
import { writeAdminWorkerLog } from "./logs";

const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "ViaFideiAdminWorker/1.0 (+internal-link-discovery)";
const MAX_LINKS = 100;
const MAX_BODY_BYTES = 2_000_000;

/**
 * Extract `<a href="...">` URLs from an HTML body. Returns absolute
 * URLs only — relative paths are resolved against the supplied base.
 * Pure regex; no DOM parser needed.
 */
export function extractInternalLinks(html: string, base: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    return out;
  }
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    if (/^(javascript|mailto|tel|data):/i.test(raw)) continue;
    if (raw.startsWith("#")) continue;
    let resolved: string;
    try {
      resolved = new URL(raw, baseUrl).toString();
    } catch {
      continue;
    }
    // Strip the fragment — same content with different anchor.
    const stripped = resolved.split("#")[0];
    if (!seen.has(stripped)) {
      seen.add(stripped);
      out.push(stripped);
      if (out.length >= MAX_LINKS) break;
    }
  }
  return out;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers: { "user-agent": USER_AGENT, accept: "text/html, application/xhtml+xml" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BODY_BYTES) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface InternalLinkOutcome {
  seedUrl: string;
  fetched: boolean;
  inserted: number;
  rejected: number;
  reason?: string;
}

export async function discoverFromInternalLinks(
  prisma: PrismaClient,
  seedUrl: string,
): Promise<InternalLinkOutcome> {
  let seedHost = "";
  try {
    seedHost = new URL(seedUrl).host;
  } catch {
    return { seedUrl, fetched: false, inserted: 0, rejected: 0, reason: "invalid URL" };
  }
  if (!isApprovedAuthorityHost(seedHost)) {
    return {
      seedUrl,
      fetched: false,
      inserted: 0,
      rejected: 0,
      reason: "seed host not approved",
    };
  }

  const html = await fetchHtml(seedUrl);
  if (!html) {
    return { seedUrl, fetched: false, inserted: 0, rejected: 0, reason: "fetch failed" };
  }

  const links = extractInternalLinks(html, seedUrl);
  let inserted = 0;
  let rejected = 0;
  for (const link of links) {
    let host = "";
    try {
      host = new URL(link).host;
    } catch {
      rejected += 1;
      continue;
    }
    if (!isApprovedAuthorityHost(host)) {
      rejected += 1;
      continue;
    }
    if (isJunkUrl(link).junk) {
      rejected += 1;
      continue;
    }
    const row = await discoverCandidate(prisma, {
      url: link,
      sourceHost: host,
      discoveryMethod: "INTERNAL_LINK" as CandidateSourceDiscoveryMethod,
      predictedUsefulness: 0.5,
    });
    if (row) inserted += 1;
    else rejected += 1;
  }

  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "internal_link_discovery",
    message: `Internal-link discovery from ${seedUrl}: ${inserted} inserted, ${rejected} rejected (of ${links.length} extracted).`,
    sourceHost: seedHost,
    sourceUrl: seedUrl,
    safeMetadata: { extracted: links.length, inserted, rejected },
  });

  return { seedUrl, fetched: true, inserted, rejected };
}
