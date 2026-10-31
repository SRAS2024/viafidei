/**
 * Strict QA orchestrator (spec §5 + §6 follow-up).
 *
 * Scores each AdminWorkerPackageArtifact across 7 dimensions and
 * stores the result in AdminWorkerStrictQAResult. The publish gate
 * refuses any artifact without a `status="PASSED"` row.
 *
 * Dimensions:
 *   completeness        required fields present
 *   correctness         schema validators pass
 *   formatting          well-formed text, no markup leaks
 *   provenance          every field traced to a source
 *   validation          cross-source verification PASS / no blocking
 *                        sensitive fields
 *   duplicateSafety     no slug / title-hash collision
 *   publicReadiness     public route exists for content type
 *
 * Final score = weighted mean. Status:
 *   PASSED       finalScore ≥ contentType threshold AND no zero dim
 *   NEEDS_REPAIR finalScore in (review_floor, threshold)
 *   FAILED       finalScore below review_floor OR any zero dim
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { thresholdFor } from "./quality";

export interface StrictQAOutcome {
  packageArtifactId: string;
  status: "PASSED" | "NEEDS_REPAIR" | "FAILED" | "PENDING";
  finalScore: number;
  blockingReasons: string[];
  repairSuggestions: string[];
  recordId: string | null;
}

const WEIGHTS = {
  completeness: 0.2,
  correctness: 0.15,
  formatting: 0.1,
  provenance: 0.15,
  validation: 0.2,
  duplicateSafety: 0.1,
  publicReadiness: 0.1,
} as const;

const REVIEW_FLOOR = 0.5;

/**
 * Reason code + gateDiagnosis of an artifact parked because its strict-QA
 * score landed in the review band (complete, no zero dimension, under the
 * type's threshold). Deterministic for the stored package, so it is held —
 * never requeued to be re-scored to the same band — until another source of
 * the same entity heals it with fresh fields.
 */
export const STRICT_QA_REVIEW_BAND = "STRICT_QA_REVIEW_BAND";

export interface StrictQAInputs {
  packageArtifactId: string;
  contentType: string;
  /** 0..1 each. */
  completenessScore: number;
  correctnessScore: number;
  formattingScore: number;
  provenanceScore: number;
  validationScore: number;
  duplicateSafetyScore: number;
  publicReadinessScore: number;
  /** Per-dimension blocking reasons. */
  blockingReasons?: string[];
  repairSuggestions?: string[];
}

/**
 * Score the artifact and persist a strict-QA row. Idempotent on
 * (packageArtifactId) via the unique index.
 */
export async function recordStrictQA(
  prisma: PrismaClient,
  input: StrictQAInputs,
): Promise<StrictQAOutcome> {
  const dims = {
    completeness: input.completenessScore,
    correctness: input.correctnessScore,
    formatting: input.formattingScore,
    provenance: input.provenanceScore,
    validation: input.validationScore,
    duplicateSafety: input.duplicateSafetyScore,
    publicReadiness: input.publicReadinessScore,
  };

  const anyZero = Object.entries(dims).some(([, v]) => v <= 0);
  const finalScore = anyZero
    ? 0
    : Object.entries(WEIGHTS).reduce(
        (acc, [k, w]) => acc + w * (dims[k as keyof typeof dims] ?? 0),
        0,
      );

  const threshold = thresholdFor(input.contentType);
  const status: StrictQAOutcome["status"] = anyZero
    ? "FAILED"
    : finalScore >= threshold
      ? "PASSED"
      : finalScore >= REVIEW_FLOOR
        ? "NEEDS_REPAIR"
        : "FAILED";

  const blockingReasons = input.blockingReasons ?? [];
  if (anyZero) {
    for (const [k, v] of Object.entries(dims)) {
      if (v <= 0) blockingReasons.push(`${k} dimension is zero`);
    }
  }
  if (status !== "PASSED" && finalScore < threshold && !anyZero) {
    blockingReasons.push(
      `finalScore ${finalScore.toFixed(2)} below ${input.contentType} threshold ${threshold}`,
    );
  }

  const row = await prisma.adminWorkerStrictQAResult
    .upsert({
      where: { packageArtifactId: input.packageArtifactId },
      create: {
        packageArtifactId: input.packageArtifactId,
        contentType: input.contentType,
        completenessScore: dims.completeness,
        correctnessScore: dims.correctness,
        formattingScore: dims.formatting,
        provenanceScore: dims.provenance,
        validationScore: dims.validation,
        duplicateSafetyScore: dims.duplicateSafety,
        publicReadinessScore: dims.publicReadiness,
        finalScore,
        status,
        blockingReasons,
        repairSuggestions: input.repairSuggestions ?? [],
      },
      update: {
        contentType: input.contentType,
        completenessScore: dims.completeness,
        correctnessScore: dims.correctness,
        formattingScore: dims.formatting,
        provenanceScore: dims.provenance,
        validationScore: dims.validation,
        duplicateSafetyScore: dims.duplicateSafety,
        publicReadinessScore: dims.publicReadiness,
        finalScore,
        status,
        blockingReasons,
        repairSuggestions: input.repairSuggestions ?? [],
      } as Prisma.AdminWorkerStrictQAResultUncheckedUpdateInput,
      select: { id: true },
    })
    .catch(() => null);

  return {
    packageArtifactId: input.packageArtifactId,
    status,
    finalScore,
    blockingReasons,
    repairSuggestions: input.repairSuggestions ?? [],
    recordId: row?.id ?? null,
  };
}

/**
 * Lookup helper — the publish orchestrator calls this before
 * approving an artifact.
 */
export async function getStrictQAResult(
  prisma: PrismaClient,
  packageArtifactId: string,
): Promise<StrictQAOutcome | null> {
  return (await readStrictQAResult(prisma, packageArtifactId)).result;
}

/**
 * Like getStrictQAResult, but tells "there is no row" apart from "the row
 * could not be read". The publish gate refuses both, but only the first is a
 * verdict about the artifact: a database error is transient and must be
 * retried, never turned into a terminal REJECTED.
 */
export async function readStrictQAResult(
  prisma: PrismaClient,
  packageArtifactId: string,
): Promise<{ result: StrictQAOutcome | null; error: boolean }> {
  let row: Awaited<ReturnType<typeof prisma.adminWorkerStrictQAResult.findUnique>>;
  try {
    row = await prisma.adminWorkerStrictQAResult.findUnique({ where: { packageArtifactId } });
  } catch {
    return { result: null, error: true };
  }
  if (!row) return { result: null, error: false };
  return {
    result: {
      packageArtifactId,
      status: row.status as StrictQAOutcome["status"],
      finalScore: row.finalScore,
      blockingReasons: row.blockingReasons,
      repairSuggestions: row.repairSuggestions,
      recordId: row.id,
    },
    error: false,
  };
}
