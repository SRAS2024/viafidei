/**
 * Supplementary pre-pass brain consultation (prioritisation + planning).
 *
 * Runs at the start of each worker pass to ask the Python brain to prioritise
 * the unmet content goals and suggest a next-best-action, recording both calls
 * to the audit trail for the reasoning view. This is a SUPPLEMENTARY signal —
 * it does NOT select the action. The Python brain selects the FINAL action via
 * `select_action` (see final-brain.ts / runBrain); TypeScript then validates
 * that choice against the safety gate and executes it. Best-effort and
 * non-blocking: a failure here never affects the pass's final decision.
 */

import type { PrismaClient } from "@prisma/client";

import { isBrainEnabled, plan, prioritize } from "./intelligence";
import { recordBrainCall } from "./intelligence/store";
import { writeAdminWorkerLog } from "./logs";

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export interface NextWorkAdvisory {
  available: boolean;
  topContentType: string | null;
  topScore: number | null;
  nextBestAction: string | null;
}

export async function adviseNextWork(
  prisma: PrismaClient,
  opts: { passId?: string } = {},
): Promise<NextWorkAdvisory> {
  const empty: NextWorkAdvisory = {
    available: false,
    topContentType: null,
    topScore: null,
    nextBestAction: null,
  };
  if (!isBrainEnabled()) return empty;

  try {
    const goals = await prisma.contentGoal.findMany({
      where: { gapCount: { gt: 0 } },
      orderBy: { priority: "asc" },
      take: 40,
      select: {
        contentType: true,
        desiredTarget: true,
        currentValidCount: true,
        gapCount: true,
        priority: true,
        status: true,
      },
    });
    if (goals.length === 0) {
      return { available: true, topContentType: null, topScore: null, nextBestAction: null };
    }

    const candidates = goals.map((g) => {
      const target = Math.max(g.desiredTarget, 1);
      const weakness = clamp01(g.gapCount / target);
      return {
        id: g.contentType,
        label: g.contentType,
        weakness,
        missionImportance: clamp01((200 - g.priority) / 200),
        userValue: 0.7,
        sourceAvailability: 0.6,
        confidence: 0.6,
        publishReadiness: clamp01(g.currentValidCount / target),
        expectedImpact: weakness,
      };
    });

    const pri = await prioritize(candidates);
    await recordBrainCall(prisma, "prioritize", pri, { passId: opts.passId ?? null });
    const top = pri?.ok ? (pri.result?.top ?? null) : null;

    // Seed the planner with the worker's most-trusted memories.
    const mem = await prisma.adminWorkerMemory
      .findMany({
        orderBy: [{ confidence: "desc" }, { lastUsedAt: "desc" }],
        take: 8,
        select: { memoryType: true, memoryKey: true },
      })
      .catch(() => [] as Array<{ memoryType: string; memoryKey: string }>);
    const memories = mem.map((m) => ({ text: `${m.memoryType}: ${m.memoryKey}` }));

    const objective = top?.label
      ? `Fill the highest-value missing content safely, starting with ${top.label}.`
      : "Fill the highest-value missing content safely.";
    const planEnv = await plan({
      objective,
      memories,
      available_tools: [
        { name: "search", cost: 0.12, risk: 0.04, expected_value: 0.78 },
        { name: "execute", cost: 0.22, risk: 0.12, expected_value: 0.72 },
      ],
    });
    await recordBrainCall(prisma, "plan", planEnv, { passId: opts.passId ?? null });
    const nextBestAction = planEnv?.ok ? (planEnv.result?.next_best_action?.action ?? null) : null;

    await writeAdminWorkerLog(prisma, {
      passId: opts.passId,
      category: "WORKER_PASS",
      severity: "INFO",
      eventName: "intelligence_advisory",
      message: `Brain prioritises ${top?.label ?? "n/a"} next (score ${
        top?.score?.toFixed?.(2) ?? "n/a"
      }); next-best-action: ${nextBestAction ?? "n/a"}.`,
      contentType: top?.label ?? undefined,
      safeMetadata: {
        topContentType: top?.label ?? null,
        topScore: top?.score ?? null,
        nextBestAction,
        candidates: candidates.length,
      },
    }).catch(() => undefined);

    return {
      available: !!pri?.ok,
      topContentType: top?.label ?? null,
      topScore: top?.score ?? null,
      nextBestAction,
    };
  } catch {
    return empty;
  }
}
