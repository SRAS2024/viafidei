/**
 * Strict threshold counting. The content-package thresholds must NOT
 * count raw database rows; only rows whose status, publicRenderReady,
 * and isThresholdEligible flags ALL pass count toward content goals.
 *
 * Specifically:
 *   - status = PUBLISHED
 *   - publicRenderReady = true
 *   - isThresholdEligible = true
 *   - required package fields present
 *   - not archived
 *   - not rejected / review / draft / malformed / duplicate
 *
 * `Confession` is NOT counted as a separate sacrament threshold; it
 * normalizes into Reconciliation and counts toward the 7-sacrament
 * total. The sacrament threshold counts only the seven valid
 * sacrament packages. The history threshold counts only the approved
 * history categories.
 */

import { prisma } from "../db/client";
import { CHURCH_DOCUMENT_SLUG_PREFIXES } from "../ingestion/backlog-prefixes";
import { SACRAMENT_KEYS } from "./sacrament-normalize";
import { VALID_HISTORY_TYPES } from "./contracts/history";

/**
 * Where clause every threshold counter shares. A row only counts
 * when it has passed the strict QA pipeline.
 */
const STRICT_PUBLIC_WHERE = {
  status: "PUBLISHED" as const,
  publicRenderReady: true as const,
  isThresholdEligible: true as const,
  archivedAt: null,
};

export type StrictBacklogCounts = {
  prayers: number;
  saints: number;
  parishes: number;
  marianApparitions: number;
  devotions: number;
  novenas: number;
  sacraments: number;
  rosary: number;
  consecrations: number;
  spiritualGuidance: number;
  liturgy: number;
  history: number;
};

export type StrictThresholdRow = {
  contentType: string;
  rawRows: number;
  validPackages: number;
  publicPackages: number;
  rejectedPackages: number;
  reviewRows: number;
  thresholdEligible: number;
  deletedInvalidRows: number;
};

/**
 * Count strictly-valid prayer packages. A bad prayer row that exists
 * in the table but failed its contract does NOT count.
 */
export async function countStrictPrayers(): Promise<number> {
  return prisma.prayer.count({ where: STRICT_PUBLIC_WHERE });
}

export async function countStrictSaints(): Promise<number> {
  return prisma.saint.count({ where: STRICT_PUBLIC_WHERE });
}

export async function countStrictParishes(): Promise<number> {
  return prisma.parish.count({ where: STRICT_PUBLIC_WHERE });
}

export async function countStrictApparitions(): Promise<number> {
  return prisma.marianApparition.count({ where: STRICT_PUBLIC_WHERE });
}

export async function countStrictDevotions(): Promise<number> {
  return prisma.devotion.count({ where: { ...STRICT_PUBLIC_WHERE, subtype: null } });
}

export async function countStrictNovenas(): Promise<number> {
  return prisma.devotion.count({ where: { ...STRICT_PUBLIC_WHERE, subtype: "Novena" } });
}

/**
 * Count strictly-valid sacrament packages — the seven canonical
 * sacraments only. Confession is collapsed into Reconciliation by
 * the persister + the contract, so it cannot inflate the count.
 */
export async function countStrictSacraments(): Promise<number> {
  return prisma.spiritualLifeGuide.count({
    where: {
      ...STRICT_PUBLIC_WHERE,
      sacramentKey: { in: [...SACRAMENT_KEYS] },
    },
  });
}

export async function countStrictRosary(): Promise<number> {
  return prisma.spiritualLifeGuide.count({
    where: { ...STRICT_PUBLIC_WHERE, subtype: "Rosary" },
  });
}

export async function countStrictConsecrations(): Promise<number> {
  return prisma.spiritualLifeGuide.count({
    where: { ...STRICT_PUBLIC_WHERE, subtype: "Consecration" },
  });
}

export async function countStrictSpiritualGuidance(): Promise<number> {
  return prisma.spiritualLifeGuide.count({
    where: {
      ...STRICT_PUBLIC_WHERE,
      sacramentKey: null,
      subtype: { notIn: ["Rosary", "Consecration"] },
    },
  });
}

export async function countStrictLiturgy(): Promise<number> {
  return prisma.liturgyEntry.count({
    where: { ...STRICT_PUBLIC_WHERE, historyType: null },
  });
}

export async function countStrictHistory(): Promise<number> {
  return prisma.liturgyEntry.count({
    where: {
      ...STRICT_PUBLIC_WHERE,
      historyType: { in: [...VALID_HISTORY_TYPES] },
    },
  });
}

/**
 * Returns all strict threshold counts in a single Promise.all.
 */
export async function getStrictBacklogCounts(): Promise<StrictBacklogCounts> {
  const [
    prayers,
    saints,
    parishes,
    marianApparitions,
    devotions,
    novenas,
    sacraments,
    rosary,
    consecrations,
    spiritualGuidance,
    liturgy,
    history,
  ] = await Promise.all([
    countStrictPrayers(),
    countStrictSaints(),
    countStrictParishes(),
    countStrictApparitions(),
    countStrictDevotions(),
    countStrictNovenas(),
    countStrictSacraments(),
    countStrictRosary(),
    countStrictConsecrations(),
    countStrictSpiritualGuidance(),
    countStrictLiturgy(),
    countStrictHistory(),
  ]);
  return {
    prayers,
    saints,
    parishes,
    marianApparitions,
    devotions,
    novenas,
    sacraments,
    rosary,
    consecrations,
    spiritualGuidance,
    liturgy,
    history,
  };
}

/**
 * Helper for the legacy scheduler signature. Returns strict counts in
 * the same shape `getBacklogProgress()` already uses, so the
 * ingestion scheduler can swap in strict counting without breaking
 * downstream code.
 *
 * Confession is NOT a separate threshold — `sacraments` is the count
 * of the seven canonical sacrament packages (which already includes
 * Reconciliation).
 */
export type LegacyBacklogCounts = {
  prayers: number;
  saints: number;
  parishes: number;
  churchDocuments: number;
  sacraments: number;
  consecrations: number;
};

export async function getStrictLegacyCounts(): Promise<LegacyBacklogCounts> {
  const [prayers, saints, parishes, churchDocuments, sacraments, consecrations] = await Promise.all(
    [
      countStrictPrayers(),
      countStrictSaints(),
      countStrictParishes(),
      // Church documents include encyclicals / catechisms / canon law / councils
      // — these live in LiturgyEntry with the historyType-prefix slugs.
      prisma.liturgyEntry.count({
        where: {
          ...STRICT_PUBLIC_WHERE,
          OR: CHURCH_DOCUMENT_SLUG_PREFIXES.map((p) => ({ slug: { startsWith: p } })),
        },
      }),
      countStrictSacraments(),
      countStrictConsecrations(),
    ],
  );
  return { prayers, saints, parishes, churchDocuments, sacraments, consecrations };
}

/**
 * Per-content-type strict threshold dashboard data. Each row carries
 * raw / valid / public / rejected / review counts so the admin can
 * see exactly how many rows passed the strict QA pipeline.
 */
export async function getStrictThresholdDashboard(): Promise<StrictThresholdRow[]> {
  const rows: StrictThresholdRow[] = [];

  // Prayer
  const [prayerRaw, prayerValid, prayerReview, prayerRejected] = await Promise.all([
    prisma.prayer.count(),
    prisma.prayer.count({ where: STRICT_PUBLIC_WHERE }),
    prisma.prayer.count({ where: { status: "REVIEW" } }),
    prisma.rejectedContentLog.count({ where: { contentType: "Prayer" } }),
  ]);
  rows.push({
    contentType: "Prayer",
    rawRows: prayerRaw,
    validPackages: prayerValid,
    publicPackages: prayerValid,
    rejectedPackages: prayerRejected,
    reviewRows: prayerReview,
    thresholdEligible: prayerValid,
    deletedInvalidRows: prayerRejected,
  });

  // Saint
  const [saintRaw, saintValid, saintReview, saintRejected] = await Promise.all([
    prisma.saint.count(),
    prisma.saint.count({ where: STRICT_PUBLIC_WHERE }),
    prisma.saint.count({ where: { status: "REVIEW" } }),
    prisma.rejectedContentLog.count({ where: { contentType: "Saint" } }),
  ]);
  rows.push({
    contentType: "Saint",
    rawRows: saintRaw,
    validPackages: saintValid,
    publicPackages: saintValid,
    rejectedPackages: saintRejected,
    reviewRows: saintReview,
    thresholdEligible: saintValid,
    deletedInvalidRows: saintRejected,
  });

  // Apparition
  const [appRaw, appValid, appReview, appRejected] = await Promise.all([
    prisma.marianApparition.count(),
    prisma.marianApparition.count({ where: STRICT_PUBLIC_WHERE }),
    prisma.marianApparition.count({ where: { status: "REVIEW" } }),
    prisma.rejectedContentLog.count({ where: { contentType: "MarianApparition" } }),
  ]);
  rows.push({
    contentType: "MarianApparition",
    rawRows: appRaw,
    validPackages: appValid,
    publicPackages: appValid,
    rejectedPackages: appRejected,
    reviewRows: appReview,
    thresholdEligible: appValid,
    deletedInvalidRows: appRejected,
  });

  // Devotion (parent type)
  const [devRaw, devValid, devReview, devRejected] = await Promise.all([
    prisma.devotion.count(),
    prisma.devotion.count({ where: STRICT_PUBLIC_WHERE }),
    prisma.devotion.count({ where: { status: "REVIEW" } }),
    prisma.rejectedContentLog.count({
      where: { contentType: { in: ["Devotion", "Novena"] } },
    }),
  ]);
  rows.push({
    contentType: "Devotion",
    rawRows: devRaw,
    validPackages: devValid,
    publicPackages: devValid,
    rejectedPackages: devRejected,
    reviewRows: devReview,
    thresholdEligible: devValid,
    deletedInvalidRows: devRejected,
  });

  // SpiritualLifeGuide (covers Sacrament / Rosary / Consecration / Guide)
  const [guideRaw, guideValid, guideReview, guideRejected] = await Promise.all([
    prisma.spiritualLifeGuide.count(),
    prisma.spiritualLifeGuide.count({ where: STRICT_PUBLIC_WHERE }),
    prisma.spiritualLifeGuide.count({ where: { status: "REVIEW" } }),
    prisma.rejectedContentLog.count({
      where: {
        contentType: { in: ["Sacrament", "Rosary", "Consecration", "SpiritualGuidance"] },
      },
    }),
  ]);
  rows.push({
    contentType: "SpiritualLifeGuide",
    rawRows: guideRaw,
    validPackages: guideValid,
    publicPackages: guideValid,
    rejectedPackages: guideRejected,
    reviewRows: guideReview,
    thresholdEligible: guideValid,
    deletedInvalidRows: guideRejected,
  });

  // LiturgyEntry (covers Liturgy + History)
  const [litRaw, litValid, litReview, litRejected] = await Promise.all([
    prisma.liturgyEntry.count(),
    prisma.liturgyEntry.count({ where: STRICT_PUBLIC_WHERE }),
    prisma.liturgyEntry.count({ where: { status: "REVIEW" } }),
    prisma.rejectedContentLog.count({
      where: { contentType: { in: ["Liturgy", "History"] } },
    }),
  ]);
  rows.push({
    contentType: "LiturgyEntry",
    rawRows: litRaw,
    validPackages: litValid,
    publicPackages: litValid,
    rejectedPackages: litRejected,
    reviewRows: litReview,
    thresholdEligible: litValid,
    deletedInvalidRows: litRejected,
  });

  // Parish
  const [parishRaw, parishValid, parishReview, parishRejected] = await Promise.all([
    prisma.parish.count(),
    prisma.parish.count({ where: STRICT_PUBLIC_WHERE }),
    prisma.parish.count({ where: { status: "REVIEW" } }),
    prisma.rejectedContentLog.count({ where: { contentType: "Parish" } }),
  ]);
  rows.push({
    contentType: "Parish",
    rawRows: parishRaw,
    validPackages: parishValid,
    publicPackages: parishValid,
    rejectedPackages: parishRejected,
    reviewRows: parishReview,
    thresholdEligible: parishValid,
    deletedInvalidRows: parishRejected,
  });

  return rows;
}

/**
 * Re-export the strict-public where clause so consumers can reuse it
 * directly in their own Prisma queries.
 */
export const STRICT_PUBLIC_WHERE_CLAUSE = STRICT_PUBLIC_WHERE;
