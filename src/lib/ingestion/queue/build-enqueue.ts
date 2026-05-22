/**
 * Helpers for chaining source_fetch → content_build automatically.
 *
 * The factory's invariant is that every SourceDocument either:
 *   - has a content_build job enqueued for every allowed content
 *     type on the source, OR
 *   - is exempt because the same (sourceDocumentId, contentType,
 *     builderVersion, packageContractVersion, sourceChecksum) tuple
 *     has already been built and the build is current.
 *
 * `enqueueContentBuildsForSourceDocument` is the single helper the
 * source_fetch dispatcher calls after writing a SourceDocument. It
 * applies the source's purpose flags to choose eligible content
 * types, applies a strict dedupe rule, and writes one content_build
 * job per (sourceDocumentId, contentType) that is genuinely new
 * work.
 */

import { BUILDER_REGISTRY } from "../../content-factory";
import type { ContentTypeKey } from "../../content-factory";
import { appConfig } from "../../config";
import { logger } from "../../observability/logger";
import { prisma } from "../../db/client";
import { enqueueJob, PRIORITY_NORMAL } from "./queue";

/**
 * Subset of IngestionSource columns the build-enqueue layer needs.
 * Defined separately so callers can synthesize a record (e.g. for
 * tests) without bringing in the full Prisma type.
 */
export type SourceForBuildEligibility = {
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
  /**
   * Optional factory role. When provided, build-enqueue gates by role
   * so a validation / enrichment / discovery-only source's URL cannot
   * trigger a primary content_build. Spec #4/#15: only
   * `primary_content_source` sources may produce primary content;
   * other roles contribute inside cross-source evidence collection.
   * Omitted = bypass the role gate (test fixtures and synthetic sources).
   */
  role?: string | null;
};

const PURPOSE_BY_CONTENT_TYPE: Record<ContentTypeKey, keyof SourceForBuildEligibility> = {
  Prayer: "canIngestPrayers",
  Saint: "canIngestSaints",
  MarianApparition: "canIngestApparitions",
  Parish: "canIngestParishes",
  Devotion: "canIngestDevotions",
  Novena: "canIngestNovenas",
  Sacrament: "canIngestSacraments",
  Rosary: "canIngestRosaryGuides",
  Consecration: "canIngestConsecrations",
  SpiritualGuidance: "canIngestSpiritualGuides",
  Liturgy: "canIngestLiturgy",
  History: "canIngestHistory",
};

export type EnqueueBuildsInput = {
  sourceDocumentId: string;
  sourceUrl: string;
  sourceHost: string;
  contentChecksum: string | null;
  source: SourceForBuildEligibility | null;
  /**
   * Optional explicit content type. When set, only this type is
   * enqueued (overrides the source-purpose-derived set). Used by
   * source_fetch when the discoverer hinted at a specific type.
   */
  requestedContentType: ContentTypeKey | null;
  triggeredBy: "automatic" | "manual" | "admin" | "auto_repair" | "scheduler" | "worker";
  /**
   * Optional router signals (page title, headings, metadata) used to
   * filter out content types with hard-negative signals — livestream
   * / event / bulletin / schedule pages, etc. When omitted the
   * helper enqueues every source-purpose-allowed type (the legacy
   * behaviour).
   */
  routerSignals?: {
    title?: string | null;
    headings?: ReadonlyArray<{ level: number; text: string }> | null;
    metadata?: Record<string, string | undefined> | null;
  } | null;
  /**
   * Spec #3/#11: bypass the "previous failed at current builder
   * version" skip rule. Used by admin manual replay and post-fix
   * repair so a parser / router / source-config change can take
   * effect without an artificial builder version bump. Should not
   * be set by the regular source_fetch → content_build chain.
   */
  forceRebuild?: boolean;
};

export type EnqueueBuildsResult = {
  enqueuedCount: number;
  enqueuedTypes: ReadonlyArray<ContentTypeKey>;
  skippedReasons: Record<string, string>;
};

/**
 * Pick the set of content types this source is allowed to produce.
 * When no source is attached, we cannot derive purposes; the caller
 * must pass a `requestedContentType` or the function returns an
 * empty set.
 */
function allowedContentTypes(
  source: SourceForBuildEligibility | null,
  requested: ContentTypeKey | null,
): ReadonlyArray<ContentTypeKey> {
  if (requested) return [requested];
  if (!source) return [];
  const out: ContentTypeKey[] = [];
  for (const ct of Object.keys(PURPOSE_BY_CONTENT_TYPE) as ContentTypeKey[]) {
    const key = PURPOSE_BY_CONTENT_TYPE[ct];
    if (source[key]) out.push(ct);
  }
  return out;
}

/**
 * Stable dedupe key for a content_build job. Encodes the inputs that
 * MUST change for a rebuild to be eligible:
 *
 *   - sourceDocumentId   (the cleaned page being built)
 *   - contentType        (one build job per type)
 *   - builderVersion     (a builder bump invalidates prior builds)
 *   - packageContractVer (a contract bump invalidates prior builds)
 *   - contentChecksum    (the page content)
 *
 * Two enqueues with the same key collapse into one row at the
 * queue layer.
 */
export function buildContentBuildDedupeKey(input: {
  sourceDocumentId: string;
  contentType: ContentTypeKey;
  builderVersion: string;
  packageContractVersion: string;
  contentChecksum: string | null;
}): string {
  const checksum = input.contentChecksum ?? "no-checksum";
  return [
    "content_build",
    input.sourceDocumentId,
    input.contentType,
    `bv=${input.builderVersion}`,
    `pkv=${input.packageContractVersion}`,
    `ck=${checksum}`,
  ].join(":");
}

/**
 * Build eligibility predicate. Returns the reason a build should be
 * SKIPPED, or `null` when the build should proceed. Callers MUST
 * record the skip reason (the dispatcher logs them on
 * `worker.source_fetch_to_build`).
 *
 * A build is skipped when the same (sourceDocumentId, contentType)
 * pair already has a successful ContentPackageBuildLog at the
 * current builderVersion AND the SourceDocument's checksum is
 * unchanged from when the build was performed.
 *
 * The function leans on the build log because it is the authoritative
 * "did we build this yet?" record. Queue-row dedupe handles the
 * "in-flight" case via the dedupe key.
 *
 * The SourceDocument's checksum is read alongside so a re-fetched
 * page with new content correctly invalidates the prior build —
 * `recordSourceDocument` upserts on `sourceUrl` and updates
 * `contentChecksum`, so a comparison against the row's CURRENT
 * checksum vs the requested `contentChecksum` is the right rebuild
 * trigger for "page changed".
 */
async function shouldSkipBuild(input: {
  sourceDocumentId: string;
  contentType: ContentTypeKey;
  builderVersion: string;
  contentChecksum: string | null;
  forceRebuild: boolean;
  triggeredBy: "automatic" | "manual" | "admin" | "auto_repair" | "scheduler" | "worker";
}): Promise<string | null> {
  // Look up the most recent build log for this (sourceDocumentId,
  // contentType). The build log doesn't store the source checksum or
  // package contract version directly — we trust the dedupe key for
  // those (the key encodes both, so a contract or checksum bump
  // produces a different key and is treated as new work).
  const existing = await prisma.contentPackageBuildLog
    .findFirst({
      where: {
        sourceDocumentId: input.sourceDocumentId,
        contentType: input.contentType,
      },
      orderBy: { createdAt: "desc" },
      select: {
        buildStatus: true,
        builderVersion: true,
      },
    })
    .catch(() => null);
  if (!existing) return null;
  // A prior successful build at the current builder version is
  // authoritative; nothing to do until the builder or contract is
  // bumped (which produces a different dedupe key and re-enqueues
  // naturally). Even admin force-rebuild respects this — to rebuild
  // a successful row, change the contract or builder version.
  if (
    existing.buildStatus === "built_complete_package" &&
    existing.builderVersion === input.builderVersion
  ) {
    return "already_built_current_builder_version";
  }
  // A failed build at the current builder version is NOT retried on
  // every fetch — only when the builder is bumped (different dedupe
  // key) or the admin requests a manual rebuild.
  //
  // Spec #3/#11: admin replay and force_rebuild bypass this skip.
  // This is the recovery path after a parser fix, router fix, or
  // source-registry fix — without it, every post-fix repair would
  // require an artificial builder version bump even though the
  // builder code is identical.
  if (
    existing.buildStatus !== "built_complete_package" &&
    existing.builderVersion === input.builderVersion
  ) {
    if (input.forceRebuild) return null;
    if (input.triggeredBy === "admin") return null;
    if (input.triggeredBy === "manual") return null;
    return "previous_build_failed_at_current_builder_version";
  }
  return null;
}

export async function enqueueContentBuildsForSourceDocument(
  input: EnqueueBuildsInput,
): Promise<EnqueueBuildsResult> {
  const result: EnqueueBuildsResult = {
    enqueuedCount: 0,
    enqueuedTypes: [],
    skippedReasons: {},
  };
  // Spec #4/#15: only `primary_content_source` sources are allowed to
  // seed primary content_build jobs. Validation / enrichment /
  // discovery-only sources contribute inside cross-source evidence
  // collection, not via this enqueue path. When `role` is set on the
  // source row but is not "primary_content_source", refuse to enqueue.
  // Sources with role unset (omitted in the input — used by test
  // fixtures and synthetic sources) bypass this gate.
  if (input.source?.role && input.source.role !== "primary_content_source") {
    result.skippedReasons.source_role_not_primary =
      `source role '${input.source.role}' is not primary_content_source — only primary sources may seed content_build`;
    return result;
  }
  let allowed = allowedContentTypes(input.source, input.requestedContentType);
  if (allowed.length === 0) {
    result.skippedReasons.no_eligible_types =
      "source has no canIngest* purposes set and no explicit contentType requested";
    return result;
  }
  // Apply the content type router when signals are present. The
  // router rejects content types with hard-negative signals (the page
  // looks like a livestream / event / bulletin / schedule / donation /
  // newsletter / article / blog) AND narrows the rest to the types
  // that carry a STRONG positive signal — so an article / event /
  // livestream / newsletter / schedule / donation page is never
  // queued as a Devotion / Novena / Consecration / Prayer / Saint
  // build, and a source document is not built as every type the
  // source merely permits.
  if (input.routerSignals && input.source) {
    const { routeContentTypes } = await import("../../content-factory/content-type-router");
    const purposes: Record<string, boolean> = {
      canIngestPrayers: input.source.canIngestPrayers,
      canIngestSaints: input.source.canIngestSaints,
      canIngestApparitions: input.source.canIngestApparitions,
      canIngestParishes: input.source.canIngestParishes,
      canIngestDevotions: input.source.canIngestDevotions,
      canIngestNovenas: input.source.canIngestNovenas,
      canIngestSacraments: input.source.canIngestSacraments,
      canIngestRosaryGuides: input.source.canIngestRosaryGuides,
      canIngestConsecrations: input.source.canIngestConsecrations,
      canIngestSpiritualGuides: input.source.canIngestSpiritualGuides,
      canIngestLiturgy: input.source.canIngestLiturgy,
      canIngestHistory: input.source.canIngestHistory,
      canProvideScriptureText: input.source.canProvideScriptureText,
    };
    const decision = routeContentTypes({
      sourceUrl: input.sourceUrl,
      sourceHost: input.sourceHost,
      title: input.routerSignals.title ?? null,
      headings: input.routerSignals.headings ?? null,
      metadata: input.routerSignals.metadata ?? null,
      sourcePurposes: purposes,
    });
    // Drop any content type the router rejected outright (negative
    // signal). Keep the order so deterministic per-tick behaviour
    // is preserved.
    const rejectedTypes = new Set(decision.rejected.map((r) => r.contentType));
    for (const r of decision.rejected) {
      result.skippedReasons[r.contentType] = `router_rejected: ${r.reason}`;
    }
    allowed = allowed.filter((t) => !rejectedTypes.has(t));
    if (allowed.length === 0) {
      result.skippedReasons.no_eligible_types =
        "router rejected every allowed content type for this source document";
      return result;
    }
    // Narrow to the types carrying a strong positive signal. A source
    // permitting a content type is not by itself a reason to build it.
    //
    // Spec #8: the requested content type can NARROW the candidate set,
    // but it must not OVERRIDE a router rejection. Adding the requested
    // type to selectedTypes whenever the router didn't reject it makes
    // the requested-type signal a "tie-breaker" rather than a bypass:
    //   - router rejected it             → skip (request loses)
    //   - router selected it             → keep (no change)
    //   - router neither selected nor rejected → keep when requested
    //     and the URL came from a curated source (fixedUrlList) OR the
    //     source has only one supported content type (single-purpose).
    // For a normal multi-type source with a broad sitemap, the
    // requested-type alone is NOT enough to build — the page itself
    // must show a URL / title / heading match for the type.
    const selectedTypes = new Set(decision.selected.map((s) => s.contentType));
    const rejectedSet = rejectedTypes;
    if (
      input.requestedContentType &&
      !rejectedSet.has(input.requestedContentType) &&
      // Treat as strong signal only when the requested type also
      // appears in the router's ranked set with a non-negative score
      // OR when the source has only one supported content type
      // (single-purpose source — no ambiguity possible).
      (decision.ranked.find((r) => r.contentType === input.requestedContentType) ||
        allowed.length === 1)
    ) {
      selectedTypes.add(input.requestedContentType);
    }
    if (selectedTypes.size > 0) {
      for (const t of allowed) {
        if (!selectedTypes.has(t)) {
          result.skippedReasons[t] =
            "router_weak_signal: source permits this type but the page carries no strong positive signal for it";
        }
      }
      allowed = allowed.filter((t) => selectedTypes.has(t));
      if (allowed.length === 0) {
        result.skippedReasons.no_eligible_types =
          "no allowed content type carries a strong positive signal for this source document";
        return result;
      }
    } else if (input.requestedContentType && rejectedSet.has(input.requestedContentType)) {
      // The caller specifically requested a type the router rejected —
      // log it explicitly so the diagnostic shows "we tried to build
      // this URL as the requested type but the router blocked it".
      result.skippedReasons[input.requestedContentType] =
        "router_rejected_requested_type: requested content type was hard-rejected by router signals";
    }
  }
  const enqueued: ContentTypeKey[] = [];
  const packageContractVersion = appConfig.contentQA.packageContractVersion;

  for (const contentType of allowed) {
    const builder = BUILDER_REGISTRY[contentType];
    if (!builder) {
      result.skippedReasons[contentType] = "no_builder_registered";
      continue;
    }
    const skipReason = await shouldSkipBuild({
      sourceDocumentId: input.sourceDocumentId,
      contentType,
      builderVersion: builder.builderVersion,
      contentChecksum: input.contentChecksum,
      forceRebuild: input.forceRebuild === true,
      triggeredBy: input.triggeredBy,
    });
    if (skipReason) {
      result.skippedReasons[contentType] = skipReason;
      continue;
    }
    const dedupeKey = buildContentBuildDedupeKey({
      sourceDocumentId: input.sourceDocumentId,
      contentType,
      builderVersion: builder.builderVersion,
      packageContractVersion,
      contentChecksum: input.contentChecksum,
    });
    // The queue layer only understands "automatic" | "manual" for
    // triggeredBy. Map the wider EnqueueBuildsInput.triggeredBy
    // (admin / auto_repair / scheduler / worker) down to one of those
    // two values, while preserving the more precise label in the
    // payload for downstream diagnostics.
    const queueTriggeredBy: "automatic" | "manual" =
      input.triggeredBy === "manual" || input.triggeredBy === "admin"
        ? "manual"
        : "automatic";
    try {
      await enqueueJob({
        jobName: `content_build:${contentType}`,
        jobKind: "content_build",
        dedupeKey,
        sourceId: input.source?.id ?? null,
        contentType,
        priority: PRIORITY_NORMAL,
        triggeredBy: queueTriggeredBy,
        payload: {
          sourceDocumentId: input.sourceDocumentId,
          sourceUrl: input.sourceUrl,
          sourceId: input.source?.id ?? undefined,
          contentType,
          builderVersion: builder.builderVersion,
          contentPackageVersion: packageContractVersion,
          dedupeKey,
          triggeredBy: input.triggeredBy,
          forceRebuild: input.forceRebuild === true,
        },
      });
      enqueued.push(contentType);
      result.enqueuedCount += 1;
    } catch (e) {
      logger.warn("build-enqueue.failed", {
        sourceDocumentId: input.sourceDocumentId,
        contentType,
        error: e instanceof Error ? e.message : String(e),
      });
      result.skippedReasons[contentType] = `enqueue_failed: ${
        e instanceof Error ? e.message : String(e)
      }`;
    }
  }
  result.enqueuedTypes = enqueued;
  return result;
}
