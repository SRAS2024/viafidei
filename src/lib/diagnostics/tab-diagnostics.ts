/**
 * Tab-level diagnostics (spec §18).
 *
 * For every public tab, surface:
 *   - public item count
 *   - threshold count
 *   - hidden item count (PUBLISHED but failing the strict gate)
 *   - last package added
 *   - last package deleted
 *   - render failure count
 *   - growth stall reason (when any)
 *
 * The admin "tab diagnostics" page renders one row per tab so the
 * operator can immediately see which tabs are healthy and which are
 * stalled.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type TabKey =
  | "prayers"
  | "saints"
  | "apparitions"
  | "parishes"
  | "devotions"
  | "novenas"
  | "sacraments"
  | "liturgy"
  | "history";

export const TAB_KEYS: ReadonlyArray<TabKey> = [
  "prayers",
  "saints",
  "apparitions",
  "parishes",
  "devotions",
  "novenas",
  "sacraments",
  "liturgy",
  "history",
];

export type TabDiagnosticsRow = {
  tab: TabKey;
  label: string;
  contentType: string;
  publicCount: number;
  thresholdCount: number;
  hiddenCount: number;
  lastPackageAddedAt: Date | null;
  lastPackageDeletedAt: Date | null;
  renderFailures: number;
  growthStallReason: string | null;
};

export type TabDiagnosticsReport = {
  rows: ReadonlyArray<TabDiagnosticsRow>;
  generatedAt: Date;
};

type TabDescriptor = {
  tab: TabKey;
  label: string;
  contentType: string;
  countTable: keyof typeof TABLE_BY_NAME;
};

const TABS: ReadonlyArray<TabDescriptor> = [
  { tab: "prayers", label: "Prayers", contentType: "Prayer", countTable: "prayer" },
  { tab: "saints", label: "Saints", contentType: "Saint", countTable: "saint" },
  {
    tab: "apparitions",
    label: "Marian apparitions",
    contentType: "MarianApparition",
    countTable: "marianApparition",
  },
  { tab: "parishes", label: "Parishes", contentType: "Parish", countTable: "parish" },
  {
    tab: "devotions",
    label: "Devotions",
    contentType: "Devotion",
    countTable: "devotion",
  },
  // Novena, Rosary, Consecration, Sacrament all live under
  // SpiritualLifeGuide; we filter by kind.
  {
    tab: "novenas",
    label: "Novenas",
    contentType: "Novena",
    countTable: "spiritualLifeGuide",
  },
  {
    tab: "sacraments",
    label: "Sacraments",
    contentType: "Sacrament",
    countTable: "spiritualLifeGuide",
  },
  {
    tab: "liturgy",
    label: "Liturgy",
    contentType: "Liturgy",
    countTable: "liturgyEntry",
  },
  {
    tab: "history",
    label: "Church history",
    contentType: "History",
    countTable: "liturgyEntry",
  },
];

const TABLE_BY_NAME = {
  prayer: "prayer",
  saint: "saint",
  marianApparition: "marianApparition",
  parish: "parish",
  devotion: "devotion",
  spiritualLifeGuide: "spiritualLifeGuide",
  liturgyEntry: "liturgyEntry",
} as const;

function isClientWith<T extends string>(model: T): boolean {
  return Boolean((prisma as unknown as Record<string, unknown>)[model]);
}

async function safeCount(
  table: keyof typeof TABLE_BY_NAME,
  where: Record<string, unknown>,
): Promise<number> {
  try {
    const client = prisma as unknown as Record<
      string,
      { count: (args: unknown) => Promise<number> }
    >;
    if (!client[table]) return 0;
    return await client[table].count({ where });
  } catch (e) {
    logger.warn("tab-diagnostics.count_failed", {
      table,
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}

async function safeLatest(
  table: keyof typeof TABLE_BY_NAME,
  where: Record<string, unknown>,
  orderField: string,
): Promise<Date | null> {
  try {
    const client = prisma as unknown as Record<
      string,
      { findFirst: (args: unknown) => Promise<{ createdAt?: Date; updatedAt?: Date } | null> }
    >;
    if (!client[table]) return null;
    const row = await client[table].findFirst({
      where,
      orderBy: { [orderField]: "desc" },
      select: { createdAt: true, updatedAt: true },
    });
    if (!row) return null;
    if (orderField === "updatedAt") return row.updatedAt ?? null;
    return row.createdAt ?? null;
  } catch (e) {
    logger.warn("tab-diagnostics.latest_failed", {
      table,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function safeRejectedAt(contentType: string): Promise<Date | null> {
  try {
    const row = await prisma.rejectedContentLog.findFirst({
      where: { contentType },
      orderBy: { deletedAt: "desc" },
      select: { deletedAt: true },
    });
    return row?.deletedAt ?? null;
  } catch (e) {
    logger.warn("tab-diagnostics.rejected_at_failed", {
      contentType,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

function whereForContentType(contentType: string): Record<string, unknown> {
  // For SpiritualLifeGuide table we filter by `kind`; for everything
  // else the row is the right content type by table.
  if (contentType === "Novena") return { kind: "DEVOTION" }; // novena is a Devotion kind
  if (contentType === "Sacrament") return { kind: "CONSECRATION" };
  if (contentType === "History") return { kind: "GENERAL" };
  return {};
}

/**
 * Build the per-tab diagnostics report. Errors per row are logged
 * but do not break the page — partial rows still render.
 */
export async function getTabDiagnosticsReport(): Promise<TabDiagnosticsReport> {
  const generatedAt = new Date();
  const rows: TabDiagnosticsRow[] = [];

  for (const desc of TABS) {
    const baseWhere = whereForContentType(desc.contentType);
    const publicWhere = {
      ...baseWhere,
      status: "PUBLISHED",
      publicRenderReady: true,
      isThresholdEligible: true,
    };
    const thresholdWhere = {
      ...baseWhere,
      isThresholdEligible: true,
    };
    const hiddenWhere = {
      ...baseWhere,
      status: "PUBLISHED",
      OR: [{ publicRenderReady: false }, { isThresholdEligible: false }],
    };

    const [publicCount, thresholdCount, hiddenCount, lastAdded, lastDeleted] = await Promise.all([
      safeCount(desc.countTable, publicWhere),
      safeCount(desc.countTable, thresholdWhere),
      safeCount(desc.countTable, hiddenWhere),
      safeLatest(desc.countTable, publicWhere, "updatedAt"),
      safeRejectedAt(desc.contentType),
    ]);

    // Render failures = recent rejected-content-log rows with a
    // render-related failure category.
    const renderFailures = await safeCount("liturgyEntry", {})
      .catch(() => 0)
      .then(() => 0); // placeholder — wire when render-failure log lands

    const growthStallReason =
      publicCount === 0
        ? "no_public_rows"
        : hiddenCount > publicCount
          ? "more_hidden_than_public"
          : null;

    rows.push({
      tab: desc.tab,
      label: desc.label,
      contentType: desc.contentType,
      publicCount,
      thresholdCount,
      hiddenCount,
      lastPackageAddedAt: lastAdded,
      lastPackageDeletedAt: lastDeleted,
      renderFailures,
      growthStallReason,
    });
  }

  return { rows, generatedAt };
}

void isClientWith;
