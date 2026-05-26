/**
 * Source reputation hooks (spec §16). Wraps the existing
 * recordSourceOutcome with one tiny helper per pipeline stage so
 * every stage feeds the reputation system consistently.
 *
 * Each hook is fire-and-forget — it never throws, so a logging hook
 * cannot break a pass.
 */

import type { PrismaClient } from "@prisma/client";

import { recordSourceOutcome } from "./source-reputation";

export type ReputationStage =
  | "discovery"
  | "fetch"
  | "source_read"
  | "classification"
  | "extraction"
  | "verification"
  | "qa"
  | "publish"
  | "post_publish"
  | "duplicate"
  | "wrong_content";

export interface ReputationHookInput {
  sourceHost: string;
  contentType?: string;
  stage: ReputationStage;
  ok: boolean;
  /** Optional usefulness score in [0,1] (e.g. classifier confidence). */
  usefulness?: number;
}

/**
 * Push the outcome of a single pipeline stage into source reputation.
 * Maps each stage to the corresponding boolean on the EWMA update.
 */
export async function pushReputation(
  prisma: PrismaClient,
  input: ReputationHookInput,
): Promise<void> {
  if (!input.sourceHost) return;
  const update = {
    sourceHost: input.sourceHost,
    contentType: input.contentType,
    usefulnessScore: input.usefulness,
  } as Parameters<typeof recordSourceOutcome>[1];

  switch (input.stage) {
    case "discovery":
      // Discovery success bumps fetchSuccessRate slightly (the source
      // produced something fetchable) without claiming a real fetch.
      (update as { fetchOk?: boolean }).fetchOk = input.ok;
      break;
    case "fetch":
      (update as { fetchOk?: boolean }).fetchOk = input.ok;
      break;
    case "source_read":
    case "classification":
      // Source-read + classify success feeds contentBuildSuccessRate
      // because both are gates the build engine relies on.
      (update as { buildOk?: boolean }).buildOk = input.ok;
      break;
    case "extraction":
      (update as { buildOk?: boolean }).buildOk = input.ok;
      break;
    case "verification":
      (update as { validationOk?: boolean }).validationOk = input.ok;
      break;
    case "qa":
      (update as { qaOk?: boolean }).qaOk = input.ok;
      break;
    case "publish":
      (update as { publishedOk?: boolean }).publishedOk = input.ok;
      break;
    case "post_publish":
      // Post-publish failure is a STRONG negative signal — the source
      // produced content that wasn't legally usable.
      (update as { publishedOk?: boolean }).publishedOk = input.ok;
      if (!input.ok) {
        (update as { wrongContent?: boolean }).wrongContent = true;
      }
      break;
    case "duplicate":
      (update as { duplicate?: boolean }).duplicate = true;
      break;
    case "wrong_content":
      (update as { wrongContent?: boolean }).wrongContent = true;
      break;
  }

  await recordSourceOutcome(prisma, update).catch(() => undefined);
}

/**
 * Batch helper — useful when one pass produces multiple per-stage
 * outcomes for the same source.
 */
export async function pushReputationBatch(
  prisma: PrismaClient,
  hooks: ReputationHookInput[],
): Promise<void> {
  for (const h of hooks) {
    await pushReputation(prisma, h);
  }
}
