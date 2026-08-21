/**
 * Conflict and contradiction handling (spec §19).
 *
 * When two apparently authoritative sources disagree, the worker must not
 * silently keep whichever page it happened to read first. Doctrinal,
 * liturgical, biographical, historical and date-sensitive fields are exactly
 * where a quiet coin-flip does the most damage.
 *
 * This module gives the worker one deterministic adjudication path:
 *
 *   1. recognise the conflict (normalised comparison, not string equality),
 *   2. record BOTH claims with their provenance,
 *   3. compare source authority, then recency, then corroboration count,
 *   4. detect supersession (a newer statement from an equal-or-higher authority),
 *   5. assign a confidence to the winner,
 *   6. escalate genuinely unresolved conflicts to human review,
 *   7. REMEMBER the conflict so the same uncertainty is not rediscovered
 *      every time the worker meets it again.
 *
 * It reuses the existing review queue, reasoning graph and durable memory —
 * no new tables and no second verification system. The cross-source verifier
 * remains the place where field-level agreement is *detected*; this module is
 * where a detected disagreement is *adjudicated*.
 */

import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { fileHumanReview } from "./human-review";
import { writeAdminWorkerLog } from "./logs";

const MEMORY_TYPE = "GENERIC" as const;
const CONFLICT_PREFIX = "conflict.";

/** Authority weight per source level — mirrors `source-strategy.ts`. */
export const AUTHORITY_WEIGHT: Record<string, number> = {
  VATICAN: 1.0,
  CATECHISM: 0.95,
  LITURGICAL_BOOK: 0.9,
  USCCB: 0.85,
  DIOCESAN: 0.7,
  RELIGIOUS_ORDER: 0.65,
  TRUSTED_PUBLISHER: 0.55,
  ACADEMIC: 0.5,
  COMMUNITY: 0.35,
};

export interface ClaimCandidate {
  /** The asserted value, as extracted. */
  value: string;
  sourceUrl: string;
  sourceHost: string;
  /** SourceAuthorityLevel name, when known. */
  authorityLevel?: string | null;
  /** Publication / revision date of the source statement, when known. */
  statedAt?: Date | null;
  /** When the worker retrieved it. */
  observedAt?: Date | null;
  /** How many independent sources asserted the same value. */
  corroborations?: number;
}

export type ConflictResolution =
  | "agreement"
  | "resolved-by-authority"
  | "resolved-by-recency"
  | "resolved-by-corroboration"
  | "superseded"
  | "unresolved";

export interface ConflictVerdict {
  field: string;
  resolution: ConflictResolution;
  /** The claim the worker will use, or null when unresolved. */
  winner: ClaimCandidate | null;
  /** Every distinct claim considered, strongest first. */
  claims: Array<ClaimCandidate & { weight: number }>;
  /** 0..1 confidence in the winner. */
  confidence: number;
  rationale: string;
  /** True when a human must adjudicate. */
  needsReview: boolean;
}

/** Normalise a claim value so trivial formatting differences are not conflicts. */
export function normalizeClaim(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function authorityWeight(level?: string | null): number {
  if (!level) return 0.4;
  return AUTHORITY_WEIGHT[level] ?? 0.4;
}

function claimWeight(c: ClaimCandidate): number {
  const authority = authorityWeight(c.authorityLevel);
  const corroboration = Math.min(0.25, (c.corroborations ?? 1) * 0.05);
  const recency = c.statedAt
    ? Math.max(0, 0.15 - Math.min(0.15, (Date.now() - c.statedAt.getTime()) / (50 * 365 * 864e5)))
    : 0;
  return Number((authority + corroboration + recency).toFixed(4));
}

/** Stable id for a (field, claim-set) so the same conflict is recognised again. */
export function conflictKey(field: string, claims: ClaimCandidate[]): string {
  const values = Array.from(new Set(claims.map((c) => normalizeClaim(c.value)))).sort();
  return createHash("sha256")
    .update(`${field}::${values.join("||")}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Adjudicate a set of competing claims for one field. Pure and deterministic.
 */
export function resolveConflict(field: string, candidates: ClaimCandidate[]): ConflictVerdict {
  const claims = candidates
    .map((c) => ({ ...c, weight: claimWeight(c) }))
    .sort((a, b) => b.weight - a.weight);

  const distinct = new Map<string, Array<ClaimCandidate & { weight: number }>>();
  for (const c of claims) {
    const key = normalizeClaim(c.value);
    const bucket = distinct.get(key) ?? [];
    bucket.push(c);
    distinct.set(key, bucket);
  }

  if (distinct.size <= 1) {
    return {
      field,
      resolution: "agreement",
      winner: claims[0] ?? null,
      claims,
      confidence: claims.length > 1 ? 0.95 : 0.7,
      rationale:
        claims.length > 1
          ? `${claims.length} sources agree on "${claims[0]?.value ?? ""}".`
          : "Only one source asserts this field.",
      needsReview: false,
    };
  }

  // Strongest claim per distinct value.
  const groups = Array.from(distinct.values()).map((bucket) => ({
    best: bucket[0],
    total: bucket.reduce((s, c) => s + c.weight, 0),
    count: bucket.length,
  }));
  groups.sort((a, b) => b.total - a.total);

  const top = groups[0];
  const runnerUp = groups[1];
  const authorityGap =
    authorityWeight(top.best.authorityLevel) - authorityWeight(runnerUp.best.authorityLevel);

  // 1. Clear authority difference wins outright.
  if (authorityGap >= 0.15) {
    return {
      field,
      resolution: "resolved-by-authority",
      winner: top.best,
      claims,
      confidence: Math.min(0.95, 0.6 + authorityGap),
      rationale:
        `"${top.best.value}" (${top.best.authorityLevel ?? "unknown authority"}, ${top.best.sourceHost}) ` +
        `outranks "${runnerUp.best.value}" (${runnerUp.best.authorityLevel ?? "unknown authority"}, ${runnerUp.best.sourceHost}).`,
      needsReview: false,
    };
  }

  // 2. Equal authority but one statement is clearly newer → supersession.
  const topAt = top.best.statedAt?.getTime() ?? null;
  const runnerAt = runnerUp.best.statedAt?.getTime() ?? null;
  if (topAt && runnerAt && Math.abs(authorityGap) < 0.15) {
    const newer = topAt >= runnerAt ? top : runnerUp;
    const older = topAt >= runnerAt ? runnerUp : top;
    const yearsApart = Math.abs(topAt - runnerAt) / (365 * 864e5);
    if (yearsApart >= 1) {
      return {
        field,
        resolution: "superseded",
        winner: newer.best,
        claims,
        confidence: 0.75,
        rationale:
          `Equal authority; "${newer.best.value}" (${newer.best.statedAt?.toISOString().slice(0, 10)}) ` +
          `supersedes "${older.best.value}" (${older.best.statedAt?.toISOString().slice(0, 10)}), ` +
          `${yearsApart.toFixed(1)} year(s) earlier.`,
        needsReview: false,
      };
    }
  }

  // 3. Corroboration breaks a tie when one value has clearly more support.
  if (top.count >= runnerUp.count + 2) {
    return {
      field,
      resolution: "resolved-by-corroboration",
      winner: top.best,
      claims,
      confidence: 0.7,
      rationale: `"${top.best.value}" is corroborated by ${top.count} sources vs ${runnerUp.count} for "${runnerUp.best.value}".`,
      needsReview: false,
    };
  }

  // 4. Genuinely unresolved — preserve the uncertainty, never invent certainty.
  return {
    field,
    resolution: "unresolved",
    winner: null,
    claims,
    confidence: 0.3,
    rationale:
      `Sources of comparable authority disagree on ${field}: ` +
      groups
        .slice(0, 4)
        .map((g) => `"${g.best.value}" (${g.best.sourceHost}, ${g.best.authorityLevel ?? "?"})`)
        .join(" vs ") +
      ". Escalating rather than guessing.",
    needsReview: true,
  };
}

export interface RememberedConflict {
  key: string;
  field: string;
  resolution: ConflictResolution;
  winner: string | null;
  confidence: number;
  rationale: string;
  seenCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  reviewId: string | null;
}

/** Recall a previously adjudicated conflict so it is not re-litigated. */
export async function recallConflict(
  prisma: PrismaClient,
  key: string,
): Promise<RememberedConflict | null> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: {
        memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: `${CONFLICT_PREFIX}${key}` },
      },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const v = row?.memoryValue;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as unknown as RememberedConflict;
}

/**
 * Adjudicate, persist, and (when unresolved) escalate. Returns the verdict plus
 * whether it came from memory — a conflict already settled once is not
 * re-escalated each time it is met again.
 */
export async function adjudicateAndRecord(
  prisma: PrismaClient,
  input: {
    field: string;
    contentType?: string | null;
    contentTitle?: string | null;
    candidates: ClaimCandidate[];
    passId?: string;
  },
): Promise<{ verdict: ConflictVerdict; remembered: boolean; reviewId: string | null }> {
  const key = conflictKey(input.field, input.candidates);
  const prior = await recallConflict(prisma, key);
  const verdict = resolveConflict(input.field, input.candidates);

  // Already adjudicated with the same claim set: reuse the decision, bump the
  // counter, and do NOT re-escalate (spec §19.9).
  if (prior) {
    await prisma.adminWorkerMemory
      .update({
        where: {
          memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: `${CONFLICT_PREFIX}${key}` },
        },
        data: {
          memoryValue: {
            ...prior,
            seenCount: prior.seenCount + 1,
            lastSeenAt: new Date().toISOString(),
          } as never,
          lastUsedAt: new Date(),
        },
      })
      .catch(() => undefined);
    return { verdict, remembered: true, reviewId: prior.reviewId };
  }

  let reviewId: string | null = null;
  if (verdict.needsReview) {
    const filed = await fileHumanReview(prisma, {
      contentType: input.contentType ?? undefined,
      contentTitle: input.contentTitle ?? undefined,
      proposedAction: `Adjudicate conflicting "${input.field}" values`,
      reason: verdict.rationale,
      confidence: verdict.confidence,
      blockingGate: "conflict-resolution",
      neededAction: "Choose the correct value or supply a higher-authority source.",
      sourceEvidence: {
        field: input.field,
        claims: verdict.claims.map((c) => ({
          value: c.value,
          sourceUrl: c.sourceUrl,
          sourceHost: c.sourceHost,
          authorityLevel: c.authorityLevel ?? null,
          statedAt: c.statedAt?.toISOString() ?? null,
          weight: c.weight,
        })),
      } as never,
    }).catch(() => null);
    reviewId = filed?.id ?? null;
  }

  const remembered: RememberedConflict = {
    key,
    field: input.field,
    resolution: verdict.resolution,
    winner: verdict.winner?.value ?? null,
    confidence: verdict.confidence,
    rationale: verdict.rationale,
    seenCount: 1,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    reviewId,
  };

  await prisma.adminWorkerMemory
    .upsert({
      where: {
        memoryType_memoryKey: { memoryType: MEMORY_TYPE, memoryKey: `${CONFLICT_PREFIX}${key}` },
      },
      create: {
        memoryType: MEMORY_TYPE,
        memoryKey: `${CONFLICT_PREFIX}${key}`,
        memoryValue: remembered as never,
        confidence: verdict.confidence,
        lastUsedAt: new Date(),
      },
      update: { memoryValue: remembered as never, lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  await writeAdminWorkerLog(prisma, {
    passId: input.passId,
    category: "VALIDATION",
    severity: verdict.needsReview ? "WARN" : "INFO",
    eventName: verdict.needsReview ? "conflict_unresolved" : "conflict_resolved",
    message: verdict.rationale.slice(0, 480),
    contentType: input.contentType ?? undefined,
    safeMetadata: {
      field: input.field,
      resolution: verdict.resolution,
      confidence: verdict.confidence,
      claimCount: verdict.claims.length,
      conflictKey: key,
    },
  }).catch(() => undefined);

  return { verdict, remembered: false, reviewId };
}
