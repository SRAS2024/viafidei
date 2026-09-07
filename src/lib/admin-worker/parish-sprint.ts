/**
 * Parish-directory sprint scheduler.
 *
 * PARISH is by far the largest content goal (200,000) and grows on its own
 * keyless OpenStreetMap lane, independent of the web-extraction campaign that
 * drives the other types. Left unbounded it would run every pass forever, so
 * the operator's policy is: grow parishes in **sprints** (a bounded batch), then
 * **stand down for a cooldown window** (a day by default) during which the worker
 * pours its effort into the OTHER content types, then come back for the next
 * parish sprint — and so on toward 200k.
 *
 * Overrides, matching the operator's rule "focus the goal with the largest gap,
 * but don't let one goal starve the rest":
 *   - If EVERY other content goal is already met, there is nothing else to work
 *     on, so parishes run continuously (ignore the cooldown) until 200k.
 *   - If the PARISH goal itself is met, the lane idles.
 *
 * State (sprint progress + cooldown deadline) lives in `AdminWorkerMemory` so it
 * survives restarts. Sizes are env-tunable. Everything is fail-open: any error
 * yields "run the sprint" so a scheduler glitch never freezes parish growth.
 */

import type { PrismaClient } from "@prisma/client";

const SPRINT_KEY = "parish-sprint-state";
/** Parishes published per sprint before standing down for the cooldown. */
export const DEFAULT_PARISH_SPRINT_SIZE = 10_000;
/**
 * Cooldown after a completed sprint — the worker grows other types meanwhile.
 * One day by default (env `ADMIN_WORKER_PARISH_SPRINT_COOLDOWN_MS`): Overpass
 * politeness is enforced by the persisted daily query budget in
 * parish-osm-overpass.ts, not by idling the lane for a week, and PARISH is by
 * far the largest goal gap, so a long stand-down only delays it.
 */
export const DEFAULT_PARISH_SPRINT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 day

function envInt(name: string, fallback: number): number {
  const n = Number((process.env[name] ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

interface SprintState {
  /** Parishes published so far in the current sprint. */
  sprintPublished: number;
  /** Epoch ms until which parish growth stands down, or null when active. */
  cooldownUntil: number | null;
}

export interface ParishSprintDecision {
  /** Whether the OSM parish lane should grow this pass. */
  active: boolean;
  reason: string;
  sprintPublished: number;
  sprintSize: number;
  cooldownUntil: number | null;
  allOthersMet: boolean;
}

async function readState(prisma: PrismaClient): Promise<SprintState> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SPRINT_KEY } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = (row?.memoryValue ?? {}) as { sprintPublished?: number; cooldownUntil?: number | null };
  return {
    sprintPublished:
      typeof v.sprintPublished === "number" && v.sprintPublished >= 0 ? v.sprintPublished : 0,
    cooldownUntil: typeof v.cooldownUntil === "number" ? v.cooldownUntil : null,
  };
}

async function writeState(prisma: PrismaClient, state: SprintState): Promise<void> {
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SPRINT_KEY } },
      update: { memoryValue: state as never, lastUsedAt: new Date() },
      create: {
        memoryType: "GENERIC",
        memoryKey: SPRINT_KEY,
        memoryValue: state as never,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/** True when every non-PARISH content goal has a zero gap. */
async function allOtherGoalsMet(prisma: PrismaClient): Promise<boolean> {
  const others = await prisma.contentGoal
    .findMany({ where: { contentType: { not: "PARISH" as never } }, select: { gapCount: true } })
    .catch(() => [] as Array<{ gapCount: number }>);
  return others.length > 0 && others.every((g) => g.gapCount <= 0);
}

/**
 * Decide whether the OSM parish lane should grow parishes this pass. Called at
 * the top of `runOsmParishDiscovery`.
 */
export async function evaluateParishSprint(prisma: PrismaClient): Promise<ParishSprintDecision> {
  const sprintSize = envInt("ADMIN_WORKER_PARISH_SPRINT_SIZE", DEFAULT_PARISH_SPRINT_SIZE);
  try {
    const parish = await prisma.contentGoal
      .findUnique({ where: { contentType: "PARISH" as never }, select: { gapCount: true } })
      .catch(() => null);
    // Parish goal already met → the lane idles (nothing to grow).
    if (parish && parish.gapCount <= 0) {
      return {
        active: false,
        reason: "PARISH goal met — parish lane idle",
        sprintPublished: 0,
        sprintSize,
        cooldownUntil: null,
        allOthersMet: false,
      };
    }

    const othersMet = await allOtherGoalsMet(prisma);
    const state = await readState(prisma);
    const now = Date.now();

    // Every other goal is met → nothing else to do, so grow parishes without
    // pause until 200k.
    if (othersMet) {
      return {
        active: true,
        reason: "all other content goals met — focusing PARISH",
        sprintPublished: state.sprintPublished,
        sprintSize,
        cooldownUntil: state.cooldownUntil,
        allOthersMet: true,
      };
    }

    // In the cooldown window → stand down so the worker grows other types.
    if (state.cooldownUntil && now < state.cooldownUntil) {
      const daysLeft = ((state.cooldownUntil - now) / (24 * 60 * 60 * 1000)).toFixed(1);
      return {
        active: false,
        reason: `parish sprint cooldown — growing other content types for ~${daysLeft} more day(s)`,
        sprintPublished: state.sprintPublished,
        sprintSize,
        cooldownUntil: state.cooldownUntil,
        allOthersMet: false,
      };
    }

    // Active sprint.
    return {
      active: true,
      reason: `parish sprint in progress (${state.sprintPublished}/${sprintSize})`,
      sprintPublished: state.sprintPublished,
      sprintSize,
      cooldownUntil: null,
      allOthersMet: false,
    };
  } catch {
    // Fail-open: never freeze parish growth on a scheduler error.
    return {
      active: true,
      reason: "parish sprint scheduler unavailable — defaulting to active",
      sprintPublished: 0,
      sprintSize,
      cooldownUntil: null,
      allOthersMet: false,
    };
  }
}

/**
 * Record parishes published this run toward the current sprint. When the sprint
 * size is reached, start the cooldown (and reset the counter) so the worker
 * moves to the other content types. No-op when nothing was published, or when
 * other goals are all met (then parishes run continuously, no sprint boundary).
 */
export async function recordParishSprintProgress(
  prisma: PrismaClient,
  publishedThisRun: number,
): Promise<void> {
  if (publishedThisRun <= 0) return;
  const sprintSize = envInt("ADMIN_WORKER_PARISH_SPRINT_SIZE", DEFAULT_PARISH_SPRINT_SIZE);
  const cooldownMs = envInt(
    "ADMIN_WORKER_PARISH_SPRINT_COOLDOWN_MS",
    DEFAULT_PARISH_SPRINT_COOLDOWN_MS,
  );
  try {
    if (await allOtherGoalsMet(prisma)) return; // continuous parish focus, no sprint gating
    const state = await readState(prisma);
    const total = state.sprintPublished + publishedThisRun;
    if (total >= sprintSize) {
      await writeState(prisma, { sprintPublished: 0, cooldownUntil: Date.now() + cooldownMs });
    } else {
      await writeState(prisma, { sprintPublished: total, cooldownUntil: state.cooldownUntil });
    }
  } catch {
    /* fail-open */
  }
}
