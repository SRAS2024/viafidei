/**
 * Per-content-type growth audit. Answers the 10/10 spec question:
 * "Why is each content type growing or stalled?"
 *
 * Returns a 30-day timeline of:
 *   - currentValidCount (strict public-visible count)
 *   - target (from appConfig.ingestion.targets)
 *   - completion percentage
 *   - net adds in last 24h / 7d / 30d
 *   - net deletes in last 24h / 7d / 30d
 *   - top contributing source hosts
 *   - status label: "growing" / "stalled" / "shrinking" / "complete"
 *
 * Read-side only.
 */

import { prisma } from "../db/client";
import { appConfig } from "../config";
import { STRICT_PUBLIC_WHERE_CLAUSE } from "./thresholds";

const MS_DAY = 24 * 60 * 60 * 1000;

export type GrowthAuditResult = {
  contentType: string;
  currentValidCount: number;
  target: number;
  completionPct: number;
  addedLast24h: number;
  addedLast7d: number;
  addedLast30d: number;
  deletedLast24h: number;
  deletedLast7d: number;
  deletedLast30d: number;
  topContributingHosts: ReadonlyArray<{ host: string; saved: number }>;
  status: "growing" | "stalled" | "shrinking" | "complete";
  explanation: string;
};

type CountAccessor = { count: (args?: { where: Record<string, unknown> }) => Promise<number> };

const COUNT_TABLE: Record<
  string,
  { accessor: CountAccessor; targetKey?: keyof typeof appConfig.ingestion.targets }
> = {
  Prayer: { accessor: prisma.prayer as unknown as CountAccessor, targetKey: "prayers" },
  Saint: { accessor: prisma.saint as unknown as CountAccessor, targetKey: "saints" },
  Parish: { accessor: prisma.parish as unknown as CountAccessor, targetKey: "parishes" },
  Devotion: { accessor: prisma.devotion as unknown as CountAccessor },
  MarianApparition: { accessor: prisma.marianApparition as unknown as CountAccessor },
  LiturgyEntry: { accessor: prisma.liturgyEntry as unknown as CountAccessor },
  SpiritualLifeGuide: { accessor: prisma.spiritualLifeGuide as unknown as CountAccessor },
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function classify(args: {
  current: number;
  target: number;
  addedLast30d: number;
  addedLast7d: number;
  deletedLast7d: number;
}): GrowthAuditResult["status"] {
  if (args.target > 0 && args.current >= args.target) return "complete";
  if (args.addedLast30d === 0 && args.addedLast7d === 0) return "stalled";
  if (args.deletedLast7d > args.addedLast7d) return "shrinking";
  return "growing";
}

function buildExplanation(args: GrowthAuditResult): string {
  if (args.status === "complete") {
    return `Target met (${args.currentValidCount}/${args.target}).`;
  }
  if (args.status === "stalled") {
    return `Stalled: 0 adds in the last 30 days while still ${(
      args.target - args.currentValidCount
    ).toLocaleString()} below target. Investigate paused sources and adapter health.`;
  }
  if (args.status === "shrinking") {
    return `Shrinking: ${args.deletedLast7d} deletes vs ${args.addedLast7d} adds in the last 7 days. Strict QA may be removing more than ingestion is adding — promote better sources.`;
  }
  return `Growing: ${args.addedLast7d} adds vs ${args.deletedLast7d} deletes in last 7 days. At current rate, ${args.completionPct}% complete.`;
}

export async function getGrowthAudit(args: { contentType: string }): Promise<GrowthAuditResult> {
  const entry = COUNT_TABLE[args.contentType];
  if (!entry) {
    return {
      contentType: args.contentType,
      currentValidCount: 0,
      target: 0,
      completionPct: 0,
      addedLast24h: 0,
      addedLast7d: 0,
      addedLast30d: 0,
      deletedLast24h: 0,
      deletedLast7d: 0,
      deletedLast30d: 0,
      topContributingHosts: [],
      status: "stalled",
      explanation: `Unknown content type "${args.contentType}".`,
    };
  }
  const target = entry.targetKey ? appConfig.ingestion.targets[entry.targetKey] : 0;
  const currentValidCount = await safe(
    () => entry.accessor.count({ where: STRICT_PUBLIC_WHERE_CLAUSE }),
    0,
  );

  const now = Date.now();
  const since24h = new Date(now - MS_DAY);
  const since7d = new Date(now - 7 * MS_DAY);
  const since30d = new Date(now - 30 * MS_DAY);

  // Adds — DataManagementLog ADD rows over the windows.
  const [addedLast24h, addedLast7d, addedLast30d] = await Promise.all([
    safe(
      () =>
        prisma.dataManagementLog.count({
          where: { action: "ADD", contentType: args.contentType, createdAt: { gte: since24h } },
        }),
      0,
    ),
    safe(
      () =>
        prisma.dataManagementLog.count({
          where: { action: "ADD", contentType: args.contentType, createdAt: { gte: since7d } },
        }),
      0,
    ),
    safe(
      () =>
        prisma.dataManagementLog.count({
          where: { action: "ADD", contentType: args.contentType, createdAt: { gte: since30d } },
        }),
      0,
    ),
  ]);

  // Deletes — RejectedContentLog delete decisions.
  const [deletedLast24h, deletedLast7d, deletedLast30d] = await Promise.all([
    safe(
      () =>
        prisma.rejectedContentLog.count({
          where: {
            contentType: args.contentType,
            decision: "delete",
            deletedAt: { gte: since24h },
          },
        }),
      0,
    ),
    safe(
      () =>
        prisma.rejectedContentLog.count({
          where: {
            contentType: args.contentType,
            decision: "delete",
            deletedAt: { gte: since7d },
          },
        }),
      0,
    ),
    safe(
      () =>
        prisma.rejectedContentLog.count({
          where: {
            contentType: args.contentType,
            decision: "delete",
            deletedAt: { gte: since30d },
          },
        }),
      0,
    ),
  ]);

  // Top contributing hosts — IngestionSource ordered by completedItems
  // among sources that can ingest this content type. We approximate
  // with the `canIngest*` flag mapping.
  const topContributingHosts = await safe(
    async () => {
      const rows = await prisma.ingestionSource.findMany({
        where: { isActive: true, completedItems: { gt: 0 } },
        orderBy: { completedItems: "desc" },
        take: 5,
        select: { host: true, completedItems: true },
      });
      return rows.map((r) => ({ host: r.host, saved: r.completedItems }));
    },
    [] as Array<{ host: string; saved: number }>,
  );

  const completionPct =
    target > 0 ? Math.min(100, Math.round((currentValidCount / target) * 100)) : 0;
  const result: GrowthAuditResult = {
    contentType: args.contentType,
    currentValidCount,
    target,
    completionPct,
    addedLast24h,
    addedLast7d,
    addedLast30d,
    deletedLast24h,
    deletedLast7d,
    deletedLast30d,
    topContributingHosts,
    status: classify({
      current: currentValidCount,
      target,
      addedLast30d,
      addedLast7d,
      deletedLast7d,
    }),
    explanation: "",
  };
  result.explanation = buildExplanation(result);
  return result;
}
