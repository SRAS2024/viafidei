/**
 * Existing-content strict audit. The cleanup loop scans the catalog
 * and validates every row against the strict package contract for its
 * content type. Under the production policy (`deleteAllInvalid: true`,
 * `scanAllCatalogRows: true`) the outcomes are:
 *
 *   - `publish`  — keep row, mark valid, mark render-ready, mark
 *                  threshold-eligible.
 *   - `update`   — keep row, write the validation flags, mark valid.
 *   - `skip`     — keep row only if it is already valid and unchanged.
 *   - `reject`   — write RejectedContentLog, then delete row.
 *   - `delete`   — write RejectedContentLog, then delete row.
 *   - `archive`  — never produced by the automatic loop (kept for
 *                  admin-triggered archival of valid historical
 *                  content).
 *   - `review`   — never produced by the automatic loop. REVIEW is an
 *                  optional admin holding area; failed QA must NOT
 *                  leave a row in REVIEW or DRAFT under the strict
 *                  policy.
 *
 * Rows that fail validation are deleted transactionally:
 *
 *   1. Validate the row.
 *   2. Write RejectedContentLog (capturing contract name, failed
 *      fields, source URL, original status, original checksum, worker
 *      job id, ingestion batch id, sweep reason, package version).
 *   3. Delete the catalog row.
 *
 * If the rejection-log write fails, the row is left in place and the
 * cleanup error is surfaced so the next sweep can retry. The row is
 * never deleted without a forensic log entry.
 *
 * The sweep mode is configurable:
 *
 *   - `public_only`       — only inspect PUBLISHED + publicRenderReady=true
 *                            rows (legacy behavior).
 *   - `all_catalog_rows`  — inspect every status (PUBLISHED, REVIEW,
 *                            DRAFT, ARCHIVED) plus rows with stale
 *                            package flags or stale contract version.
 *                            Production runs in this mode.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { logger } from "../observability";
import { recordRejectedContentBatch, type RejectedContentLogInput } from "./rejected-log";
import { detectWrongContent } from "./wrong-content-detector";
import { staticPurposesForHost, type SourcePurposeRecord } from "./source-purpose";
import { runStrictPipelineSync } from "./pipeline";
import { isCanonicalSacramentKey, normalizeSacrament } from "./sacrament-normalize";
import { VALID_HISTORY_TYPES } from "./contracts/history";
import { resolveCleanupPolicy, type CleanupMode, type CleanupPolicy } from "./cleanup-policy";
import type { CandidatePackage, ContractValidationResult, ContentTypeKey } from "./types";

export type ContentTypeCleanupSummary = {
  contentType: string;
  inspected: number;
  flaggedReady: number;
  flaggedUnready: number;
  hardDeleted: number;
  logFailures: number;
};

export type StrictCleanupSummary = {
  buckets: ContentTypeCleanupSummary[];
  totalInspected: number;
  totalFlaggedReady: number;
  totalFlaggedUnready: number;
  totalHardDeleted: number;
  totalLogFailures: number;
  mode: CleanupMode;
  deleteAllInvalid: boolean;
  packageContractVersion: string;
  ranAt: Date;
};

export type RunStrictContentCleanupOptions = {
  /** Override the resolved policy. Used by tests and admin one-shots. */
  policy?: Partial<CleanupPolicy>;
  /**
   * Short label written to RejectedContentLog.sweepReason so the admin
   * can see what triggered each delete. Defaults to "scheduled".
   */
  sweepReason?: string;
  /** Trigger source — automatic system run or admin-initiated. */
  triggeredBy?: "automatic" | "manual";
  /** Admin username for manual runs (logged to RejectedContentLog). */
  actorUsername?: string | null;
};

/**
 * Convert a DB row into a CandidatePackage so the pipeline can validate
 * it. The shape mirrors how the runner builds candidates from adapter
 * results, so the same contract code applies in both places.
 */
function rowToCandidate(args: {
  contentType: ContentTypeKey | "SpiritualLifeGuide" | "LiturgyEntry";
  row: Record<string, unknown>;
}): CandidatePackage {
  const r = args.row;
  switch (args.contentType) {
    case "Prayer":
      return {
        contentType: "Prayer",
        slug: r.slug as string,
        title: r.defaultTitle as string,
        sourceUrl: (r.sourceUrl as string) ?? (r.externalSourceKey as string),
        sourceHost: r.sourceHost as string | undefined,
        payload: {
          prayerType: r.prayerType ?? null,
          prayerName: r.defaultTitle,
          prayerText: r.body,
          category: r.category,
          language: r.language ?? "en",
          contentChecksum: r.contentChecksum,
        },
      };
    case "Saint":
      return {
        contentType: "Saint",
        slug: r.slug as string,
        title: r.canonicalName as string,
        sourceUrl: (r.sourceUrl as string) ?? (r.externalSourceKey as string),
        sourceHost: r.sourceHost as string | undefined,
        payload: {
          saintType: r.saintType ?? "Saint",
          saintName: r.canonicalName,
          feastDay: r.feastDay,
          feastMonth: r.feastMonth,
          feastDayOfMonth: r.feastDayOfMonth,
          background: r.biography,
          patronage: r.patronages,
          // Existing rows are seeded before we knew which sources provide
          // a feast day; treat missing feast day as informational, not
          // structural for cleanup.
          sourceProvidesFeastDay: false,
        },
      };
    case "MarianApparition":
      return {
        contentType: "MarianApparition",
        slug: r.slug as string,
        title: r.title as string,
        sourceUrl: (r.sourceUrl as string) ?? (r.externalSourceKey as string),
        sourceHost: r.sourceHost as string | undefined,
        payload: {
          apparitionName: r.title,
          location: r.location,
          country: r.country,
          approvalStatus: r.approvedStatus,
          background: r.background ?? r.summary,
          summary: r.summary,
        },
      };
    case "Devotion": {
      const subtype = r.subtype as string | null;
      const contentType: ContentTypeKey =
        subtype === "Novena" ? "Novena" : subtype === "Rosary" ? "Rosary" : "Devotion";
      const meta = r.packageMetadata as Record<string, unknown> | null;
      return {
        contentType,
        slug: r.slug as string,
        title: r.title as string,
        sourceUrl: (r.sourceUrl as string) ?? (r.externalSourceKey as string),
        sourceHost: r.sourceHost as string | undefined,
        payload: {
          devotionType: r.devotionType,
          devotionName: r.title,
          background: r.background ?? r.summary,
          practiceInstructions: r.practiceInstructions ?? r.practiceText,
          duration: r.durationMinutes,
          ...(meta ?? {}),
        },
      };
    }
    case "SpiritualLifeGuide": {
      const subtype = r.subtype as string | null;
      const sacramentKey = r.sacramentKey as string | null;
      let contentType: ContentTypeKey = "SpiritualGuidance";
      if (sacramentKey && isCanonicalSacramentKey(sacramentKey)) contentType = "Sacrament";
      else if (subtype === "Rosary") contentType = "Rosary";
      else if (subtype === "Consecration") contentType = "Consecration";
      const meta = r.packageMetadata as Record<string, unknown> | null;
      return {
        contentType,
        slug: r.slug as string,
        title: r.title as string,
        sourceUrl: (r.sourceUrl as string) ?? (r.externalSourceKey as string),
        sourceHost: r.sourceHost as string | undefined,
        payload: {
          sacramentKey,
          sacramentName: r.title,
          sacramentGroup: r.sacramentGroup,
          background: r.background ?? r.summary,
          catholicExplanation: r.bodyText,
          preparationGuide: r.bodyText,
          participationGuide: r.bodyText,
          title: r.title,
          guideType: r.kind,
          guideName: r.title,
          practicalPurpose: r.summary,
          steps: r.steps,
          consecrationName: r.title,
          finalConsecrationPrayer: (meta?.finalConsecrationPrayer as string) ?? "",
          dailyPrayers: (meta?.dailyPrayers as unknown[]) ?? [],
          durationDays: r.durationDays,
          howToPray: r.bodyText,
          openingPrayers: (meta?.openingPrayers as string[]) ?? [],
          mysterySets: (meta?.mysterySets as unknown[]) ?? [],
          decadeStructure: (meta?.decadeStructure as string) ?? "",
          closingPrayers: (meta?.closingPrayers as string[]) ?? [],
          ...(meta ?? {}),
        },
      };
    }
    case "LiturgyEntry": {
      const historyType = r.historyType as string | null;
      const contentType: ContentTypeKey = historyType ? "History" : "Liturgy";
      return {
        contentType,
        slug: r.slug as string,
        title: r.title as string,
        sourceUrl: (r.sourceUrl as string) ?? (r.externalSourceKey as string),
        sourceHost: r.sourceHost as string | undefined,
        payload: {
          historyType,
          title: r.title,
          dateOrEra: r.dateOrEra,
          summary: r.summary,
          body: r.body,
          liturgyKind: r.kind === "GENERAL" ? "General liturgical formation" : r.kind,
        },
      };
    }
    case "Parish":
      return {
        contentType: "Parish",
        slug: r.slug as string,
        title: r.name as string,
        sourceUrl:
          (r.sourceUrl as string) ?? (r.externalSourceKey as string) ?? (r.websiteUrl as string),
        sourceHost: r.sourceHost as string | undefined,
        payload: {
          parishName: r.name,
          address: r.address,
          city: r.city,
          region: r.region,
          country: r.country,
          diocese: r.diocese,
          websiteUrl: r.websiteUrl,
        },
      };
    default:
      return args.row as unknown as CandidatePackage;
  }
}

type Updater = (result: ContractValidationResult, row: Record<string, unknown>) => Promise<void>;

/**
 * Categorise a rejection reason into one of the buckets the admin
 * dashboard cares about. Used to populate RejectedContentLog.
 * `failureCategory` so the dashboard can show breakdowns without
 * re-parsing the reason string.
 */
function categoriseFailure(result: ContractValidationResult): string {
  if (result.contractName === "WrongContentDetector") return "wrong_content";
  const reason = result.reason.toLowerCase();
  if (reason.includes("not approved to ingest")) return "source_purpose_mismatch";
  if (reason.includes("missing required field") || reason.includes("missing required"))
    return "missing_required_field";
  if (reason.includes("format") || reason.includes("malformed")) return "format_invalid";
  if (reason.includes("render-ready") || reason.includes("cannot render"))
    return "render_not_ready";
  if (reason.includes("duplicate")) return "duplicate";
  // A non-publish/non-update result with no clear bucket is still a
  // missing-required-field-shaped failure in practice.
  if (result.failedFields && result.failedFields.length > 0) return "missing_required_field";
  return "unknown";
}

/**
 * Generic per-table cleanup. Reads rows, runs the strict pipeline, and
 * either updates the validation flags or deletes the row. Under
 * `deleteAllInvalid: true`, any non-publish/non-update result becomes
 * a delete (after writing a RejectedContentLog row). Under
 * `deleteAllInvalid: false`, the legacy "remove from public view"
 * behavior is used for missing-field failures while wrong-content
 * stays a delete.
 */
async function cleanupTable<TRow extends Record<string, unknown>>(args: {
  contentType: string;
  contractContentType:
    | ContentTypeKey
    | "DevotionParent"
    | "SpiritualLifeGuideParent"
    | "LiturgyEntryParent";
  fetchRows: () => Promise<TRow[]>;
  /** A delete function that hard-deletes the row by id. */
  deleteRow: (id: string) => Promise<void>;
  /** A function that updates the row's flags + reasons. */
  updateRow: Updater;
  policy: CleanupPolicy;
  sweepReason: string;
  triggeredBy: "automatic" | "manual";
  actorUsername?: string | null;
}): Promise<{ summary: ContentTypeCleanupSummary; rejections: RejectedContentLogInput[] }> {
  const rows = await args.fetchRows();
  const rejections: RejectedContentLogInput[] = [];
  let flaggedReady = 0;
  let flaggedUnready = 0;
  let hardDeleted = 0;
  let logFailures = 0;

  for (const row of rows) {
    // Resolve actual contract content type for the row.
    let candidate: CandidatePackage;
    if (args.contractContentType === "DevotionParent") {
      candidate = rowToCandidate({ contentType: "Devotion", row });
    } else if (args.contractContentType === "SpiritualLifeGuideParent") {
      candidate = rowToCandidate({ contentType: "SpiritualLifeGuide", row });
    } else if (args.contractContentType === "LiturgyEntryParent") {
      candidate = rowToCandidate({ contentType: "LiturgyEntry", row });
    } else {
      candidate = rowToCandidate({
        contentType: args.contractContentType as ContentTypeKey,
        row,
      });
    }

    const sourceHost = (row.sourceHost as string | undefined) ?? undefined;
    const purposes: SourcePurposeRecord = staticPurposesForHost(sourceHost ?? null);
    const result = runStrictPipelineSync(candidate, purposes);

    const isPassing = result.decision === "publish" || result.decision === "update";
    const isWrongContent =
      result.contractName === "WrongContentDetector" || result.decision === "delete";
    // Delete rules:
    //   - Wrong-content always deletes (legacy behavior preserved).
    //   - Under deleteAllInvalid, every non-passing decision deletes
    //     (reject, skip-but-failed, archive, review all become delete).
    //   - Under the legacy policy, contract-reject decisions remain in
    //     the table with publicRenderReady=false + status=REVIEW.
    const shouldDelete = isWrongContent || (args.policy.deleteAllInvalid && !isPassing);

    if (shouldDelete) {
      // Strict transactional delete:
      //   1. Write RejectedContentLog (must succeed)
      //   2. Delete catalog row
      //
      // If logging fails, we DO NOT delete the row. The caller will
      // see the logFailure count and retry the cleanup job; the row
      // stays in place but it also remains invalid, so subsequent
      // sweeps will keep trying.
      const finalDecision: "delete" | "reject" = result.decision === "reject" ? "reject" : "delete";
      const logInput: RejectedContentLogInput = {
        contentType: result.contentType,
        slug: candidate.slug,
        originalTitle: candidate.title ?? null,
        sourceUrl: candidate.sourceUrl ?? null,
        sourceHost: sourceHost ?? null,
        rejectionReason: `Strict QA cleanup (${args.sweepReason}): ${result.reason}`,
        failedContractName: result.contractName,
        failedFields: result.failedFields,
        originalChecksum: (row.contentChecksum as string | null) ?? null,
        decision: finalDecision,
        triggeredBy: args.triggeredBy,
        actorUsername: args.actorUsername ?? null,
        workerJobId: (row.workerJobId as string | undefined) ?? null,
        ingestionBatchId: (row.ingestionBatchId as string | undefined) ?? null,
        packageVersion: result.contractVersion,
        validationDecision: result.decision,
        failureCategory: categoriseFailure(result),
        cleanupMode: args.policy.mode,
        sweepReason: args.sweepReason,
        originalStatus: (row.status as string | undefined) ?? null,
      };

      try {
        await recordRejectedContentBatch([logInput]);
      } catch (err) {
        logFailures += 1;
        logger.error("content_qa.cleanup.log_write_failed", {
          contentType: result.contentType,
          slug: candidate.slug,
          sourceUrl: candidate.sourceUrl,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        // Skip the delete — row stays in place, next sweep retries.
        if (isWrongContent) {
          // For wrong-content we still surface it as flaggedUnready so the
          // total reflects "rows that were not flipped to valid".
          flaggedUnready += 1;
        } else {
          flaggedUnready += 1;
        }
        continue;
      }

      try {
        await args.deleteRow(row.id as string);
        hardDeleted += 1;
        rejections.push(logInput);
      } catch (err) {
        // Delete failed *after* the log was written. We do NOT
        // double-log (the log entry already exists); we surface the
        // failure so the next sweep can retry.
        logFailures += 1;
        logger.error("content_qa.cleanup.delete_failed", {
          contentType: result.contentType,
          slug: candidate.slug,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
      continue;
    }

    if (isPassing) {
      flaggedReady += 1;
    } else {
      flaggedUnready += 1;
    }
    await args.updateRow(result, row);
  }

  return {
    summary: {
      contentType: args.contentType,
      inspected: rows.length,
      flaggedReady,
      flaggedUnready,
      hardDeleted,
      logFailures,
    },
    rejections,
  };
}

/**
 * Build the `where` clause for a cleanup sweep. `public_only` matches
 * the legacy behavior (PUBLISHED or publicRenderReady=true). The
 * `all_catalog_rows` mode matches every row regardless of status so
 * REVIEW / DRAFT / ARCHIVED rows + rows with stale package flags are
 * all included.
 */
function sweepWhere(args: { policy: CleanupPolicy }): Record<string, unknown> {
  if (args.policy.mode === "public_only") {
    return { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] };
  }
  // all_catalog_rows: no status filter — every row participates.
  return {};
}

/**
 * Run the strict cleanup pass across every catalog table. Idempotent
 * on a clean catalog: re-running is a no-op (rows stay valid +
 * publicRenderReady = true).
 */
export async function runStrictContentCleanup(
  options: RunStrictContentCleanupOptions = {},
): Promise<StrictCleanupSummary> {
  const resolved = resolveCleanupPolicy();
  const policy: CleanupPolicy = { ...resolved, ...options.policy };
  const sweepReason = options.sweepReason ?? "scheduled";
  const triggeredBy = options.triggeredBy ?? "automatic";
  const actorUsername = options.actorUsername ?? null;
  const ranAt = new Date();
  const allRejections: RejectedContentLogInput[] = [];
  const buckets: ContentTypeCleanupSummary[] = [];

  const baseTableArgs = { policy, sweepReason, triggeredBy, actorUsername };

  // Prayers
  {
    const { summary, rejections } = await cleanupTable({
      ...baseTableArgs,
      contentType: "Prayer",
      contractContentType: "Prayer",
      fetchRows: () =>
        prisma.prayer.findMany({
          where: sweepWhere({ policy }),
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.prayer.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.PrayerUpdateInput = updateData(result, policy);
        if (!result.publicRenderReady && !policy.deleteAllInvalid && row.status === "PUBLISHED") {
          // Legacy mode only: park failures in REVIEW so they leave public view.
          data.status = "REVIEW";
        }
        await prisma.prayer.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // Saints
  {
    const { summary, rejections } = await cleanupTable({
      ...baseTableArgs,
      contentType: "Saint",
      contractContentType: "Saint",
      fetchRows: () =>
        prisma.saint.findMany({
          where: sweepWhere({ policy }),
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.saint.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.SaintUpdateInput = updateData(result, policy);
        if (!result.publicRenderReady && !policy.deleteAllInvalid && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        await prisma.saint.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // Apparitions
  {
    const { summary, rejections } = await cleanupTable({
      ...baseTableArgs,
      contentType: "MarianApparition",
      contractContentType: "MarianApparition",
      fetchRows: () =>
        prisma.marianApparition.findMany({
          where: sweepWhere({ policy }),
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.marianApparition.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.MarianApparitionUpdateInput = updateData(result, policy);
        if (!result.publicRenderReady && !policy.deleteAllInvalid && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        await prisma.marianApparition.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // Devotions (parent + Novena + Rosary subtype)
  {
    const { summary, rejections } = await cleanupTable({
      ...baseTableArgs,
      contentType: "Devotion",
      contractContentType: "DevotionParent",
      fetchRows: () =>
        prisma.devotion.findMany({
          where: sweepWhere({ policy }),
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.devotion.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.DevotionUpdateInput = updateData(result, policy);
        if (!result.publicRenderReady && !policy.deleteAllInvalid && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        await prisma.devotion.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // SpiritualLifeGuide (covers Sacrament / Rosary / Consecration / Guide)
  {
    const { summary, rejections } = await cleanupTable({
      ...baseTableArgs,
      contentType: "SpiritualLifeGuide",
      contractContentType: "SpiritualLifeGuideParent",
      fetchRows: () =>
        prisma.spiritualLifeGuide.findMany({
          where: sweepWhere({ policy }),
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.spiritualLifeGuide.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.SpiritualLifeGuideUpdateInput = updateData(result, policy);
        if (!result.publicRenderReady && !policy.deleteAllInvalid && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        // Sacrament confession-to-reconciliation normalization on existing rows.
        const title = (row.title as string) ?? "";
        const body = (row.bodyText as string) ?? (row.summary as string) ?? "";
        const norm = normalizeSacrament({ title, body });
        if (norm.key && row.sacramentKey !== norm.key) {
          data.sacramentKey = norm.key;
          data.sacramentGroup = norm.group ?? undefined;
        }
        await prisma.spiritualLifeGuide.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // LiturgyEntry (covers Liturgy + History)
  {
    const { summary, rejections } = await cleanupTable({
      ...baseTableArgs,
      contentType: "LiturgyEntry",
      contractContentType: "LiturgyEntryParent",
      fetchRows: () =>
        prisma.liturgyEntry.findMany({
          where: sweepWhere({ policy }),
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.liturgyEntry.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.LiturgyEntryUpdateInput = updateData(result, policy);
        if (!result.publicRenderReady && !policy.deleteAllInvalid && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        await prisma.liturgyEntry.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // Parishes
  {
    const { summary, rejections } = await cleanupTable({
      ...baseTableArgs,
      contentType: "Parish",
      contractContentType: "Parish",
      fetchRows: () =>
        prisma.parish.findMany({
          where: sweepWhere({ policy }),
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.parish.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.ParishUpdateInput = updateData(result, policy);
        if (!result.publicRenderReady && !policy.deleteAllInvalid && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        await prisma.parish.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // Daily Liturgy — structured calendar data. Malformed rows are
  // hard-deleted with a RejectedContentLog entry so the day can be
  // re-ingested by the daily-liturgy adapter.
  try {
    const dailyRows = await prisma.dailyLiturgy.findMany({
      where: policy.mode === "public_only" ? { status: "PUBLISHED" } : {},
    });
    let dailyInspected = 0;
    let dailyFlaggedReady = 0;
    let dailyHardDeleted = 0;
    let dailyLogFailures = 0;
    for (const row of dailyRows) {
      dailyInspected += 1;
      const readings = row.readingsJson as Record<string, unknown> | null;
      const saints = row.saintsJson as unknown[] | null;
      const hasReadings = !!readings && Object.keys(readings).length > 0;
      const hasSaints = Array.isArray(saints) && saints.length > 0;
      if (!row.date || (!hasReadings && !hasSaints)) {
        const logInput: RejectedContentLogInput = {
          contentType: "Liturgy",
          slug: row.id,
          originalTitle: row.feastTitle ?? null,
          sourceUrl: null,
          sourceHost: null,
          rejectionReason:
            "Daily liturgy row is structurally incomplete (missing date or both readings and saints)",
          failedContractName: "DailyLiturgyValidation",
          failedFields: !row.date ? ["date"] : ["readingsJson", "saintsJson"],
          originalChecksum: null,
          decision: "delete",
          triggeredBy,
          actorUsername,
          packageVersion: policy.packageContractVersion,
          validationDecision: "delete",
          failureCategory: "missing_required_field",
          cleanupMode: policy.mode,
          sweepReason,
          originalStatus: (row.status as string | undefined) ?? null,
        };
        try {
          await recordRejectedContentBatch([logInput]);
        } catch (err) {
          dailyLogFailures += 1;
          logger.error("content_qa.cleanup.daily_log_failed", {
            slug: row.id,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
        try {
          await prisma.dailyLiturgy.delete({ where: { id: row.id } });
          dailyHardDeleted += 1;
          allRejections.push(logInput);
        } catch (err) {
          dailyLogFailures += 1;
          logger.error("content_qa.cleanup.daily_delete_failed", {
            slug: row.id,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        dailyFlaggedReady += 1;
      }
    }
    buckets.push({
      contentType: "DailyLiturgy",
      inspected: dailyInspected,
      flaggedReady: dailyFlaggedReady,
      flaggedUnready: 0,
      hardDeleted: dailyHardDeleted,
      logFailures: dailyLogFailures,
    });
  } catch (err) {
    logger.error("content_qa.cleanup.daily_table_failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }

  // Write the last-run timestamp so the cleanupHealth diagnostic can
  // tell whether the loop is fresh. Best-effort — failure here must
  // not block the sweep.
  try {
    await recordCleanupRun({
      ranAt,
      mode: policy.mode,
      deleteAllInvalid: policy.deleteAllInvalid,
      summary: {
        inspected: buckets.reduce((s, b) => s + b.inspected, 0),
        deleted: buckets.reduce((s, b) => s + b.hardDeleted, 0),
        logFailures: buckets.reduce((s, b) => s + b.logFailures, 0),
      },
    });
  } catch (err) {
    logger.error("content_qa.cleanup.record_run_failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    buckets,
    totalInspected: buckets.reduce((s, b) => s + b.inspected, 0),
    totalFlaggedReady: buckets.reduce((s, b) => s + b.flaggedReady, 0),
    totalFlaggedUnready: buckets.reduce((s, b) => s + b.flaggedUnready, 0),
    totalHardDeleted: buckets.reduce((s, b) => s + b.hardDeleted, 0),
    totalLogFailures: buckets.reduce((s, b) => s + b.logFailures, 0),
    mode: policy.mode,
    deleteAllInvalid: policy.deleteAllInvalid,
    packageContractVersion: policy.packageContractVersion,
    ranAt,
  };
}

/** Build the row-update payload for a passing or failing validation. */
function updateData(
  result: ContractValidationResult,
  policy: CleanupPolicy,
): Record<string, unknown> {
  const isPassing = result.decision === "publish" || result.decision === "update";
  return {
    publicRenderReady: result.publicRenderReady,
    isThresholdEligible: result.isThresholdEligible,
    packageValidationStatus: isPassing ? "valid" : "invalid",
    packageValidationErrors: result.failedFields,
    contentPackageVersion: policy.packageContractVersion,
    lastPackageValidatedAt: new Date(),
  };
}

/**
 * Persist the cleanup run summary so the cleanupHealth diagnostic can
 * tell when the loop last ran. We write to DataManagementLog because
 * it is already the existing audit channel; the diagnostic reads back
 * the most recent CLEANUP action row.
 */
async function recordCleanupRun(args: {
  ranAt: Date;
  mode: CleanupMode;
  deleteAllInvalid: boolean;
  summary: { inspected: number; deleted: number; logFailures: number };
}): Promise<void> {
  void args.ranAt;
  await prisma.dataManagementLog.create({
    data: {
      action: "CLEANUP",
      contentType: "ContentQA",
      contentRef: "strict-cleanup",
      reason: `Strict cleanup: mode=${args.mode} deleteAllInvalid=${args.deleteAllInvalid} inspected=${args.summary.inspected} deleted=${args.summary.deleted} logFailures=${args.summary.logFailures}`,
      triggeredBy: "automatic",
    },
  });
}

/** Re-export the history allowlist for the dashboard. */
export { VALID_HISTORY_TYPES };
// Silence unused import warning — detectWrongContent is exported for
// admin/test access to the cleanup module's symbols.
export { detectWrongContent };
