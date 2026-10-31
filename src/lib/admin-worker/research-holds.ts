/**
 * Research holds: a durable, backed-off parking state for web artifacts whose
 * evidence cannot satisfy a publish requirement however often the publish is
 * retried — typically a doctrinally sensitive item supported by ONE trusted
 * source when the proof gate requires two, or a schema that requires two
 * citations where only the page itself is known.
 *
 * Retrying such an item on the review backoff (10 / 20 / 40 minutes) changed
 * nothing and logged a "Publish blocked" WARN each time; afterwards the weekly
 * self-maintenance requeue started the cycle again. A research hold instead:
 *   - records a typed reason code on the artifact (rejectionReason) and marks
 *     it NEEDS_REVIEW with gateDiagnosis NEEDS_RESEARCH, so it leaves every
 *     pipeline queue;
 *   - flags it for research in AdminWorkerMemory (`research-needed:<artifact>`)
 *     with what is missing, how many times it was held, and when to look again;
 *   - re-checks it only when that backoff (7 → 14 → 28 → 56 → 90 days) expires:
 *     the BUILD_READY drain requeues a due hold with its stale cross-source
 *     evidence cleared, so verification looks again over a corpus that has
 *     grown in the meantime.
 *
 * Nothing is relaxed: an item on hold never publishes until its evidence
 * genuinely clears the same gates. No schema change — the state lives on the
 * existing status / gateDiagnosis columns and in AdminWorkerMemory.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeAdminWorkerLog } from "./logs";

export const RESEARCH_HOLD_DIAGNOSIS = "NEEDS_RESEARCH";
/** gateDiagnosis stamped on a hold the drain requeued for its re-check. */
export const RESEARCH_RECHECK_DIAGNOSIS = "RESEARCH_RECHECK";

const DAY_MS = 24 * 60 * 60 * 1000;
/** First re-check after a hold; doubles per hold, capped at RESEARCH_HOLD_MAX_MS. */
export const RESEARCH_HOLD_BASE_MS = 7 * DAY_MS;
export const RESEARCH_HOLD_MAX_MS = 90 * DAY_MS;

/** Why an artifact is on a research hold (the prefix of its rejectionReason). */
export type ResearchHoldCode =
  /** Fewer independent trusted sources than the doctrinal proof requires. */
  | "INSUFFICIENT_TRUSTED_SOURCES"
  /** Fewer citations than the content schema requires. */
  | "INSUFFICIENT_CITATIONS"
  /** The supporting sources rank below the authority the type requires. */
  | "BELOW_REQUIRED_AUTHORITY";

export interface ResearchFlag {
  contentType: string;
  slug: string;
  code: ResearchHoldCode;
  detail: string;
  /** What would clear the hold, in plain words. */
  missing: string[];
  attempts: number;
  firstFlaggedAt: string;
  lastFlaggedAt: string;
  nextAttemptAt: string;
}

export function researchFlagKey(artifactId: string): string {
  return `research-needed:${artifactId}`;
}

/** Backoff before the re-check that follows the n-th hold (1-based). */
export function researchHoldDelayMs(attempt: number): number {
  return Math.min(RESEARCH_HOLD_MAX_MS, RESEARCH_HOLD_BASE_MS * 2 ** Math.max(0, attempt - 1));
}

const flagWhere = (artifactId: string) => ({
  memoryType_memoryKey: { memoryType: "GENERIC" as const, memoryKey: researchFlagKey(artifactId) },
});

/** Read an artifact's research flag. Fail-open: an unreadable store is "no flag". */
export async function readResearchFlag(
  prisma: PrismaClient,
  artifactId: string,
): Promise<ResearchFlag | null> {
  try {
    const row = await prisma.adminWorkerMemory.findUnique({
      where: flagWhere(artifactId),
      select: { memoryValue: true },
    });
    const v = row?.memoryValue;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    return v as unknown as ResearchFlag;
  } catch {
    return null;
  }
}

/**
 * The publish-gate reasons that are an evidence gap (research), as opposed to
 * a transient condition worth a quick retry. Null when the reason is not one.
 * The brain being offline is transient and deliberately NOT a research hold.
 */
export function researchHoldCodeFor(reason: string | null | undefined): ResearchHoldCode | null {
  const r = (reason ?? "").toLowerCase();
  if (!r.includes("proof-based publishing")) return null;
  if (r.includes("offline") || r.includes("unavailable")) return null;
  if (
    r.includes("doctrinal_trusted_support") ||
    r.includes("source_support") ||
    r.includes("agreement") ||
    r.includes("citations")
  ) {
    return "INSUFFICIENT_TRUSTED_SOURCES";
  }
  if (r.includes("below vatican authority") || r.includes("failed: authority")) {
    return "BELOW_REQUIRED_AUTHORITY";
  }
  return null;
}

/**
 * Put an artifact on a research hold (or extend one): flag it, park it with a
 * typed reason, and schedule its re-check. Returns the hold count and the
 * re-check time. Fail-open on the memory write — the park still happens, and
 * a lost flag only means the drain treats the hold as due after the base wait.
 */
export async function holdForResearch(
  prisma: PrismaClient,
  input: {
    artifactId: string;
    contentType: string;
    slug: string;
    code: ResearchHoldCode;
    detail: string;
    missing: string[];
    passId?: string;
  },
): Promise<{ attempts: number; nextAttemptAt: Date }> {
  const now = new Date();
  const prev = await readResearchFlag(prisma, input.artifactId);
  const attempts = (typeof prev?.attempts === "number" ? prev.attempts : 0) + 1;
  const nextAttemptAt = new Date(now.getTime() + researchHoldDelayMs(attempts));
  const flag: ResearchFlag = {
    contentType: input.contentType,
    slug: input.slug,
    code: input.code,
    detail: input.detail.slice(0, 300),
    missing: input.missing.slice(0, 10),
    attempts,
    firstFlaggedAt: prev?.firstFlaggedAt ?? now.toISOString(),
    lastFlaggedAt: now.toISOString(),
    nextAttemptAt: nextAttemptAt.toISOString(),
  };
  await prisma.adminWorkerMemory
    .upsert({
      where: flagWhere(input.artifactId),
      update: { memoryValue: flag as unknown as Prisma.InputJsonValue, lastUsedAt: now },
      create: {
        memoryType: "GENERIC",
        memoryKey: researchFlagKey(input.artifactId),
        memoryValue: flag as unknown as Prisma.InputJsonValue,
        lastUsedAt: now,
      },
    })
    .catch(() => undefined);
  await prisma.adminWorkerPackageArtifact
    .update({
      where: { id: input.artifactId },
      data: {
        status: "NEEDS_REVIEW",
        gateDiagnosis: RESEARCH_HOLD_DIAGNOSIS,
        gateCheckedAt: now,
        rejectionReason:
          `${input.code}: ${input.detail} [research hold ${attempts}; re-check after ${nextAttemptAt.toISOString().slice(0, 10)}]`.slice(
            0,
            480,
          ),
      },
    })
    .catch(() => undefined);
  // INFO, and sampled like every INFO: a hold is an expected state, and the
  // whole point is to stop the per-attempt WARN this item used to produce.
  await writeAdminWorkerLog(prisma, {
    passId: input.passId,
    category: "PUBLISHING",
    severity: "INFO",
    eventName: "research_hold",
    message: `${input.contentType}/${input.slug} held for research (${input.code}, hold ${attempts}): ${input.detail}. Needs: ${input.missing.join("; ")}. Re-check after ${nextAttemptAt.toISOString()}.`,
    contentType: input.contentType,
    relatedEntityId: input.artifactId,
    safeMetadata: { code: input.code, attempts, nextAttemptAt: nextAttemptAt.toISOString() },
  }).catch(() => undefined);
  return { attempts, nextAttemptAt };
}

/** Forget an artifact's research flag (it published, or was decided terminally). */
export async function clearResearchFlag(prisma: PrismaClient, artifactId: string): Promise<void> {
  try {
    await prisma.adminWorkerMemory.deleteMany({
      where: { memoryType: "GENERIC", memoryKey: researchFlagKey(artifactId) },
    });
  } catch {
    // best-effort
  }
}

/**
 * Requeue research holds whose backoff has expired so the pipeline looks again:
 * stale cross-source evidence is cleared and the artifact returns to
 * BUILD_READY (verification re-runs for types that carry validation needs;
 * strict QA, then the publish gates, for the rest). Only holds parked at least
 * the base backoff ago are read, so on a pass with nothing due the query
 * returns no rows. Bounded by `limit`; fail-open. Returns how many requeued.
 */
export async function requeueDueResearchHolds(
  prisma: PrismaClient,
  opts: { now?: Date; limit?: number } = {},
): Promise<number> {
  const now = opts.now ?? new Date();
  let requeued = 0;
  try {
    const candidates = await prisma.adminWorkerPackageArtifact.findMany({
      where: {
        status: "NEEDS_REVIEW",
        gateDiagnosis: RESEARCH_HOLD_DIAGNOSIS,
        updatedAt: { lte: new Date(now.getTime() - RESEARCH_HOLD_BASE_MS) },
      },
      orderBy: { updatedAt: "asc" },
      take: opts.limit ?? 10,
      select: { id: true },
    });
    for (const a of candidates) {
      const flag = await readResearchFlag(prisma, a.id);
      const next = flag?.nextAttemptAt ? new Date(flag.nextAttemptAt) : null;
      if (next && !Number.isNaN(next.getTime()) && next.getTime() > now.getTime()) continue;
      await prisma.adminWorkerCrossSourceVerification
        .deleteMany({ where: { contentId: a.id } })
        .catch(() => undefined);
      const moved = await prisma.adminWorkerPackageArtifact
        .updateMany({
          where: { id: a.id, status: "NEEDS_REVIEW", gateDiagnosis: RESEARCH_HOLD_DIAGNOSIS },
          data: {
            status: "BUILD_READY",
            gateDiagnosis: RESEARCH_RECHECK_DIAGNOSIS,
            gateCheckedAt: now,
            rejectionReason: null,
          },
        })
        .catch(() => ({ count: 0 }));
      requeued += moved.count;
    }
  } catch {
    // A partial client (or a store error) ends the sweep; nothing is lost —
    // the remaining holds are simply re-checked on a later pass.
  }
  return requeued;
}
