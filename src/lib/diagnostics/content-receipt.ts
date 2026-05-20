/**
 * Content receipt panel + complete source-to-public-page trace.
 *
 * For any public item the admin can answer:
 *
 *   1. Why it exists.
 *   2. Which builder created it.
 *   3. Which contract it passed.
 *   4. Which source supplied each field.
 *   5. When it became public.
 *   6. Whether it counts toward threshold.
 *   7. Whether it has ever been updated.
 *   8. Whether it has ever failed QA.
 *   9. Whether search + sitemap can see it (verified live).
 *  10. Which cache tags revalidate it.
 *
 * The data is sourced from the new factory tables:
 *   - SourceDocument                — raw fetched page
 *   - ContentPackageBuildLog        — build attempts (success + failures)
 *   - RejectedContentLog            — QA / cleanup rejections
 *   - the public-content row itself — strict flags + provenance
 *
 * This module is read-only. Nothing here mutates state.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import type { ContentTypeKey } from "../content-factory";
import { verifyIndexing } from "../content-factory/search-sitemap-verifier";
import { tagsForRow, CONTENT_TYPE_TO_TAB } from "../cache/tags";

export type ContentReceipt = {
  contentType: ContentTypeKey | string;
  slug: string;
  /** The public row, or null when it does not exist (deleted / never persisted). */
  publicRow: {
    id: string;
    title: string;
    status: string;
    publicRenderReady: boolean;
    isThresholdEligible: boolean;
    sourceUrl: string | null;
    sourceHost: string | null;
    contentChecksum: string | null;
    packageValidationStatus: string | null;
    contentPackageVersion: string | null;
    /** Field provenance lifted from the most recent successful build log. */
    provenanceJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  /** Source document that produced the package, if traceable by URL. */
  sourceDocument: { id: string; sourceUrl: string; sourceHost: string; fetchedAt: Date } | null;
  /** All build attempts known for this slug + content type (most recent first). */
  buildLog: Array<{
    id: string;
    builderName: string;
    builderVersion: string;
    buildStatus: string;
    failureReason: string | null;
    missingFields: string[];
    createdAt: Date;
  }>;
  /** Any QA rejections recorded against this slug + content type. */
  qaRejections: Array<{
    id: string;
    rejectionReason: string;
    failedContractName: string | null;
    failedFields: string[];
    decision: string;
    createdAt: Date;
  }>;
  /**
   * Search + sitemap verification — re-runs the strict public, search
   * and sitemap queries this slug must appear in. Null when there is
   * no public row to verify.
   */
  indexing: {
    visibleInPublicQuery: boolean;
    visibleInSitemap: boolean;
    visibleInSearch: boolean;
    reasons: Record<string, string | null>;
  } | null;
  /** Cache tags revalidated whenever this item is created / changed / deleted. */
  cacheRevalidation: {
    tabKey: string;
    tags: string[];
  };
  /** Counts derived from the data above. */
  derived: {
    everUpdated: boolean;
    everFailedQA: boolean;
    countsTowardThreshold: boolean;
    becamePublicAt: Date | null;
    builderName: string | null;
    builderVersion: string | null;
    contractName: string | null;
  };
  /** Errors per data source so the admin sees which lookups failed. */
  errors: Record<string, string>;
};

const PUBLIC_MODEL_FOR_TYPE: Record<string, string> = {
  Prayer: "prayer",
  Saint: "saint",
  MarianApparition: "marianApparition",
  Parish: "parish",
  Devotion: "devotion",
  Novena: "devotion",
  Sacrament: "spiritualLifeGuide",
  Rosary: "devotion",
  Consecration: "spiritualLifeGuide",
  SpiritualGuidance: "spiritualLifeGuide",
  Liturgy: "liturgyEntry",
  LiturgyEntry: "liturgyEntry",
  History: "liturgyEntry",
};

async function safeRead<T>(
  fn: () => Promise<T>,
  label: string,
  errors: Record<string, string>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors[label] = msg;
    logger.warn("content-receipt.read_failed", { label, error: msg });
    return null;
  }
}

export async function getContentReceipt(input: {
  contentType: ContentTypeKey | string;
  slug: string;
}): Promise<ContentReceipt> {
  const errors: Record<string, string> = {};
  const modelName = PUBLIC_MODEL_FOR_TYPE[input.contentType] ?? null;
  const publicRow = modelName
    ? await safeRead(
        async () => {
          const delegate = (
            prisma as unknown as Record<
              string,
              {
                findUnique: (a: {
                  where: { slug: string };
                  select?: Record<string, boolean>;
                }) => Promise<Record<string, unknown> | null>;
              }
            >
          )[modelName];
          if (!delegate) return null;
          // We deliberately use the loose object form here so a
          // model that lacks an optional field (e.g. `title` vs
          // `defaultTitle`) doesn't break the receipt. The
          // additional fields are read off the row generically.
          const row = await delegate.findUnique({ where: { slug: input.slug } });
          if (!row) return null;
          return row;
        },
        "publicRow",
        errors,
      )
    : null;

  const buildLogs = await safeRead(
    () =>
      prisma.contentPackageBuildLog.findMany({
        where: {
          contentType: input.contentType,
          candidateSlug: input.slug,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    "buildLog",
    errors,
  );
  const qaRejections = await safeRead(
    () =>
      prisma.rejectedContentLog.findMany({
        where: {
          contentType: input.contentType,
          slug: input.slug,
        },
        orderBy: { deletedAt: "desc" },
        take: 50,
      }),
    "qaRejections",
    errors,
  );
  const sourceUrl = publicRow ? ((publicRow.sourceUrl as string | null) ?? null) : null;
  const sourceDocument = sourceUrl
    ? await safeRead(
        () =>
          prisma.sourceDocument.findUnique({
            where: { sourceUrl },
            select: { id: true, sourceUrl: true, sourceHost: true, fetchedAt: true },
          }),
        "sourceDocument",
        errors,
      )
    : null;

  // Search + sitemap verification — re-run the public-facing queries.
  const indexing = publicRow
    ? await safeRead(
        () => verifyIndexing({ contentType: String(input.contentType), slug: input.slug }),
        "indexing",
        errors,
      )
    : null;

  // Cache tags revalidated whenever this item changes.
  const cacheRevalidation = {
    tabKey: CONTENT_TYPE_TO_TAB[input.contentType as keyof typeof CONTENT_TYPE_TO_TAB] ?? "—",
    tags: tagsForRow(String(input.contentType), input.slug),
  };

  const latestSuccess = (buildLogs ?? []).find(
    (b: { buildStatus: string }) => b.buildStatus === "built_complete_package",
  );
  const everUpdated =
    publicRow != null &&
    publicRow.updatedAt instanceof Date &&
    publicRow.createdAt instanceof Date &&
    (publicRow.updatedAt as Date).getTime() > (publicRow.createdAt as Date).getTime();
  return {
    contentType: input.contentType,
    slug: input.slug,
    publicRow: publicRow
      ? {
          id: publicRow.id as string,
          title:
            (publicRow.title as string | undefined) ??
            (publicRow.defaultTitle as string | undefined) ??
            input.slug,
          status: publicRow.status as string,
          publicRenderReady: !!publicRow.publicRenderReady,
          isThresholdEligible: !!publicRow.isThresholdEligible,
          sourceUrl: (publicRow.sourceUrl as string | null | undefined) ?? null,
          sourceHost: (publicRow.sourceHost as string | null | undefined) ?? null,
          contentChecksum: (publicRow.contentChecksum as string | null | undefined) ?? null,
          packageValidationStatus:
            (publicRow.packageValidationStatus as string | null | undefined) ?? null,
          contentPackageVersion:
            (publicRow.contentPackageVersion as string | null | undefined) ?? null,
          provenanceJson:
            (latestSuccess as { provenanceJson?: unknown } | undefined)?.provenanceJson ?? null,
          createdAt: publicRow.createdAt as Date,
          updatedAt: publicRow.updatedAt as Date,
        }
      : null,
    sourceDocument: sourceDocument
      ? {
          id: sourceDocument.id,
          sourceUrl: sourceDocument.sourceUrl,
          sourceHost: sourceDocument.sourceHost,
          fetchedAt: sourceDocument.fetchedAt,
        }
      : null,
    buildLog: (buildLogs ?? []).map(
      (b: {
        id: string;
        builderName: string;
        builderVersion: string;
        buildStatus: string;
        failureReason: string | null;
        missingFieldsJson: unknown;
        createdAt: Date;
      }) => ({
        id: b.id,
        builderName: b.builderName,
        builderVersion: b.builderVersion,
        buildStatus: b.buildStatus,
        failureReason: b.failureReason,
        missingFields: Array.isArray(b.missingFieldsJson) ? (b.missingFieldsJson as string[]) : [],
        createdAt: b.createdAt,
      }),
    ),
    qaRejections: (qaRejections ?? []).map(
      (r: {
        id: string;
        rejectionReason: string;
        failedContractName: string | null;
        failedFields: unknown;
        decision: string;
        deletedAt: Date;
      }) => ({
        id: r.id,
        rejectionReason: r.rejectionReason,
        failedContractName: r.failedContractName,
        failedFields: Array.isArray(r.failedFields) ? (r.failedFields as string[]) : [],
        decision: r.decision,
        createdAt: r.deletedAt,
      }),
    ),
    indexing: indexing
      ? {
          visibleInPublicQuery: indexing.visibleInPublicQuery,
          visibleInSitemap: indexing.visibleInSitemap,
          visibleInSearch: indexing.visibleInSearch,
          reasons: indexing.reasons,
        }
      : null,
    cacheRevalidation,
    derived: {
      everUpdated,
      everFailedQA: (qaRejections ?? []).length > 0,
      countsTowardThreshold:
        !!publicRow && !!publicRow.publicRenderReady && !!publicRow.isThresholdEligible,
      becamePublicAt:
        publicRow && publicRow.status === "PUBLISHED" ? (publicRow.createdAt as Date) : null,
      builderName: latestSuccess?.builderName ?? null,
      builderVersion: latestSuccess?.builderVersion ?? null,
      contractName:
        (qaRejections ?? []).find(
          (r: { failedContractName: string | null }) => r.failedContractName,
        )?.failedContractName ?? null,
    },
    errors,
  };
}
