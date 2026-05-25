/**
 * Official source APIs (spec section 5, discovery method API). Some
 * publishers expose structured JSON APIs (Catholic news syndication,
 * USCCB daily-readings JSON, etc.). This module is a thin adapter
 * registry: each adapter knows how to call one publisher's API and
 * map the result into CandidateSourceUrl rows.
 *
 * No adapters ship in this PR — the registry + dispatch live here so
 * the integration shape is clear. Operators add per-publisher
 * adapters via PR (each one is small + reviewed).
 */

import type { CandidateSourceDiscoveryMethod, PrismaClient } from "@prisma/client";

import { isApprovedAuthorityHost } from "@/lib/worker";
import { discoverCandidate, isJunkUrl } from "./web-navigator";
import { writeAdminWorkerLog } from "./logs";

export interface ApiAdapter {
  id: string;
  /** Host this adapter targets (used for host-allowlist check). */
  host: string;
  /** Description shown in the rules / discovery UI. */
  description: string;
  /** Adapter implementation; returns URLs to insert as candidates. */
  fetch(): Promise<Array<{ url: string; predictedContentType?: string; usefulness?: number }>>;
}

const ADAPTERS: ApiAdapter[] = [];

export function registerApiAdapter(adapter: ApiAdapter): void {
  ADAPTERS.push(adapter);
}

export function listApiAdapters(): readonly ApiAdapter[] {
  return ADAPTERS;
}

export interface ApiDiscoveryOutcome {
  adaptersRun: number;
  inserted: number;
  rejected: number;
}

export async function discoverFromApis(prisma: PrismaClient): Promise<ApiDiscoveryOutcome> {
  let inserted = 0;
  let rejected = 0;
  for (const adapter of ADAPTERS) {
    if (!isApprovedAuthorityHost(adapter.host)) {
      rejected += 1;
      continue;
    }
    let results: Awaited<ReturnType<ApiAdapter["fetch"]>> = [];
    try {
      results = await adapter.fetch();
    } catch (err) {
      await writeAdminWorkerLog(prisma, {
        category: "SOURCE_DISCOVERY",
        severity: "WARN",
        eventName: "api_adapter_failed",
        message: `API adapter ${adapter.id} failed: ${err instanceof Error ? err.message : String(err)}`,
        sourceHost: adapter.host,
      });
      continue;
    }
    for (const r of results) {
      let host = "";
      try {
        host = new URL(r.url).host;
      } catch {
        rejected += 1;
        continue;
      }
      if (!isApprovedAuthorityHost(host)) {
        rejected += 1;
        continue;
      }
      if (isJunkUrl(r.url).junk) {
        rejected += 1;
        continue;
      }
      const row = await discoverCandidate(prisma, {
        url: r.url,
        sourceHost: host,
        discoveryMethod: "API" as CandidateSourceDiscoveryMethod,
        predictedContentType: r.predictedContentType as never,
        predictedUsefulness: r.usefulness ?? 0.75,
      });
      if (row) inserted += 1;
      else rejected += 1;
    }
  }
  await writeAdminWorkerLog(prisma, {
    category: "SOURCE_DISCOVERY",
    severity: "INFO",
    eventName: "api_discovery",
    message: `API discovery: ${ADAPTERS.length} adapter(s), ${inserted} inserted, ${rejected} rejected.`,
    safeMetadata: { adaptersRun: ADAPTERS.length, inserted, rejected },
  });
  return { adaptersRun: ADAPTERS.length, inserted, rejected };
}
