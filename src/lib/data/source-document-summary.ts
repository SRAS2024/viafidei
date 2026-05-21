/**
 * Source document summary.
 *
 * Counts fetched source documents directly from the `SourceDocument`
 * table — never inferred from `ContentPackageBuildLog`. Answers
 * "did source fetch produce anything, and is the build stage
 * consuming it?" for the content growth dashboard.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type SourceDocumentSummary = {
  ok: boolean;
  sourceDocumentsCreated: number | null;
  sourceDocumentsCreated24h: number | null;
  sourceDocumentsWaitingForBuild: number | null;
  sourceDocumentsWithBuildAttempts: number | null;
  sourceDocumentsWithoutBuildAttempt: number | null;
  sourceFetchSucceeded: number | null;
  sourceFetchFailed: number | null;
  /** Plain-language line the dashboard shows first. Empty when healthy. */
  summaryMessage: string;
  errors: Record<string, string>;
};

async function safeCount(
  fn: () => Promise<number>,
  label: string,
  errors: Record<string, string>,
): Promise<number | null> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors[label] = msg;
    logger.warn("source-document-summary.query_failed", { label, error: msg });
    return null;
  }
}

export async function getSourceDocumentSummary(): Promise<SourceDocumentSummary> {
  const errors: Record<string, string> = {};
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sourceDocumentsCreated = await safeCount(
    () => prisma.sourceDocument.count(),
    "sourceDocumentsCreated",
    errors,
  );
  const sourceDocumentsCreated24h = await safeCount(
    () => prisma.sourceDocument.count({ where: { createdAt: { gt: since24h } } }),
    "sourceDocumentsCreated24h",
    errors,
  );
  const sourceFetchSucceeded = await safeCount(
    () => prisma.sourceDocument.count({ where: { fetchStatus: "ok" } }),
    "sourceFetchSucceeded",
    errors,
  );
  const sourceFetchFailed = await safeCount(
    () => prisma.sourceDocument.count({ where: { fetchStatus: { not: "ok" } } }),
    "sourceFetchFailed",
    errors,
  );
  // Source documents that have at least one build attempt — the count
  // of distinct sourceDocumentId values on ContentPackageBuildLog
  // (the join-free pattern the content growth dashboard uses).
  const withBuildAttempts = await safeCount(
    () =>
      prisma.contentPackageBuildLog
        .groupBy({ by: ["sourceDocumentId"], where: { sourceDocumentId: { not: null } } })
        .then((rows) => rows.length),
    "sourceDocumentsWithBuildAttempts",
    errors,
  );
  const sourceDocumentsWithBuildAttempts = withBuildAttempts;
  const sourceDocumentsWithoutBuildAttempt =
    sourceDocumentsCreated != null && withBuildAttempts != null
      ? Math.max(0, sourceDocumentsCreated - withBuildAttempts)
      : null;
  // "Waiting for build" is the same set as "without a build attempt"
  // — surfaced under the spec-named metric the dashboard warning reads.
  const sourceDocumentsWaitingForBuild = sourceDocumentsWithoutBuildAttempt;

  let summaryMessage = "";
  if (sourceDocumentsCreated != null && sourceDocumentsCreated === 0) {
    summaryMessage = "Source fetch has not produced documents yet.";
  } else if (
    sourceDocumentsCreated != null &&
    sourceDocumentsCreated > 0 &&
    (withBuildAttempts ?? 0) === 0
  ) {
    summaryMessage = "Source documents exist, but content build has not started.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    sourceDocumentsCreated,
    sourceDocumentsCreated24h,
    sourceDocumentsWaitingForBuild,
    sourceDocumentsWithBuildAttempts,
    sourceDocumentsWithoutBuildAttempt,
    sourceFetchSucceeded,
    sourceFetchFailed,
    summaryMessage,
    errors,
  };
}
