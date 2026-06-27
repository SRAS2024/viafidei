/**
 * Mission control + stuckness — the unified brain reasoning ABOVE single-action
 * selection, wired into the live worker loop (spec items: "mission control" and
 * "stuckness detection").
 *
 * TypeScript samples durable mission state from Postgres (content goals,
 * published counts, recent decisions, repairs, pass outcomes). The Python brain
 * reasons over it: it builds the mission tree, ranks subgoals, finds blockers,
 * recommends the next mission action, and separately detects when the worker is
 * stuck (action/repair loops, no content growth) and what would unblock it.
 *
 * Both run post-pass, are fail-open + non-blocking, and record their brain calls
 * so the intelligence dashboard's mission + stuckness sections light up. When
 * the brain says the worker is stuck, a developer request is filed so the
 * blocker becomes visible — the brain advising, never force-acting.
 */

import type { PrismaClient } from "@prisma/client";

import {
  buildMissionTree,
  detectMissionBlockers,
  detectStuckness,
  isBrainEnabled,
  rankSubgoals,
  recommendNextMissionAction,
  recommendUnblockStrategy,
} from "./intelligence";
import { BrainCallContext, recordBrainCall, recordDeveloperRequests } from "./intelligence/store";
import { writeAdminWorkerLog } from "./logs";

interface MissionRow {
  content_type?: string;
  existing_content?: number;
  completion_pct?: number;
  status?: string;
  priority?: number;
}

/**
 * Mission-control pass: build the mission tree from content goals, rank the
 * subgoals, find blockers on the least-complete one, and recommend the next
 * mission action. Records a durable snapshot the dashboard can surface.
 */
export async function runMissionControlPass(
  prisma: PrismaClient,
  ctx: BrainCallContext = {},
): Promise<{ ran: boolean; nextContentType?: string; nextAction?: string }> {
  if (!isBrainEnabled()) return { ran: false };
  try {
    const goals = await prisma.contentGoal
      .findMany({
        select: {
          contentType: true,
          currentValidCount: true,
          desiredTarget: true,
          canonicalMax: true,
          priority: true,
        },
      })
      .catch(() => []);
    if (goals.length === 0) return { ran: false };

    // Per-type published counts: a type with a target but zero published and no
    // sources is a real "no source coverage" blocker (not a fabricated one).
    const publishedByType = await prisma.publishedContent
      .groupBy({ by: ["contentType"], where: { isPublished: true }, _count: { _all: true } })
      .catch(() => [] as Array<{ contentType: string; _count: { _all: number } }>);
    const publishedCount = new Map(publishedByType.map((p) => [p.contentType, p._count._all]));

    const treeEnv = await buildMissionTree(
      goals.map((g) => ({
        contentType: g.contentType,
        currentValidCount: g.currentValidCount,
        desiredTarget: g.desiredTarget,
        canonicalMax: g.canonicalMax ?? undefined,
      })),
    );
    await recordBrainCall(prisma, "build_mission_tree", treeEnv, ctx);
    if (!treeEnv?.ok || !treeEnv.result) return { ran: false };

    const missions = ((treeEnv.result as { missions?: MissionRow[] }).missions ?? []).map((m) => ({
      ...m,
      priority: (goals.find((g) => g.contentType === m.content_type)?.priority ?? 100) / 100,
    }));

    const rankedEnv = await rankSubgoals(missions as Array<Record<string, unknown>>);
    await recordBrainCall(prisma, "rank_subgoals", rankedEnv, ctx);
    const nextSubgoal =
      ((rankedEnv?.result as { next_subgoal?: MissionRow } | undefined)?.next_subgoal ??
        missions[0]) ||
      null;

    let nextAction: string | undefined;
    let nextContentType: string | undefined;
    let blockers: string[] = [];
    if (nextSubgoal?.content_type) {
      nextContentType = nextSubgoal.content_type;
      const hasCoverage =
        (publishedCount.get(nextContentType) ?? 0) > 0 || (nextSubgoal.existing_content ?? 0) > 0;
      const blockEnv = await detectMissionBlockers({
        content_type: nextContentType,
        source_coverage: hasCoverage,
        // Unknown support signals default to present so we never invent blockers.
        public_route: true,
        schema_support: true,
        ui_support: true,
      });
      await recordBrainCall(prisma, "detect_mission_blockers", blockEnv, ctx);
      blockers = ((blockEnv?.result as { blockers?: string[] } | undefined)?.blockers ?? []).map(
        String,
      );

      const actionEnv = await recommendNextMissionAction({
        mission: {
          content_type: nextContentType,
          existing_content: nextSubgoal.existing_content ?? 0,
        },
        blockers,
      });
      await recordBrainCall(prisma, "recommend_next_mission_action", actionEnv, ctx);
      nextAction = (actionEnv?.result as { action?: string } | undefined)?.action;
    }

    // Durable mission state — one row per content type (Postgres owns mission
    // state); upserted each pass.
    for (const m of missions) {
      if (!m.content_type) continue;
      const isNext = m.content_type === nextContentType;
      await prisma.adminWorkerMissionState
        .upsert({
          where: { contentType: m.content_type },
          create: {
            contentType: m.content_type,
            goal: `Build complete ${m.content_type.toLowerCase()} section`,
            existingContent: m.existing_content ?? 0,
            completionPct: m.completion_pct ?? 0,
            status: m.status ?? "in_progress",
            blockers: isNext ? blockers : [],
            nextAction: isNext ? (nextAction ?? null) : null,
          },
          update: {
            existingContent: m.existing_content ?? 0,
            completionPct: m.completion_pct ?? 0,
            status: m.status ?? "in_progress",
            ...(isNext ? { blockers, nextAction: nextAction ?? null } : {}),
          },
        })
        .catch(() => undefined);
    }

    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId ?? undefined,
      category: "REPORT",
      severity: blockers.length > 0 ? "WARN" : "INFO",
      eventName: "mission_control",
      message:
        `Mission control: ${missions.length} missions; next = ${nextContentType ?? "n/a"}` +
        `${blockers.length ? ` (blocked: ${blockers[0]})` : ""}.`,
      contentType: nextContentType,
      safeMetadata: {
        missions: missions.slice(0, 20),
        next_content_type: nextContentType ?? null,
        next_action: nextAction ?? null,
        blockers,
      },
    }).catch(() => undefined);

    return { ran: true, nextContentType, nextAction };
  } catch {
    return { ran: false };
  }
}

/**
 * Stuckness pass: ask the brain whether the worker is caught in an action loop,
 * a repair loop, or making no content growth, and what would unblock it. Files a
 * developer request when stuck so the blocker is surfaced for review.
 */
export async function runStucknessPass(
  prisma: PrismaClient,
  ctx: BrainCallContext = {},
): Promise<{ ran: boolean; stuck: boolean }> {
  if (!isBrainEnabled()) return { ran: false, stuck: false };
  try {
    const [recentDecisions, recentRepairs, recentPasses] = await Promise.all([
      prisma.adminWorkerDecision
        .findMany({
          where: { decisionType: "brain_pass" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { missionStage: true },
        })
        .catch(() => [] as Array<{ missionStage: string | null }>),
      prisma.adminWorkerRepairPlan
        .findMany({
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: { kind: true, status: true },
        })
        .catch(() => [] as Array<{ kind: string; status: string }>),
      prisma.adminWorkerPass
        .findMany({
          orderBy: { startedAt: "desc" },
          take: 6,
          select: { contentPublished: true },
        })
        .catch(() => [] as Array<{ contentPublished: number }>),
    ]);

    // Not enough history to judge loops yet — skip quietly.
    if (recentDecisions.length < 5) return { ran: false, stuck: false };

    const publishedDelta = recentPasses.reduce((s, p) => s + (p.contentPublished ?? 0), 0);

    const env = await detectStuckness({
      recent_decisions: recentDecisions.map((d) => ({ missionStage: d.missionStage ?? "UNKNOWN" })),
      recent_repairs: recentRepairs.map((r) => ({ kind: r.kind, status: r.status })),
      published_delta: publishedDelta,
      pass_count: recentPasses.length,
    });
    await recordBrainCall(prisma, "detect_stuckness", env, ctx);

    const result = (env?.result ?? null) as {
      stuck?: boolean;
      signals?: string[];
      recommended_unblock?: string;
    } | null;
    const stuck = !!(env?.ok && result?.stuck);
    if (!stuck) return { ran: true, stuck: false };

    const signals = (result?.signals ?? []).map(String);
    const unblockEnv = await recommendUnblockStrategy(signals);
    await recordBrainCall(prisma, "recommend_unblock_strategy", unblockEnv, ctx);
    const strategy =
      (unblockEnv?.result as { primary?: string } | undefined)?.primary ??
      result?.recommended_unblock ??
      "Vary mission stage / source selection to break the loop.";

    // CORRECTIVE ACTION — the worker tries to unblock ITSELF before asking for
    // help, rather than only logging. (1) Drain the review queue of everything it
    // can safely decide, so a pile-up of resolvable items is never what holds
    // growth.
    let drained = 0;
    try {
      const { runReviewAutoResolve } = await import("./human-review");
      const r = await runReviewAutoResolve(prisma, { limit: 200 });
      drained = r.approved + r.rejected;
    } catch {
      // best-effort
    }

    // (2) Diagnose which outward CAPABILITY is missing, so "stuck" becomes an
    // actionable instruction. The worker can't grant itself an API key or open a
    // firewall, but it names the exact remediation (env var / network) — the
    // honest version of "figure out a resolution on its own."
    const { diagnoseCapabilityGaps } = await import("./capability-gaps");
    const cap = await diagnoseCapabilityGaps(prisma).catch(() => ({
      gaps: [],
      missing: [] as Array<{ capability: string; remediation: string }>,
      summary: "",
    }));
    const remediations = cap.missing.slice(0, 3).map((g) => `${g.capability} — ${g.remediation}`);

    const detail = [
      `${signals.join("; ") || "loop/no-growth detected"}.`,
      `Recommended unblock: ${strategy}.`,
      drained > 0 ? `Auto-resolved ${drained} review item(s) this sweep.` : "",
      cap.missing.length > 0
        ? `Most likely cause — missing capability. ${cap.summary} Remediation: ${remediations.join(" | ")}`
        : "All growth capabilities are configured; the remaining blocker is in-pipeline (see Why-No-Growth).",
    ]
      .filter(Boolean)
      .join(" ");

    await recordDeveloperRequests(
      prisma,
      [
        {
          kind: cap.missing.length > 0 ? "capability" : "process",
          title:
            cap.missing.length > 0
              ? `Worker plateaued — enable: ${cap.missing.map((g) => g.capability).join(", ")}`
              : "Worker appears stuck — intervention may help",
          detail,
          severity: "high",
          evidence: signals.slice(0, 5).join("; ").slice(0, 300),
        },
      ],
      "stuckness",
    ).catch(() => undefined);

    // Durable stuckness record (Postgres owns stuckness records).
    await prisma.adminWorkerStucknessRecord
      .create({
        data: {
          passId: ctx.passId ?? null,
          signals,
          strategy,
          publishedDelta,
        },
      })
      .catch(() => undefined);

    await writeAdminWorkerLog(prisma, {
      passId: ctx.passId ?? undefined,
      category: "REPORT",
      severity: "WARN",
      eventName: "worker_stuck",
      message: `Stuckness detected: ${signals[0] ?? "loop"}. Unblock: ${strategy}.${
        cap.missing.length > 0 ? ` ${cap.summary}` : ""
      }${drained > 0 ? ` Auto-resolved ${drained} review item(s).` : ""}`,
      safeMetadata: {
        signals,
        strategy,
        published_delta: publishedDelta,
        review_items_drained: drained,
        capability_gaps: cap.missing.map((g) => g.capability),
      },
    }).catch(() => undefined);

    return { ran: true, stuck: true };
  } catch {
    return { ran: false, stuck: false };
  }
}
