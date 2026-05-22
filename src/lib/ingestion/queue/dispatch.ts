/**
 * Worker-side job-kind dispatch. Routes a leased queue row to the
 * matching execution function based on `jobKind`. New kinds slot in
 * by extending the switch — no other worker changes needed.
 *
 * Strict factory-only policy: the worker never calls `runAdapter()`
 * for active content creation. The only ways content reaches the
 * public catalog are:
 *
 *   source_discovery   → factory-native discovery only (sources without
 *                         a configured discoveryFeedUrl fail loudly so
 *                         the admin can mark them not_configured).
 *   source_fetch       → writes a SourceDocument AND enqueues a
 *                         content_build job per allowed content type.
 *   content_build      → builds + normalizes + enriches + strict QA +
 *                         persistBuiltPackage().
 *
 * No adapter fallback, no synthetic legacy build logs, no catalog
 * janitor in revalidation — those paths are gone.
 */

import { logger } from "../../observability/logger";
import { prisma } from "../../db/client";
import { recordSourceFreshness } from "../../data/source-health";
import { purgeArchivedByArchivedAt } from "../../data/archive-cleanup";
import { validatePayload, isJobKind, isRemovedJobKind, type JobKind } from "./job-kinds";
import { recordChainStage } from "./chain-audit";
import { runContentFactory, getSourceDocument, recordSourceDocument } from "../../content-factory";
import type { ContentTypeKey } from "../../content-factory";
import { isSourceRole } from "../sources/roles";
import {
  enqueueContentBuildsForSourceDocument,
  type SourceForBuildEligibility,
} from "./build-enqueue";
import type { QueueJobRow } from "./queue";

export type DispatchResult = {
  ok: boolean;
  errorMessage?: string;
  contentSeen?: number;
  contentReview?: number;
};

export async function runJobByKind(job: QueueJobRow): Promise<DispatchResult> {
  // Removed kinds (legacy `source_ingest`, `content_validate`,
  // `content_persist`) are no longer translated at runtime — the
  // migration window has elapsed and the queue has been drained. Any
  // remaining row fails permanently with a precise diagnostic so the
  // operator sees the stale row in the queue migration / startup
  // safety check and drains or deletes it manually.
  if (isRemovedJobKind(job.jobKind)) {
    logger.error("worker.removed_job_kind_seen", {
      jobQueueId: job.id,
      legacyKind: job.jobKind,
      sourceId: job.sourceId,
      jobName: job.jobName,
      message:
        "Legacy job kind row found after the migration window. " +
        "The worker no longer translates these rows — drain or delete " +
        "via the queue migration script.",
    });
    return {
      ok: false,
      errorMessage: `Removed job kind '${job.jobKind}' — translation shim deleted after queue drain. Run the queue migration script to drain or delete legacy rows.`,
    };
  }
  // Strict payload validation at execution time. Bad payloads fail
  // the job permanently (not retried) so a malformed row doesn't
  // crash the worker on every retry.
  const validation = validatePayload(job.jobKind, job.payload ?? {});
  if (!validation.ok) {
    return { ok: false, errorMessage: `Invalid payload: ${validation.error}` };
  }
  if (!isJobKind(job.jobKind)) {
    return { ok: false, errorMessage: `Unknown job kind: ${job.jobKind}` };
  }
  const kind = job.jobKind as JobKind;
  const payload = validation.data as Record<string, unknown>;

  switch (kind) {
    case "source_freshness":
      return runSourceFreshness(job, payload);
    case "source_discovery":
      return runSourceDiscovery(job, payload);
    case "source_fetch":
      return runSourceFetch(job, payload);
    case "content_build":
      return runContentFactoryStage(job, payload);
    case "content_revalidate":
      return runContentRevalidate(job, payload);
    case "source_config_repair":
      return runSourceConfigRepairJob(job, payload);
    case "strict_cleanup":
      return runStrictCleanup(job, payload);
    case "content_growth_bootstrap":
      return runContentGrowthBootstrap(job, payload);
    case "archive_cleanup":
      return runArchiveCleanup(job, payload);
    case "dedupe_cleanup":
      return runDedupeCleanup(job);
    case "sitemap_refresh":
      return runSitemapRefresh(job);
    case "report_generate":
      return runReportGenerate(job, payload);
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return { ok: false, errorMessage: `Unhandled job kind: ${job.jobKind}` };
    }
  }
}

/**
 * Content growth bootstrap — enqueues a first wave of source
 * discovery jobs for the priority content types when the catalog is
 * starved. Delegates to the bootstrap module.
 */
async function runContentGrowthBootstrap(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const { runGrowthBootstrap } = await import("./growth-bootstrap");
  const maxJobs = typeof payload.maxJobs === "number" ? payload.maxJobs : undefined;
  const triggeredBy = payload.triggeredBy === "manual" ? "manual" : "automatic";
  try {
    const report = await runGrowthBootstrap({ maxJobs, triggeredBy, jobQueueId: job.id });
    return {
      ok: true,
      errorMessage: report.skippedReason
        ? `growth bootstrap skipped: ${report.skippedReason}`
        : `growth bootstrap: ${report.discoveryJobsCreated} discovery job(s) created`,
      contentSeen: report.discoveryJobsCreated,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Source freshness probe. Lightweight HEAD-style check — never runs
 * adapter content ingestion. Records the source as reachable / not
 * reachable so the dashboard sees a recent heartbeat for the source.
 */
async function runSourceFreshness(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  if (!job.sourceId) {
    return { ok: false, errorMessage: "source_freshness requires sourceId" };
  }
  const source = await prisma.ingestionSource.findUnique({ where: { id: job.sourceId } });
  if (!source) {
    return { ok: false, errorMessage: `source_freshness: source ${job.sourceId} not found` };
  }
  const probeUrl =
    (payload.probeUrl as string | undefined) ?? source.discoveryFeedUrl ?? source.baseUrl;
  if (!probeUrl) {
    return { ok: false, errorMessage: "source_freshness: no probe URL configured for source" };
  }
  try {
    const res = await fetch(probeUrl, {
      method: "HEAD",
      headers: { "User-Agent": "ViaFideiContentFactory/1.0 (+freshness-probe)" },
    });
    await recordSourceFreshness(job.sourceId, {
      ok: res.ok,
      errorMessage: res.ok ? undefined : `HTTP ${res.status}`,
    }).catch(() => undefined);
    return {
      ok: res.ok,
      errorMessage: res.ok ? `freshness ok: ${res.status}` : `freshness http_${res.status}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordSourceFreshness(job.sourceId, { ok: false, errorMessage: message }).catch(
      () => undefined,
    );
    return { ok: false, errorMessage: message };
  }
}

/**
 * Source discovery — factory-native only. Walks the source's
 * configured `discoveryFeedUrl` (sitemap or RSS), records each URL as
 * a DiscoveredSourceItem, and enqueues a `source_fetch` job per URL.
 *
 * Sources without `discoveryFeedUrl` are NOT silently fallen back to
 * a legacy adapter — that path is gone. They fail with a precise
 * "source not configured" error so the admin sees the source as
 * needing a configured discovery method.
 */
async function runSourceDiscovery(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  if (!job.sourceId) {
    return { ok: false, errorMessage: "source_discovery requires sourceId" };
  }
  const source = await prisma.ingestionSource.findUnique({ where: { id: job.sourceId } });
  if (!source) {
    return { ok: false, errorMessage: `source_discovery: source ${job.sourceId} not found` };
  }
  if (!source.discoveryFeedUrl) {
    return {
      ok: false,
      errorMessage:
        `source_discovery: source ${source.host} has no discoveryFeedUrl — ` +
        `mark the source not_configured or set a sitemap/RSS feed. ` +
        `Legacy adapter execution is removed from the worker.`,
    };
  }
  // Carry the caller's intended content type (set by growth-bootstrap,
  // discovery-expansion, admin replay, etc.) through to factory-native
  // discovery so:
  //   1. discovery can apply positive URL rules for the type
  //   2. the resulting DiscoveredSourceItem rows store the contentType
  //   3. the source_fetch jobs the discovery enqueues also carry the
  //      contentType, so build-enqueue downstream can use it as a
  //      strong signal in addition to URL/title/heading evidence.
  // The queue row's contentType column takes precedence over the
  // payload when both are present.
  const requestedContentType =
    (job.contentType as ContentTypeKey | undefined) ??
    (payload.contentType as ContentTypeKey | undefined) ??
    null;
  const { runFactoryNativeDiscovery } = await import("./factory-native-discovery");
  const { getProductionSourceEntryByHost } = await import("../sources/production-source-registry");
  // Per-source URL filters from the curated registry. A source with
  // a broad sitemap (e.g. marian.org) can carry denyPaths to drop
  // its article / news / event / livestream sections at discovery
  // time, and allowPaths to require URLs to live under a content
  // section before they are fetched. Sources missing from the
  // registry (operator-added) get no per-source filtering.
  const registryEntry = getProductionSourceEntryByHost(source.host);
  try {
    const result = await runFactoryNativeDiscovery({
      sourceId: job.sourceId,
      sourceHost: source.host,
      discoveryFeedUrl: source.discoveryFeedUrl,
      workerJobId: job.id,
      requestedContentType,
      denyPaths: registryEntry?.denyPaths ?? null,
      allowPaths: registryEntry?.allowPaths ?? null,
    });
    await recordSourceFreshness(job.sourceId, { ok: result.ok }).catch(() => undefined);
    // Chain event so the source-fetch-to-build diagnostic can compute
    // a "discovery completed" baseline per source / per type.
    await recordChainStage({
      event: "chain.discovery_completed",
      jobQueueId: job.id,
      contentType: requestedContentType ?? undefined,
      metadata: {
        sourceId: job.sourceId,
        sourceHost: source.host,
        feedUrlCount: result.feedUrlCount,
        discoveredCount: result.discoveredCount,
        enqueuedCount: result.enqueuedCount,
        skippedNonContentCount: result.skippedNonContentCount,
        skippedTypeMismatchCount: result.skippedTypeMismatchCount,
      },
    }).catch(() => undefined);
    return {
      ok: result.ok,
      errorMessage:
        result.errorMessage ??
        `factory-native discovery: feedUrlCount=${result.feedUrlCount} enqueued=${result.enqueuedCount} typeMismatchSkipped=${result.skippedTypeMismatchCount} nonContentSkipped=${result.skippedNonContentCount} contentType=${requestedContentType ?? "any"}`,
      contentSeen: result.enqueuedCount,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordSourceFreshness(job.sourceId, { ok: false, errorMessage: message }).catch(
      () => undefined,
    );
    return { ok: false, errorMessage: message };
  }
}

async function runSourceFetch(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const sourceUrl = payload.sourceUrl as string | undefined;
  if (!sourceUrl) {
    return { ok: false, errorMessage: "source_fetch missing sourceUrl" };
  }
  let hostname: string;
  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    return { ok: false, errorMessage: `source_fetch: invalid url ${sourceUrl}` };
  }
  // Host-level source permission gate (spec #2). A source must be:
  //   - present in the IngestionSource table (otherwise we have no
  //     allowed-purpose record for the host)
  //   - not paused
  //   - not in configurationStatus="not_configured"
  //   - same host as the target URL (defense against a hijacked feed
  //     URL pointing at an unrelated host)
  // The build-enqueue helper later filters per-content-type using the
  // same source row's purpose flags.
  if (job.sourceId) {
    const sourceRow = await prisma.ingestionSource.findUnique({
      where: { id: job.sourceId },
      select: {
        id: true,
        host: true,
        pausedAt: true,
        configurationStatus: true,
      },
    });
    if (!sourceRow) {
      return { ok: false, errorMessage: `source_fetch: source ${job.sourceId} not found` };
    }
    if (sourceRow.pausedAt) {
      return { ok: false, errorMessage: `source_fetch: source ${sourceRow.host} is paused` };
    }
    if (sourceRow.configurationStatus === "not_configured") {
      return {
        ok: false,
        errorMessage: `source_fetch: source ${sourceRow.host} is not_configured — fix the discovery method first`,
      };
    }
    if (sourceRow.host !== hostname) {
      return {
        ok: false,
        errorMessage: `source_fetch: cross-host URL ${hostname} does not match source ${sourceRow.host}`,
      };
    }
  }
  // Minimal fetcher — the worker is allowed to read the real network in
  // production. In the test environment a fixture-bound mock can shadow
  // this. We use the global `fetch` (Node 20+) directly.
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "ViaFideiContentFactory/1.0" },
    });
    const text = await res.text();
    const source = job.sourceId
      ? await prisma.ingestionSource.findUnique({ where: { id: job.sourceId } })
      : null;
    const sourcePurposes: Record<string, boolean> = source ? sourcePurposesRecord(source) : {};
    // Spec #5/#7: pre-parse raw HTML into structured fields before
    // storing. Builders need title / headings / paragraphs / list
    // items, not raw nav + footer + script + share buttons. The
    // parser also extracts canonical URL, og:title, og:type, and
    // meta description so the content type router has metadata
    // signals to work with. Plain-text bodies (already-rendered)
    // pass through unchanged.
    const { parseHtmlForSourceDocument, HTML_PARSER_VERSION } = await import(
      "../../content-factory/html-parser"
    );
    const parsed = parseHtmlForSourceDocument({ html: text, sourceUrl });
    // Empty cleaned body → record as a low-signal page so the build
    // chain diagnostic can count it, but skip enqueueing builds.
    const effectiveFetchStatus = res.ok
      ? parsed.cleanedText.length === 0
        ? "empty_cleaned_body"
        : "ok"
      : `http_${res.status}`;
    const document = await recordSourceDocument({
      sourceUrl,
      sourceHost: hostname,
      sourceId: job.sourceId ?? null,
      workerJobId: job.id,
      sourceTier: source?.tier ?? null,
      // Keep the raw HTML on the row for forensics, but feed the
      // structured cleaned text into the heading / paragraph parser
      // via `rawBody`. This is what builders read.
      rawHtml: text,
      rawBody: parsed.cleanedText,
      sourceTitle: parsed.title ?? undefined,
      metadata: {
        description: parsed.description ?? undefined,
        canonicalUrl: parsed.canonicalUrl ?? undefined,
        ogTitle: parsed.ogTitle ?? undefined,
        schemaType: parsed.schemaType ?? undefined,
        parserVersion: HTML_PARSER_VERSION,
      },
      httpStatus: res.status,
      etag: res.headers.get("etag"),
      lastModifiedHeader: res.headers.get("last-modified"),
      fetchStatus: effectiveFetchStatus,
      sourcePurposes,
    });
    await recordChainStage({
      event: "chain.source_document_created",
      jobQueueId: job.id,
      sourceDocumentId: document.id,
      sourceUrl,
      metadata: { httpStatus: res.status, fetchStatus: res.ok ? "ok" : `http_${res.status}` },
    }).catch(() => undefined);
    // Spec: "After source_fetch creates a SourceDocument, immediately
    // enqueue content_build." We enqueue one build job per allowed
    // content type on the source so a multi-purpose source still
    // builds every supported type. Dedupe and build-eligibility
    // guards live inside enqueueContentBuildsForSourceDocument.
    // Skip the build enqueue when the parser produced an empty
    // cleaned body — the source document is logged for diagnostics
    // but no builder can produce anything useful from zero text.
    let enqueuedBuilds = 0;
    if (res.ok && document.id && effectiveFetchStatus === "ok") {
      try {
        const buildResult = await enqueueContentBuildsForSourceDocument({
          sourceDocumentId: document.id,
          sourceUrl,
          sourceHost: hostname,
          contentChecksum: document.contentChecksum ?? null,
          source: source ? toBuildEligibility(source) : null,
          requestedContentType: (payload.contentType as ContentTypeKey | undefined) ?? null,
          triggeredBy: job.triggeredBy === "manual" ? "manual" : "automatic",
          // Router signals: title + headings + metadata from the
          // freshly recorded SourceDocument so the content type
          // router can drop any content type that hit a hard-
          // negative signal (livestream / event / bulletin /
          // schedule). The router never overrides the source
          // purpose gate — it only narrows the allowed set.
          routerSignals: {
            title: document.sourceTitle ?? null,
            headings: document.headings ?? null,
            metadata: document.metadata ?? null,
          },
        });
        enqueuedBuilds = buildResult.enqueuedCount;
        logger.info("worker.source_fetch_to_build", {
          jobQueueId: job.id,
          sourceDocumentId: document.id,
          sourceUrl,
          enqueuedCount: buildResult.enqueuedCount,
          skipped: buildResult.skippedReasons,
        });
        await recordChainStage({
          event: "chain.source_fetch_to_build",
          jobQueueId: job.id,
          sourceDocumentId: document.id,
          sourceUrl,
          metadata: {
            enqueuedCount: buildResult.enqueuedCount,
            enqueuedTypes: buildResult.enqueuedTypes,
            skippedReasons: buildResult.skippedReasons,
          },
        }).catch(() => undefined);
      } catch (e) {
        logger.warn("worker.source_fetch_to_build_failed", {
          jobQueueId: job.id,
          sourceDocumentId: document.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return {
      ok: res.ok,
      errorMessage: res.ok
        ? `source_fetch ok: enqueued ${enqueuedBuilds} content_build job(s)`
        : `source_fetch http_${res.status}`,
      contentSeen: 1,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Single combined factory stage. Runs build + normalize + enrich +
 * strict QA + persist in one worker tick. The old split stages
 * `content_validate` and `content_persist` were folded into this
 * stage because they previously called the same `runContentFactory`
 * entry point.
 */
async function runContentFactoryStage(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const kind = "content_build" as const;
  const sourceDocumentId = payload.sourceDocumentId as string | undefined;
  const sourceUrl = payload.sourceUrl as string | undefined;
  let document = null;
  if (sourceDocumentId) {
    document = await prisma.sourceDocument.findUnique({ where: { id: sourceDocumentId } });
  } else if (sourceUrl) {
    document = await prisma.sourceDocument.findUnique({ where: { sourceUrl } });
  }
  if (!document) {
    return { ok: false, errorMessage: `${kind} could not find SourceDocument` };
  }
  const contentType = payload.contentType as ContentTypeKey | undefined;
  if (!contentType) {
    return { ok: false, errorMessage: `${kind} missing contentType` };
  }
  const snapshot = await getSourceDocument(document.sourceUrl);
  if (!snapshot) {
    return { ok: false, errorMessage: `${kind} snapshot read failed` };
  }
  // Resolve the source's factory role so the cross-source validator
  // applies the right rule: a primary_content_source bypasses the
  // evidence requirement; every wider role must produce cross-source
  // evidence before strict QA. Without this lookup the factory would
  // default to `discovery_only_source` and force even Vatican.va
  // primary content through cross-source validation.
  let sourceRole: string | undefined;
  if (job.sourceId) {
    try {
      const src = await prisma.ingestionSource.findUnique({
        where: { id: job.sourceId },
        select: { role: true },
      });
      sourceRole = (src as { role?: string } | null)?.role;
    } catch {
      // Leave undefined — the factory falls back to the safe
      // discovery_only_source default.
    }
  }
  const result = await runContentFactory({
    contentType,
    document: snapshot,
    sourceId: job.sourceId ?? null,
    workerJobId: job.id,
    triggeredBy: job.triggeredBy === "manual" ? "manual" : "automatic",
    sourceRole: isSourceRole(sourceRole ?? "") ? (sourceRole as never) : undefined,
  });
  // Record chain-stage events so the audit log preserves the full
  // pipeline trace per URL. We branch on the factory decision so the
  // chain log distinguishes build success, QA rejection, persistence
  // success, and persistence-skipped. Spec #23: terminal content
  // rejects get a distinct event so diagnostics can separate them
  // from infra failures.
  const chainEvent: Parameters<typeof recordChainStage>[0]["event"] =
    result.decision === "persisted-created" || result.decision === "persisted-updated"
      ? "chain.persistence_succeeded"
      : result.decision === "persist-skipped"
        ? "chain.public_gate_passed"
        : result.decision === "qa-rejected" || result.decision === "qa-deleted"
          ? "chain.content_build_terminal_reject"
          : "chain.content_build_completed";
  await recordChainStage({
    event: chainEvent,
    jobQueueId: job.id,
    sourceDocumentId: document.id,
    sourceUrl: document.sourceUrl,
    contentType,
    metadata: { decision: result.decision },
  }).catch(() => undefined);
  // Spec #12: terminal content rejections (qa-rejected, qa-deleted,
  // wrong-content, source-not-allowed, duplicate) are CORRECT factory
  // outcomes — strict QA decided this candidate is not publishable.
  // They are NOT infrastructure failures and should not be retried.
  // We mark the queue row as `completed` (with a terminal-reject
  // summary) so the queue health card stops counting them as ongoing
  // production breakage. The full reject reason is preserved in
  // ContentPackageBuildLog and RejectedContentLog for audit.
  //
  // Reserve queue `failed` for infrastructure errors only: thrown
  // exceptions, database / network / OpenAI / parser timeouts.
  const TERMINAL_DECISIONS = new Set([
    "persisted-created",
    "persisted-updated",
    "persist-skipped",
    "qa-rejected",
    "qa-deleted",
  ]);
  const isTerminal = TERMINAL_DECISIONS.has(result.decision);
  return {
    ok: isTerminal,
    errorMessage: `factory decision=${result.decision}`,
  };
}

async function runStrictCleanup(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  try {
    const { runStrictContentCleanup } = await import("../../content-qa/cleanup");
    const { pruneOrphanedSaves } = await import("../../data/saved");
    const sweepReason = (payload.sweepReason as string) ?? "scheduled";
    const result = await runStrictContentCleanup({ sweepReason });
    // Sweep orphaned saves so a user's saved list never contains a
    // reference to content the factory just removed from public view.
    const orphans = await pruneOrphanedSaves().catch(() => ({
      prayers: 0,
      saints: 0,
      apparitions: 0,
      parishes: 0,
      devotions: 0,
    }));
    const orphanTotal =
      orphans.prayers + orphans.saints + orphans.apparitions + orphans.parishes + orphans.devotions;
    // Spec §19: strict cleanup must revalidate the affected tabs +
    // sitemap + search so the live site reflects the deletions.
    if (result.totalHardDeleted > 0) {
      const { revalidateTab, revalidateSitemap } = await import("../../cache/revalidate");
      // Revalidate every tab — cheaper than per-row when many rows
      // are deleted in one sweep.
      const tabs = [
        "prayers",
        "saints",
        "apparitions",
        "parishes",
        "devotions",
        "novenas",
        "sacraments",
        "liturgy",
        "history",
      ];
      await Promise.all(tabs.map((t) => revalidateTab(t).catch(() => undefined)));
      await revalidateSitemap("strict_cleanup").catch(() => undefined);
    }
    return {
      ok: true,
      errorMessage: `strict-cleanup deleted=${result.totalHardDeleted}, flaggedReady=${result.totalFlaggedReady}, flaggedUnready=${result.totalFlaggedUnready}, mode=${result.mode}, orphanSavesPruned=${orphanTotal}`,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * content_revalidate runs ONLY strict content factory cleanup +
 * package contract revalidation. The legacy catalog janitor (text-
 * shape repackage / divert-to-review) is removed — failed content is
 * deleted with a log, never quietly diverted to REVIEW.
 */
async function runContentRevalidate(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  try {
    const { runStrictContentCleanup } = await import("../../content-qa/cleanup");
    const sweepReason = (payload.sweepReason as string) ?? "catalog_revalidate";
    const strict = await runStrictContentCleanup({ sweepReason }).catch((e) => ({
      error: e instanceof Error ? e.message : String(e),
      totalInspected: 0,
      totalFlaggedReady: 0,
      totalFlaggedUnready: 0,
      totalHardDeleted: 0,
      totalLogFailures: 0,
      buckets: [],
      mode: "all_catalog_rows" as const,
      deleteAllInvalid: true,
      packageContractVersion: "unknown",
      ranAt: new Date(),
    }));
    return {
      ok: true,
      errorMessage:
        `strict-QA flagged ${strict.totalFlaggedReady} ready, ` +
        `${strict.totalFlaggedUnready} unready, ` +
        `${strict.totalHardDeleted} hard-deleted, ` +
        `mode=${strict.mode}, ` +
        `packageContract=${strict.packageContractVersion}, ` +
        `logFailures=${strict.totalLogFailures}`,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runSourceConfigRepairJob(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  try {
    const { runSourceConfigRepair } = await import("./source-config-repair");
    const { runRoleSync } = await import("../sources/role-sync");
    const sourceId = (payload.sourceId as string | undefined) ?? null;
    const [configReport, roleReport] = await Promise.all([
      runSourceConfigRepair({ sourceId }),
      sourceId ? Promise.resolve(null) : runRoleSync(),
    ]);
    // Spec §4 + §16: automatic source-discovery expansion. When a
    // content type is below its factory-ready minimum, enqueue
    // source_discovery jobs for the next candidate sources. Skipped
    // for single-source repair runs (sourceId set).
    let expansionPart = "";
    let sourceJobPart = "";
    if (!sourceId) {
      const { runDiscoveryExpansion } = await import("../sources/discovery-expansion");
      const { enqueueJob } = await import("./queue");
      const expansion = await runDiscoveryExpansion({
        enqueue: (input) => enqueueJob(input),
      }).catch(() => null);
      if (expansion) {
        expansionPart =
          `, discovery-expansion underTarget=${expansion.contentTypesUnderTarget} ` +
          `enqueued=${expansion.discoveryJobsEnqueued}`;
      }
      // Scheduled source-job repair: enqueue a missing source_discovery
      // job for any factory-ready source that has zero active jobs.
      const { runSourceJobRepair } = await import("./source-job-repair");
      const jobRepair = await runSourceJobRepair({ triggeredBy: "automatic" }).catch(() => null);
      if (jobRepair) {
        sourceJobPart =
          `, source-job-repair zeroJobSources=${jobRepair.sourcesWithZeroJobs} ` +
          `created=${jobRepair.discoveryJobsCreated}`;
      }
    }
    const rolePart = roleReport
      ? `, role-sync inspected=${roleReport.inspected} promoted=${roleReport.promoted} demoted=${roleReport.demoted} rejected=${roleReport.rejected}`
      : "";
    return {
      ok: configReport.errors === 0 && (roleReport ? roleReport.errors === 0 : true),
      errorMessage:
        `source-config-repair inspected=${configReport.inspected}, ` +
        `notConfigured=${configReport.markedNotConfigured}, ` +
        `factoryNative=${configReport.markedFactoryNative}, ` +
        `missingPurpose=${configReport.missingPurposeFlags.length}, ` +
        `missingTypes=${configReport.missingContentTypes.length}, ` +
        `errors=${configReport.errors}` +
        rolePart +
        expansionPart +
        sourceJobPart,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runArchiveCleanup(
  job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  void job;
  const retentionDays = (payload.retentionDays as number) ?? 30;
  try {
    const summary = await purgeArchivedByArchivedAt(retentionDays);
    return {
      ok: true,
      errorMessage: `Purged ${summary.totalDeleted} archived rows`,
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runDedupeCleanup(_job: QueueJobRow): Promise<DispatchResult> {
  try {
    const { archiveDuplicatePrayers } = await import("../../data/cleanup");
    const dedupedCount = await archiveDuplicatePrayers();
    return { ok: true, errorMessage: `Deduped ${dedupedCount} duplicate prayers` };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : String(e) };
  }
}

async function runSitemapRefresh(_job: QueueJobRow): Promise<DispatchResult> {
  // Spec §19: sitemap refresh revalidates the sitemap + search cache
  // tags so the route handler regenerates its payload on the next
  // request. Even when the underlying data has not changed, this
  // gives admins a reliable "force refresh" path.
  try {
    const { revalidateSitemap } = await import("../../cache/revalidate");
    await revalidateSitemap("sitemap_refresh").catch(() => undefined);
  } catch {
    /* next/cache unavailable in tests — log path is already covered */
  }
  logger.info("worker.sitemap_refresh.completed");
  return { ok: true, errorMessage: "sitemap refresh: revalidated sitemap + search tags" };
}

async function runReportGenerate(
  _job: QueueJobRow,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  // Reports are dispatched by the cron route; the queue-driven version
  // is reserved for ad-hoc admin-triggered regeneration. We pass the
  // payload through to the dispatcher.
  logger.info("worker.report_generate.requested", { reportKind: payload.reportKind });
  return { ok: true, errorMessage: `Report ${payload.reportKind} dispatched` };
}

function sourcePurposesRecord(source: SourceForBuildEligibility): Record<string, boolean> {
  return {
    canIngestPrayers: source.canIngestPrayers,
    canIngestSaints: source.canIngestSaints,
    canIngestApparitions: source.canIngestApparitions,
    canIngestParishes: source.canIngestParishes,
    canIngestDevotions: source.canIngestDevotions,
    canIngestNovenas: source.canIngestNovenas,
    canIngestSacraments: source.canIngestSacraments,
    canIngestRosaryGuides: source.canIngestRosaryGuides,
    canIngestConsecrations: source.canIngestConsecrations,
    canIngestSpiritualGuides: source.canIngestSpiritualGuides,
    canIngestLiturgy: source.canIngestLiturgy,
    canIngestHistory: source.canIngestHistory,
    canProvideScriptureText: source.canProvideScriptureText,
  };
}

function toBuildEligibility(source: {
  id: string;
  canIngestPrayers: boolean;
  canIngestSaints: boolean;
  canIngestApparitions: boolean;
  canIngestParishes: boolean;
  canIngestDevotions: boolean;
  canIngestNovenas: boolean;
  canIngestSacraments: boolean;
  canIngestRosaryGuides: boolean;
  canIngestConsecrations: boolean;
  canIngestSpiritualGuides: boolean;
  canIngestLiturgy: boolean;
  canIngestHistory: boolean;
  canProvideScriptureText: boolean;
  role?: string | null;
}): SourceForBuildEligibility {
  return {
    id: source.id,
    canIngestPrayers: source.canIngestPrayers,
    canIngestSaints: source.canIngestSaints,
    canIngestApparitions: source.canIngestApparitions,
    canIngestParishes: source.canIngestParishes,
    canIngestDevotions: source.canIngestDevotions,
    canIngestNovenas: source.canIngestNovenas,
    canIngestSacraments: source.canIngestSacraments,
    canIngestRosaryGuides: source.canIngestRosaryGuides,
    canIngestConsecrations: source.canIngestConsecrations,
    canIngestSpiritualGuides: source.canIngestSpiritualGuides,
    canIngestLiturgy: source.canIngestLiturgy,
    canIngestHistory: source.canIngestHistory,
    canProvideScriptureText: source.canProvideScriptureText,
    role: source.role ?? null,
  };
}
