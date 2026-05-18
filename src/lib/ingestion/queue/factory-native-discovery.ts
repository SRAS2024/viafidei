/**
 * Factory-native source-discovery handler.
 *
 * When an IngestionSource has `discoveryFeedUrl` set, the worker's
 * source_discovery dispatch routes through here INSTEAD of calling
 * `runAdapter`. The flow:
 *
 *   1. Fetch the discovery feed URL (sitemap.xml or RSS-ish XML).
 *   2. Extract every <loc>...</loc> URL.
 *   3. Filter out URLs that are not the same host as the source
 *      (defense in depth — a poisoned sitemap should not redirect
 *      us to an arbitrary external host).
 *   4. For each URL not already discovered, write a
 *      DiscoveredSourceItem row AND enqueue a source_fetch job.
 *   5. The source_fetch handler then fetches the URL and writes a
 *      SourceDocument; source_fetch's own follow-up logic chains
 *      content_build / content_validate / content_persist.
 *
 * This path runs no adapter logic. It only uses the durable queue,
 * which makes it strictly factory-native per the spec.
 */

import { extractSitemapUrls } from "../sources/discovery";
import { recordDiscoveredItem } from "../../data/discovered-items";
import { logger } from "../../observability/logger";
import { enqueueJob, PRIORITY_NORMAL } from "./queue";

export type FactoryDiscoveryInput = {
  sourceId: string;
  sourceHost: string;
  discoveryFeedUrl: string;
  workerJobId: string;
  /** Optional cap so a giant sitemap doesn't pile thousands of jobs in one tick. */
  maxUrlsPerRun?: number;
};

export type FactoryDiscoveryResult = {
  ok: boolean;
  errorMessage?: string;
  /** URLs found in the feed AFTER same-host filtering. */
  feedUrlCount: number;
  /** URLs that resulted in a new DiscoveredSourceItem row. */
  discoveredCount: number;
  /** URLs we enqueued a source_fetch job for. */
  enqueuedCount: number;
};

const DEFAULT_MAX_URLS = 200;

/**
 * Returns true when `candidate` belongs to the same hostname as
 * `expectedHost`. Falsy / non-URL inputs return false.
 */
function isSameHost(candidate: string, expectedHost: string): boolean {
  try {
    return new URL(candidate).hostname === expectedHost;
  } catch {
    return false;
  }
}

export async function runFactoryNativeDiscovery(
  input: FactoryDiscoveryInput,
): Promise<FactoryDiscoveryResult> {
  const limit = input.maxUrlsPerRun ?? DEFAULT_MAX_URLS;
  const result: FactoryDiscoveryResult = {
    ok: false,
    feedUrlCount: 0,
    discoveredCount: 0,
    enqueuedCount: 0,
  };

  let feedText: string;
  try {
    const res = await fetch(input.discoveryFeedUrl, {
      headers: { "User-Agent": "ViaFideiContentFactory/1.0 (+factory-native-discovery)" },
    });
    if (!res.ok) {
      result.errorMessage = `Feed fetch failed: HTTP ${res.status}`;
      return result;
    }
    feedText = await res.text();
  } catch (e) {
    result.errorMessage = e instanceof Error ? e.message : String(e);
    return result;
  }

  // Extract <loc>...</loc> URLs. Handles sitemap.xml and most RSS
  // shapes since both nest the URL inside <loc> / <link>.
  const allUrls = extractSitemapUrls(feedText);
  const sameHostUrls = allUrls.filter((url) => isSameHost(url, input.sourceHost));
  result.feedUrlCount = sameHostUrls.length;
  if (sameHostUrls.length < allUrls.length) {
    logger.warn("worker.factory_discovery.cross_host_urls_dropped", {
      sourceId: input.sourceId,
      sourceHost: input.sourceHost,
      dropped: allUrls.length - sameHostUrls.length,
    });
  }

  const urls = sameHostUrls.slice(0, limit);
  for (const url of urls) {
    try {
      const id = await recordDiscoveredItem({
        sourceId: input.sourceId,
        // The factory-native path uses the URL itself as the external
        // key — every URL is unique within a source.
        adapterKey: `factory-native:${input.sourceHost}`,
        externalKey: url,
        sourceUrl: url,
        contentType: null,
      });
      if (id) {
        result.discoveredCount += 1;
      }
      // Enqueue a source_fetch job for the URL. The handler is
      // idempotent — if the URL was already fetched, source_fetch
      // will short-circuit on the SourceDocument unique constraint.
      await enqueueJob({
        jobName: `source_fetch:${input.sourceHost}`,
        jobKind: "source_fetch",
        dedupeKey: `source_fetch:${url}`,
        sourceId: input.sourceId,
        contentType: null,
        priority: PRIORITY_NORMAL,
        triggeredBy: "automatic",
        payload: {
          sourceUrl: url,
          sourceId: input.sourceId,
        },
      });
      result.enqueuedCount += 1;
    } catch (e) {
      logger.warn("worker.factory_discovery.url_enqueue_failed", {
        sourceId: input.sourceId,
        url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  result.ok = true;
  logger.info("worker.factory_discovery.completed", {
    sourceId: input.sourceId,
    workerJobId: input.workerJobId,
    feedUrlCount: result.feedUrlCount,
    discoveredCount: result.discoveredCount,
    enqueuedCount: result.enqueuedCount,
  });
  return result;
}
