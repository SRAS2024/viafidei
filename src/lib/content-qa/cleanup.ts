/**
 * Existing-content strict audit. Scans every public content row in
 * the catalog and validates it against the new package contract. The
 * outcomes are:
 *
 *   - Valid + render-ready:   set publicRenderReady = true, isThresholdEligible = true
 *   - Invalid (missing field): remove from public view (status = REVIEW or
 *                              DRAFT depending on severity), clear render flags
 *   - Clearly wrong / random:  hard delete + write to RejectedContentLog
 *
 * Runs as part of the catalog janitor cron or on demand from the
 * admin "Run Strict QA" button.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { recordRejectedContentBatch, type RejectedContentLogInput } from "./rejected-log";
import { detectWrongContent } from "./wrong-content-detector";
import { staticPurposesForHost, type SourcePurposeRecord } from "./source-purpose";
import { runStrictPipelineSync } from "./pipeline";
import { isCanonicalSacramentKey, normalizeSacrament } from "./sacrament-normalize";
import { VALID_HISTORY_TYPES } from "./contracts/history";
import type { CandidatePackage, ContractValidationResult, ContentTypeKey } from "./types";

export type ContentTypeCleanupSummary = {
  contentType: string;
  inspected: number;
  flaggedReady: number;
  flaggedUnready: number;
  hardDeleted: number;
};

export type StrictCleanupSummary = {
  buckets: ContentTypeCleanupSummary[];
  totalInspected: number;
  totalFlaggedReady: number;
  totalFlaggedUnready: number;
  totalHardDeleted: number;
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
 * Generic per-table cleanup. Reads every public row, runs the strict
 * pipeline, and either flips the validation flags (publicRenderReady,
 * isThresholdEligible, packageValidationStatus, packageValidationErrors)
 * or hard-deletes the row.
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
}): Promise<{ summary: ContentTypeCleanupSummary; rejections: RejectedContentLogInput[] }> {
  const rows = await args.fetchRows();
  const rejections: RejectedContentLogInput[] = [];
  let flaggedReady = 0;
  let flaggedUnready = 0;
  let hardDeleted = 0;

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

    // Pre-flight wrong-content detector against the raw row text. The
    // pipeline runs this too, but invoking it here lets the cleanup
    // log report a useful reason on every delete.
    const sourceHost = (row.sourceHost as string | undefined) ?? undefined;
    const purposes: SourcePurposeRecord = staticPurposesForHost(sourceHost ?? null);
    const result = runStrictPipelineSync(candidate, purposes);

    if (result.decision === "delete") {
      const id = row.id as string;
      await args.deleteRow(id);
      hardDeleted += 1;
      rejections.push({
        contentType: result.contentType,
        slug: candidate.slug,
        originalTitle: candidate.title ?? null,
        sourceUrl: candidate.sourceUrl ?? null,
        sourceHost: sourceHost ?? null,
        rejectionReason: `Strict QA cleanup: ${result.reason}`,
        failedContractName: result.contractName,
        failedFields: result.failedFields,
        originalChecksum: (row.contentChecksum as string | null) ?? null,
        decision: "delete",
      });
      continue;
    }

    if (result.decision === "publish" || result.decision === "update") {
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
    },
    rejections,
  };
}

/**
 * Run the strict cleanup pass across every public catalog table.
 * Idempotent: re-running on a clean catalog is a no-op (rows stay
 * publicRenderReady = true).
 */
export async function runStrictContentCleanup(): Promise<StrictCleanupSummary> {
  const allRejections: RejectedContentLogInput[] = [];
  const buckets: ContentTypeCleanupSummary[] = [];

  // Prayers
  {
    const { summary, rejections } = await cleanupTable({
      contentType: "Prayer",
      contractContentType: "Prayer",
      fetchRows: () =>
        prisma.prayer.findMany({
          where: { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] },
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.prayer.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.PrayerUpdateInput = {
          publicRenderReady: result.publicRenderReady,
          isThresholdEligible: result.isThresholdEligible,
          packageValidationStatus:
            result.decision === "publish" || result.decision === "update" ? "valid" : "invalid",
          packageValidationErrors: result.failedFields,
          contentPackageVersion: result.contractVersion,
          lastPackageValidatedAt: new Date(),
        };
        if (!result.publicRenderReady && row.status === "PUBLISHED") {
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
      contentType: "Saint",
      contractContentType: "Saint",
      fetchRows: () =>
        prisma.saint.findMany({
          where: { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] },
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.saint.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.SaintUpdateInput = {
          publicRenderReady: result.publicRenderReady,
          isThresholdEligible: result.isThresholdEligible,
          packageValidationStatus:
            result.decision === "publish" || result.decision === "update" ? "valid" : "invalid",
          packageValidationErrors: result.failedFields,
          contentPackageVersion: result.contractVersion,
          lastPackageValidatedAt: new Date(),
        };
        if (!result.publicRenderReady && row.status === "PUBLISHED") {
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
      contentType: "MarianApparition",
      contractContentType: "MarianApparition",
      fetchRows: () =>
        prisma.marianApparition.findMany({
          where: { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] },
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.marianApparition.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.MarianApparitionUpdateInput = {
          publicRenderReady: result.publicRenderReady,
          isThresholdEligible: result.isThresholdEligible,
          packageValidationStatus:
            result.decision === "publish" || result.decision === "update" ? "valid" : "invalid",
          packageValidationErrors: result.failedFields,
          contentPackageVersion: result.contractVersion,
          lastPackageValidatedAt: new Date(),
        };
        if (!result.publicRenderReady && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        await prisma.marianApparition.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // Devotions (covers parent Devotion + Novena subtype + Rosary subtype)
  {
    const { summary, rejections } = await cleanupTable({
      contentType: "Devotion",
      contractContentType: "DevotionParent",
      fetchRows: () =>
        prisma.devotion.findMany({
          where: { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] },
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.devotion.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.DevotionUpdateInput = {
          publicRenderReady: result.publicRenderReady,
          isThresholdEligible: result.isThresholdEligible,
          packageValidationStatus:
            result.decision === "publish" || result.decision === "update" ? "valid" : "invalid",
          packageValidationErrors: result.failedFields,
          contentPackageVersion: result.contractVersion,
          lastPackageValidatedAt: new Date(),
        };
        if (!result.publicRenderReady && row.status === "PUBLISHED") {
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
      contentType: "SpiritualLifeGuide",
      contractContentType: "SpiritualLifeGuideParent",
      fetchRows: () =>
        prisma.spiritualLifeGuide.findMany({
          where: { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] },
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.spiritualLifeGuide.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.SpiritualLifeGuideUpdateInput = {
          publicRenderReady: result.publicRenderReady,
          isThresholdEligible: result.isThresholdEligible,
          packageValidationStatus:
            result.decision === "publish" || result.decision === "update" ? "valid" : "invalid",
          packageValidationErrors: result.failedFields,
          contentPackageVersion: result.contractVersion,
          lastPackageValidatedAt: new Date(),
        };
        if (!result.publicRenderReady && row.status === "PUBLISHED") {
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
      contentType: "LiturgyEntry",
      contractContentType: "LiturgyEntryParent",
      fetchRows: () =>
        prisma.liturgyEntry.findMany({
          where: { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] },
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.liturgyEntry.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.LiturgyEntryUpdateInput = {
          publicRenderReady: result.publicRenderReady,
          isThresholdEligible: result.isThresholdEligible,
          packageValidationStatus:
            result.decision === "publish" || result.decision === "update" ? "valid" : "invalid",
          packageValidationErrors: result.failedFields,
          contentPackageVersion: result.contractVersion,
          lastPackageValidatedAt: new Date(),
        };
        if (!result.publicRenderReady && row.status === "PUBLISHED") {
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
      contentType: "Parish",
      contractContentType: "Parish",
      fetchRows: () =>
        prisma.parish.findMany({
          where: { OR: [{ status: "PUBLISHED" }, { publicRenderReady: true }] },
        }) as unknown as Promise<Record<string, unknown>[]>,
      deleteRow: async (id) => {
        await prisma.parish.delete({ where: { id } });
      },
      updateRow: async (result, row) => {
        const data: Prisma.ParishUpdateInput = {
          publicRenderReady: result.publicRenderReady,
          isThresholdEligible: result.isThresholdEligible,
          packageValidationStatus:
            result.decision === "publish" || result.decision === "update" ? "valid" : "invalid",
          packageValidationErrors: result.failedFields,
          contentPackageVersion: result.contractVersion,
          lastPackageValidatedAt: new Date(),
        };
        if (!result.publicRenderReady && row.status === "PUBLISHED") {
          data.status = "REVIEW";
        }
        await prisma.parish.update({ where: { id: row.id as string }, data });
      },
    });
    buckets.push(summary);
    allRejections.push(...rejections);
  }

  // Daily Liturgy — structured calendar data. The "where applicable"
  // pass here checks for malformed rows: missing date, or empty
  // readings AND empty saints (an effectively empty day). Malformed
  // rows are hard-deleted with a RejectedContentLog entry so the day
  // can be re-ingested by the daily-liturgy adapter.
  try {
    const dailyRows = await prisma.dailyLiturgy.findMany({
      where: { status: "PUBLISHED" },
    });
    let dailyInspected = 0;
    let dailyFlaggedReady = 0;
    let dailyHardDeleted = 0;
    for (const row of dailyRows) {
      dailyInspected += 1;
      const readings = row.readingsJson as Record<string, unknown> | null;
      const saints = row.saintsJson as unknown[] | null;
      const hasReadings = !!readings && Object.keys(readings).length > 0;
      const hasSaints = Array.isArray(saints) && saints.length > 0;
      if (!row.date || (!hasReadings && !hasSaints)) {
        await prisma.dailyLiturgy.delete({ where: { id: row.id } });
        dailyHardDeleted += 1;
        allRejections.push({
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
        });
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
    });
  } catch {
    // best-effort — a DB error here must not break the strict QA pass
  }

  if (allRejections.length > 0) {
    await recordRejectedContentBatch(allRejections);
  }

  return {
    buckets,
    totalInspected: buckets.reduce((s, b) => s + b.inspected, 0),
    totalFlaggedReady: buckets.reduce((s, b) => s + b.flaggedReady, 0),
    totalFlaggedUnready: buckets.reduce((s, b) => s + b.flaggedUnready, 0),
    totalHardDeleted: buckets.reduce((s, b) => s + b.hardDeleted, 0),
  };
}

/** Re-export the history allowlist for the dashboard. */
export { VALID_HISTORY_TYPES };
// Silence unused import warning — detectWrongContent is exported for
// admin/test access to the cleanup module's symbols.
export { detectWrongContent };
