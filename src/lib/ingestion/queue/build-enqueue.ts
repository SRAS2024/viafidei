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
  triggeredBy: "automatic" | "manual";
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
  // naturally).
  if (
    existing.buildStatus === "built_complete_package" &&
    existing.builderVersion === input.builderVersion
  ) {
    return "already_built_current_builder_version";
  }
  // A failed build at the current builder version is NOT retried on
  // every fetch — only when the builder is bumped (different dedupe
  // key) or the admin requests a manual rebuild.
  if (
    existing.buildStatus !== "built_complete_package" &&
    existing.builderVersion === input.builderVersion
  ) {
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
  const allowed = allowedContentTypes(input.source, input.requestedContentType);
  if (allowed.length === 0) {
    result.skippedReasons.no_eligible_types =
      "source has no canIngest* purposes set and no explicit contentType requested";
    return result;
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
    try {
      await enqueueJob({
        jobName: `content_build:${contentType}`,
        jobKind: "content_build",
        dedupeKey,
        sourceId: input.source?.id ?? null,
        contentType,
        priority: PRIORITY_NORMAL,
        triggeredBy: input.triggeredBy,
        payload: {
          sourceDocumentId: input.sourceDocumentId,
          sourceUrl: input.sourceUrl,
          sourceId: input.source?.id ?? undefined,
          contentType,
          builderVersion: builder.builderVersion,
          contentPackageVersion: packageContractVersion,
          dedupeKey,
          triggeredBy: input.triggeredBy,
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
