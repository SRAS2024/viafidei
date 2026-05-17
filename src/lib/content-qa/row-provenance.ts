/**
 * Per-row provenance lookup. Answers the 10/10 spec's audit
 * questions for any catalog row:
 *
 *   - Why does this row exist?         (sourceUrl + sourceHost +
 *                                       externalSourceKey)
 *   - Why was it published?            (packageValidationStatus +
 *                                       publicRenderReady +
 *                                       isThresholdEligible)
 *   - Which contract did it pass?      (contentPackageVersion +
 *                                       lastPackageValidatedAt)
 *   - Which source supplied each       — derived at extract time by
 *     required field?                   the extractor's `provenance`
 *                                       map; this endpoint surfaces
 *                                       only what survived
 *                                       persistence.
 *
 * The endpoint is read-only and admin-gated. It's the canonical
 * "show your work" surface for the strict QA system.
 */

import { prisma } from "../db/client";

export type RowProvenance = {
  contentType: string;
  slug: string;
  exists: boolean;
  fields: {
    status?: string | null;
    publicRenderReady?: boolean | null;
    isThresholdEligible?: boolean | null;
    packageValidationStatus?: string | null;
    packageValidationErrors?: ReadonlyArray<string> | null;
    contentPackageVersion?: string | null;
    lastPackageValidatedAt?: Date | null;
    sourceUrl?: string | null;
    sourceHost?: string | null;
    externalSourceKey?: string | null;
    contentChecksum?: string | null;
    archivedAt?: Date | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  };
  rejected?: {
    deletedAt: Date;
    rejectionReason: string;
    failedContractName: string | null;
    failedFields: ReadonlyArray<string>;
    decision: string;
    packageVersion: string | null;
    validationDecision: string | null;
    failureCategory: string | null;
    cleanupMode: string | null;
    sweepReason: string | null;
    originalStatus: string | null;
    workerJobId: string | null;
    ingestionBatchId: string | null;
  };
};

type CatalogAccessor = {
  findFirst: (args: {
    where: Record<string, unknown>;
    select: Record<string, boolean>;
  }) => Promise<Record<string, unknown> | null>;
};

const ACCESSORS_BY_CT: Record<string, CatalogAccessor> = {
  Prayer: prisma.prayer as unknown as CatalogAccessor,
  Saint: prisma.saint as unknown as CatalogAccessor,
  MarianApparition: prisma.marianApparition as unknown as CatalogAccessor,
  Devotion: prisma.devotion as unknown as CatalogAccessor,
  Novena: prisma.devotion as unknown as CatalogAccessor,
  Rosary: prisma.spiritualLifeGuide as unknown as CatalogAccessor,
  Sacrament: prisma.spiritualLifeGuide as unknown as CatalogAccessor,
  Consecration: prisma.spiritualLifeGuide as unknown as CatalogAccessor,
  SpiritualGuidance: prisma.spiritualLifeGuide as unknown as CatalogAccessor,
  SpiritualLifeGuide: prisma.spiritualLifeGuide as unknown as CatalogAccessor,
  Liturgy: prisma.liturgyEntry as unknown as CatalogAccessor,
  History: prisma.liturgyEntry as unknown as CatalogAccessor,
  LiturgyEntry: prisma.liturgyEntry as unknown as CatalogAccessor,
  Parish: prisma.parish as unknown as CatalogAccessor,
};

const SELECT_FIELDS = {
  status: true,
  publicRenderReady: true,
  isThresholdEligible: true,
  packageValidationStatus: true,
  packageValidationErrors: true,
  contentPackageVersion: true,
  lastPackageValidatedAt: true,
  sourceUrl: true,
  sourceHost: true,
  externalSourceKey: true,
  contentChecksum: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Look up a row's full provenance — catalog flags + rejection log
 * (if the row was deleted). When the slug is in the catalog and in
 * the rejection log we return both: the catalog row shows current
 * state, the rejection log shows the historical "almost-deleted"
 * record.
 */
export async function getRowProvenance(args: {
  contentType: string;
  slug: string;
}): Promise<RowProvenance> {
  const accessor = ACCESSORS_BY_CT[args.contentType];
  let fields: RowProvenance["fields"] = {};
  let exists = false;
  if (accessor) {
    try {
      const row = await accessor.findFirst({
        where: { slug: args.slug },
        select: SELECT_FIELDS as unknown as Record<string, boolean>,
      });
      if (row) {
        exists = true;
        fields = row as RowProvenance["fields"];
      }
    } catch {
      // best-effort
    }
  }

  let rejected: RowProvenance["rejected"];
  try {
    const last = await prisma.rejectedContentLog.findFirst({
      where: { contentType: args.contentType, slug: args.slug },
      orderBy: { deletedAt: "desc" },
    });
    if (last) {
      rejected = {
        deletedAt: last.deletedAt,
        rejectionReason: last.rejectionReason,
        failedContractName: last.failedContractName,
        failedFields: last.failedFields ?? [],
        decision: last.decision,
        packageVersion: last.packageVersion,
        validationDecision: last.validationDecision,
        failureCategory: last.failureCategory,
        cleanupMode: last.cleanupMode,
        sweepReason: last.sweepReason,
        originalStatus: last.originalStatus,
        workerJobId: last.workerJobId,
        ingestionBatchId: last.ingestionBatchId,
      };
    }
  } catch {
    // best-effort
  }

  return {
    contentType: args.contentType,
    slug: args.slug,
    exists,
    fields,
    rejected,
  };
}
