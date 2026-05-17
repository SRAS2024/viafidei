/**
 * Build log helpers.
 *
 * Every builder attempt writes one ContentPackageBuildLog row —
 * success or failure. Pair with RejectedContentLog (post-QA): build
 * logs answer "why was this content not created?" and rejected logs
 * answer "why was this content deleted?".
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import type { BuildResult, ContentTypeKey } from "./types";

export type BuildLogInput = {
  result: BuildResult;
  sourceDocumentId?: string | null;
  sourceUrl: string;
  sourceHost: string;
  workerJobId?: string | null;
  ingestionBatchId?: string | null;
  contentRef?: string | null;
};

export async function recordBuildLog(input: BuildLogInput): Promise<void> {
  try {
    await prisma.contentPackageBuildLog.create({
      data: {
        sourceDocumentId: input.sourceDocumentId ?? null,
        sourceUrl: input.sourceUrl,
        sourceHost: input.sourceHost,
        contentType: input.result.contentType,
        builderName: input.result.builderName,
        builderVersion: input.result.builderVersion,
        buildStatus: input.result.outcome,
        candidateSlug:
          input.result.outcome === "built_complete_package"
            ? input.result.package.slug
            : input.result.candidateSlug ?? null,
        extractedFieldsJson:
          input.result.outcome === "built_complete_package"
            ? (sanitizeForJson(input.result.package.payload) as object)
            : input.result.partialPayload
              ? (sanitizeForJson(input.result.partialPayload) as object)
              : undefined,
        missingFieldsJson: (input.result.missingFields ?? []) as unknown as object,
        provenanceJson:
          input.result.outcome === "built_complete_package"
            ? (sanitizeForJson(input.result.package.provenance) as object)
            : undefined,
        failureReason:
          input.result.outcome === "built_complete_package"
            ? null
            : input.result.failureReason,
        workerJobId: input.workerJobId ?? null,
        ingestionBatchId: input.ingestionBatchId ?? null,
        contentRef: input.contentRef ?? null,
      },
    });
  } catch (e) {
    logger.warn("content-factory.build-log.write_failed", {
      sourceUrl: input.sourceUrl,
      contentType: input.result.contentType,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function listRecentBuildFailures(args: {
  contentType?: ContentTypeKey;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    contentType: string;
    sourceUrl: string;
    sourceHost: string;
    buildStatus: string;
    failureReason: string | null;
    missingFields: string[];
    createdAt: Date;
  }>
> {
  const rows = await prisma.contentPackageBuildLog.findMany({
    where: {
      ...(args.contentType ? { contentType: args.contentType } : {}),
      buildStatus: { not: "built_complete_package" },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(args.limit ?? 50, 500)),
  });
  return rows.map((r) => ({
    id: r.id,
    contentType: r.contentType,
    sourceUrl: r.sourceUrl,
    sourceHost: r.sourceHost,
    buildStatus: r.buildStatus,
    failureReason: r.failureReason,
    missingFields: Array.isArray(r.missingFieldsJson)
      ? (r.missingFieldsJson as string[])
      : [],
    createdAt: r.createdAt,
  }));
}

/**
 * Strip non-serialisable values out of a payload before writing it to
 * the JSON column. Keeps Date/Map/Set/etc from breaking Prisma.
 */
function sanitizeForJson(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (value instanceof Set) return Array.from(value);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForJson(v);
    }
    return out;
  }
  return value;
}
