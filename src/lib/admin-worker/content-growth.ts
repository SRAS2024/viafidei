/**
 * Content-growth escalation (spec §25). Watches each content type's
 * publish rate. When a type is below target and has had no growth for
 * 24 hours, the worker automatically expands sources. After 7 days
 * with no growth, the watcher escalates the gap into a full
 * diagnostics pass.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

const ESCALATE_24H_MS = 24 * 60 * 60 * 1000;
const ESCALATE_7D_MS = 7 * 24 * 60 * 60 * 1000;

export type GrowthEscalation = "NONE" | "EXPAND_SOURCES" | "ESCALATE_DIAGNOSTICS";

export interface GrowthReport {
  contentType: ChecklistContentType;
  publishedCount: number;
  targetCount: number;
  gap: number;
  lastPublishedAt: Date | null;
  hoursSinceLastPublish: number | null;
  escalation: GrowthEscalation;
  reason: string;
}

export async function reportGrowth(prisma: PrismaClient): Promise<GrowthReport[]> {
  const goals = await prisma.contentGoal.findMany({
    where: { gapCount: { gt: 0 } },
    orderBy: { gapCount: "desc" },
  });

  const reports: GrowthReport[] = [];
  const now = Date.now();

  for (const goal of goals) {
    const contentType = goal.contentType as ChecklistContentType;
    const recent = await prisma.publishedContent.findFirst({
      where: { contentType, isPublished: true },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    });

    const lastAt = recent?.publishedAt ?? null;
    const hoursSince = lastAt ? Math.round((now - lastAt.getTime()) / (60 * 60 * 1000)) : null;

    let escalation: GrowthEscalation = "NONE";
    let reason = "Within normal growth window.";

    if (!lastAt || now - lastAt.getTime() > ESCALATE_7D_MS) {
      escalation = "ESCALATE_DIAGNOSTICS";
      reason = lastAt
        ? `No ${contentType} growth for >7 days — escalating diagnostics.`
        : `No ${contentType} ever published — escalating diagnostics.`;
    } else if (now - lastAt.getTime() > ESCALATE_24H_MS) {
      escalation = "EXPAND_SOURCES";
      reason = `No ${contentType} growth in last 24h — expanding sources.`;
    }

    reports.push({
      contentType,
      publishedCount: goal.currentValidCount,
      targetCount: goal.desiredTarget,
      gap: goal.gapCount,
      lastPublishedAt: lastAt,
      hoursSinceLastPublish: hoursSince,
      escalation,
      reason,
    });
  }

  return reports;
}

export function escalationsForOperator(reports: GrowthReport[]): GrowthReport[] {
  return reports.filter((r) => r.escalation !== "NONE");
}
