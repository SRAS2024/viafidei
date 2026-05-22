/**
 * Builder weakness diagnostic.
 *
 * Groups recent ContentPackageBuildLog failures by (contentType,
 * missingField) so the admin sees patterns like:
 *
 *   "8 Novena builds failed because Day 7 could not be parsed →
 *    NovenaBuilder day parser weakness"
 *   "12 Saint builds failed because patronage was missing →
 *    SaintBuilder enrichment / source selection issue"
 *
 * The pattern is observable purely from the build log; no schema
 * change is required.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import type { ContentTypeKey } from "../content-factory";

const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_REPETITION_FOR_WEAKNESS = 3;

export type BuilderWeaknessEntry = {
  builderName: string;
  contentType: ContentTypeKey;
  /** Missing field that is repeatedly absent across builds. */
  missingField: string;
  failureCount: number;
  /** Human-readable advice for the admin. */
  message: string;
  /** Sample sourceUrls so the admin can drill in. */
  sampleSourceUrls: string[];
};

const WEAKNESS_MESSAGE_BY_CONTENT_TYPE: Partial<Record<ContentTypeKey, (field: string) => string>> =
  {
    Novena: (field) =>
      /day/i.test(field)
        ? "NovenaBuilder day parser weakness — the builder cannot identify Day N from these source pages."
        : `NovenaBuilder is missing ${field} repeatedly — the builder may need a more flexible extractor for this field.`,
    Saint: (field) =>
      /patronage/i.test(field)
        ? "SaintBuilder enrichment or source selection issue — patronage is not surfaced by the chosen sources."
        : /feast/i.test(field)
          ? "SaintBuilder feast-day extractor weakness — the builder cannot parse the feast date from these sources."
          : `SaintBuilder is missing ${field} repeatedly — review extractor or pick a richer source.`,
    Rosary: () =>
      "RosaryBuilder mystery extraction weakness — confirm the canonical Rosary structure is being used and the source provides texts.",
    Prayer: (field) =>
      /prayerText|body/i.test(field)
        ? "PrayerBuilder cannot isolate the actual prayer text — strengthen the prayer-language detector."
        : `PrayerBuilder is missing ${field} repeatedly.`,
    Sacrament: (field) =>
      /preparation/i.test(field)
        ? "SacramentBuilder preparation extractor weakness — preparation is not present on these source pages."
        : `SacramentBuilder is missing ${field} repeatedly.`,
  };

function defaultMessage(contentType: ContentTypeKey, field: string, count: number): string {
  return `${contentType}Builder is missing ${field} on ${count} recent builds — likely needs improvement or a richer source.`;
}

export async function getBuilderWeaknessReport(
  options: {
    windowMs?: number;
    minRepetition?: number;
  } = {},
): Promise<BuilderWeaknessEntry[]> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const minRepetition = options.minRepetition ?? MIN_REPETITION_FOR_WEAKNESS;
  const cutoff = new Date(Date.now() - windowMs);

  const rows = await prisma.contentPackageBuildLog
    .findMany({
      where: {
        buildStatus: { not: "built_complete_package" },
        createdAt: { gt: cutoff },
        missingFieldsJson: { not: null as never },
      },
      select: {
        contentType: true,
        builderName: true,
        sourceUrl: true,
        missingFieldsJson: true,
      },
      take: 2000,
    })
    .catch((e) => {
      logger.warn("builder-weakness.read_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [];
    });

  type Key = string;
  const acc = new Map<
    Key,
    {
      builderName: string;
      contentType: ContentTypeKey;
      field: string;
      count: number;
      urls: string[];
    }
  >();
  for (const r of rows) {
    const missing = Array.isArray(r.missingFieldsJson) ? (r.missingFieldsJson as string[]) : [];
    for (const field of missing) {
      if (typeof field !== "string") continue;
      const key = `${r.contentType}::${field}`;
      const existing = acc.get(key);
      if (existing) {
        existing.count += 1;
        if (existing.urls.length < 5 && r.sourceUrl) existing.urls.push(r.sourceUrl);
      } else {
        acc.set(key, {
          builderName: r.builderName,
          contentType: r.contentType as ContentTypeKey,
          field,
          count: 1,
          urls: r.sourceUrl ? [r.sourceUrl] : [],
        });
      }
    }
  }
  const entries: BuilderWeaknessEntry[] = [];
  for (const v of acc.values()) {
    if (v.count < minRepetition) continue;
    const messageFn = WEAKNESS_MESSAGE_BY_CONTENT_TYPE[v.contentType];
    const message = messageFn
      ? messageFn(v.field)
      : defaultMessage(v.contentType, v.field, v.count);
    entries.push({
      builderName: v.builderName,
      contentType: v.contentType,
      missingField: v.field,
      failureCount: v.count,
      message,
      sampleSourceUrls: v.urls,
    });
  }
  entries.sort((a, b) => b.failureCount - a.failureCount);
  return entries;
}

/**
 * Multi-dimensional builder weakness breakdown.
 *
 * Groups recent failures along every spec-listed axis so the admin
 * can see which dimension a weakness clusters on: missing field,
 * source host, content type, builder version, package contract
 * version, source role, and cross-source validation evidence
 * failure.
 */
export type WeaknessGroup = {
  key: string;
  failureCount: number;
  sampleSourceUrls: string[];
};

export type BuilderWeaknessBreakdowns = {
  generatedAt: Date;
  byMissingField: WeaknessGroup[];
  bySourceHost: WeaknessGroup[];
  byContentType: WeaknessGroup[];
  byBuilderVersion: WeaknessGroup[];
  byPackageContractVersion: WeaknessGroup[];
  bySourceRole: WeaknessGroup[];
  byValidationEvidenceFailure: WeaknessGroup[];
};

function rollup(
  items: ReadonlyArray<{ key: string; sourceUrl?: string | null }>,
  minRepetition: number,
): WeaknessGroup[] {
  const map = new Map<string, { count: number; urls: string[] }>();
  for (const it of items) {
    if (!it.key) continue;
    const entry = map.get(it.key) ?? { count: 0, urls: [] };
    entry.count += 1;
    if (entry.urls.length < 5 && it.sourceUrl) entry.urls.push(it.sourceUrl);
    map.set(it.key, entry);
  }
  return [...map.entries()]
    .filter(([, v]) => v.count >= minRepetition)
    .map(([key, v]) => ({ key, failureCount: v.count, sampleSourceUrls: v.urls }))
    .sort((a, b) => b.failureCount - a.failureCount);
}

export async function getBuilderWeaknessBreakdowns(
  options: { windowMs?: number; minRepetition?: number } = {},
): Promise<BuilderWeaknessBreakdowns> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const minRepetition = options.minRepetition ?? MIN_REPETITION_FOR_WEAKNESS;
  const cutoff = new Date(Date.now() - windowMs);
  const generatedAt = new Date();

  const buildFailures = await prisma.contentPackageBuildLog
    .findMany({
      where: { buildStatus: { not: "built_complete_package" }, createdAt: { gt: cutoff } },
      select: {
        contentType: true,
        builderName: true,
        builderVersion: true,
        sourceHost: true,
        sourceUrl: true,
        missingFieldsJson: true,
      },
      take: 4000,
    })
    .catch((e) => {
      logger.warn("builder-weakness.breakdown_builds_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [] as Array<{
        contentType: string;
        builderName: string;
        builderVersion: string;
        sourceHost: string;
        sourceUrl: string;
        missingFieldsJson: unknown;
      }>;
    });

  // Source-host → role map for the source-role dimension.
  const hostRole = new Map<string, string>();
  try {
    const sources = await prisma.ingestionSource.findMany({ select: { host: true, role: true } });
    for (const s of sources) hostRole.set(s.host, s.role ?? "unknown");
  } catch (e) {
    logger.warn("builder-weakness.breakdown_roles_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const missingFieldItems: Array<{ key: string; sourceUrl?: string | null }> = [];
  for (const f of buildFailures) {
    const missing = Array.isArray(f.missingFieldsJson) ? (f.missingFieldsJson as string[]) : [];
    for (const field of missing) {
      if (typeof field === "string") {
        missingFieldItems.push({ key: `${f.contentType}:${field}`, sourceUrl: f.sourceUrl });
      }
    }
  }

  // Package contract version weakness — from QA rejections.
  const rejections = await prisma.rejectedContentLog
    .findMany({
      where: { deletedAt: { gt: cutoff } },
      select: { packageVersion: true, failedContractName: true, sourceUrl: true },
      take: 4000,
    })
    .catch(
      () =>
        [] as Array<{
          packageVersion: string | null;
          failedContractName: string | null;
          sourceUrl: string | null;
        }>,
    );

  // Cross-source validation evidence failures.
  const evidenceClient = prisma as unknown as {
    contentValidationEvidence?: {
      findMany: (
        a: Record<string, unknown>,
      ) => Promise<Array<{ contentType: string; fieldName: string; sourceUrl: string | null }>>;
    };
  };
  let evidenceFailures: Array<{
    contentType: string;
    fieldName: string;
    sourceUrl: string | null;
  }> = [];
  if (evidenceClient.contentValidationEvidence) {
    evidenceFailures = await evidenceClient.contentValidationEvidence
      .findMany({
        where: {
          validationDecision: { in: ["fail", "insufficient_evidence"] },
          createdAt: { gt: cutoff },
        },
        select: { contentType: true, fieldName: true, sourceUrl: true },
        take: 4000,
      })
      .catch(() => []);
  }

  return {
    generatedAt,
    byMissingField: rollup(missingFieldItems, minRepetition),
    bySourceHost: rollup(
      buildFailures.map((f) => ({ key: f.sourceHost, sourceUrl: f.sourceUrl })),
      minRepetition,
    ),
    byContentType: rollup(
      buildFailures.map((f) => ({ key: f.contentType, sourceUrl: f.sourceUrl })),
      minRepetition,
    ),
    byBuilderVersion: rollup(
      buildFailures.map((f) => ({
        key: `${f.builderName}@${f.builderVersion}`,
        sourceUrl: f.sourceUrl,
      })),
      minRepetition,
    ),
    byPackageContractVersion: rollup(
      rejections.map((r) => ({
        key: `${r.failedContractName ?? "unknown"}@${r.packageVersion ?? "unversioned"}`,
        sourceUrl: r.sourceUrl,
      })),
      minRepetition,
    ),
    bySourceRole: rollup(
      buildFailures.map((f) => ({
        key: hostRole.get(f.sourceHost) ?? "unknown",
        sourceUrl: f.sourceUrl,
      })),
      minRepetition,
    ),
    byValidationEvidenceFailure: rollup(
      evidenceFailures.map((e) => ({
        key: `${e.contentType}:${e.fieldName}`,
        sourceUrl: e.sourceUrl,
      })),
      minRepetition,
    ),
  };
}

/**
 * Build-log failure detail.
 *
 * Where `getBuilderWeaknessReport` only surfaces repeated weaknesses,
 * this report exposes the raw build-failure detail the spec asks for:
 * every recent failed build grouped along six axes — content type,
 * source host, source URL, builder, failure reason, and missing
 * fields — plus the most recent failing rows themselves. It answers
 * "what specifically should we tune?" instead of just "how many
 * builds failed".
 */
export type BuildLogDetailRow = {
  contentType: string;
  sourceHost: string;
  sourceUrl: string;
  builderName: string;
  builderVersion: string;
  buildStatus: string;
  failureReason: string | null;
  missingFields: string[];
  createdAt: Date;
};

export type BuildLogDetailReport = {
  generatedAt: Date;
  windowMs: number;
  totalFailures: number;
  byContentType: WeaknessGroup[];
  bySourceHost: WeaknessGroup[];
  bySourceUrl: WeaknessGroup[];
  byBuilder: WeaknessGroup[];
  byFailureReason: WeaknessGroup[];
  byMissingField: WeaknessGroup[];
  /** Most recent failing build-log rows, newest first. */
  rows: BuildLogDetailRow[];
};

const MAX_DETAIL_GROUPS = 50;
const MAX_DETAIL_ROWS = 200;

/**
 * Normalise a free-text failure reason into a stable grouping key.
 * "Missing required fields: prayerText" and "Missing required fields:
 * biography" collapse to "Missing required fields" so the report
 * surfaces the failure CLASS, not one row per field permutation.
 */
function normalizeFailureReason(reason: string | null | undefined, buildStatus: string): string {
  if (!reason) return buildStatus;
  const head = reason.split(/[:—]/)[0]?.trim();
  return head && head.length > 0 ? head : buildStatus;
}

export async function getBuildLogDetail(
  options: { windowMs?: number } = {},
): Promise<BuildLogDetailReport> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const cutoff = new Date(Date.now() - windowMs);
  const generatedAt = new Date();

  const failures = await prisma.contentPackageBuildLog
    .findMany({
      where: { buildStatus: { not: "built_complete_package" }, createdAt: { gt: cutoff } },
      orderBy: { createdAt: "desc" },
      select: {
        contentType: true,
        builderName: true,
        builderVersion: true,
        sourceHost: true,
        sourceUrl: true,
        buildStatus: true,
        failureReason: true,
        missingFieldsJson: true,
        createdAt: true,
      },
      take: 5000,
    })
    .catch((e) => {
      logger.warn("builder-weakness.build_log_detail_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      return [] as Array<{
        contentType: string;
        builderName: string;
        builderVersion: string;
        sourceHost: string;
        sourceUrl: string;
        buildStatus: string;
        failureReason: string | null;
        missingFieldsJson: unknown;
        createdAt: Date;
      }>;
    });

  const rows: BuildLogDetailRow[] = failures.map((f) => ({
    contentType: f.contentType,
    sourceHost: f.sourceHost,
    sourceUrl: f.sourceUrl,
    builderName: f.builderName,
    builderVersion: f.builderVersion,
    buildStatus: f.buildStatus,
    failureReason: f.failureReason,
    missingFields: Array.isArray(f.missingFieldsJson)
      ? (f.missingFieldsJson as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
    createdAt: f.createdAt,
  }));

  const missingFieldItems: Array<{ key: string; sourceUrl?: string | null }> = [];
  for (const r of rows) {
    for (const field of r.missingFields) {
      missingFieldItems.push({ key: `${r.contentType}:${field}`, sourceUrl: r.sourceUrl });
    }
  }

  return {
    generatedAt,
    windowMs,
    totalFailures: rows.length,
    byContentType: rollup(
      rows.map((r) => ({ key: r.contentType, sourceUrl: r.sourceUrl })),
      1,
    ).slice(0, MAX_DETAIL_GROUPS),
    bySourceHost: rollup(
      rows.map((r) => ({ key: r.sourceHost, sourceUrl: r.sourceUrl })),
      1,
    ).slice(0, MAX_DETAIL_GROUPS),
    bySourceUrl: rollup(
      rows.map((r) => ({ key: r.sourceUrl, sourceUrl: r.sourceUrl })),
      1,
    ).slice(0, MAX_DETAIL_GROUPS),
    byBuilder: rollup(
      rows.map((r) => ({ key: `${r.builderName}@${r.builderVersion}`, sourceUrl: r.sourceUrl })),
      1,
    ).slice(0, MAX_DETAIL_GROUPS),
    byFailureReason: rollup(
      rows.map((r) => ({
        key: normalizeFailureReason(r.failureReason, r.buildStatus),
        sourceUrl: r.sourceUrl,
      })),
      1,
    ).slice(0, MAX_DETAIL_GROUPS),
    byMissingField: rollup(missingFieldItems, 1).slice(0, MAX_DETAIL_GROUPS),
    rows: rows.slice(0, MAX_DETAIL_ROWS),
  };
}
