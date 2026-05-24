/**
 * Learning loop. The Admin Worker adjusts priorities, retry timing,
 * and source/content selection based on stored outcomes — never on
 * invented facts.
 *
 * Hard rules (spec section 4):
 *   - never invent facts
 *   - never bypass QA
 *   - never create content without source evidence
 *   - only adjust based on stored outcomes, logs, and scores
 *
 * The learning loop is a thin wrapper over `memory.ts` that records
 * outcomes after every pass; the planner reads those outcomes when it
 * picks the next priority.
 */

import type { PrismaClient } from "@prisma/client";

import { rememberOutcome } from "./memory";

export interface LearnFromBuildInput {
  sourceHost: string;
  contentType: string;
  outcome: "success" | "failure";
}

export async function learnFromBuild(
  prisma: PrismaClient,
  input: LearnFromBuildInput,
): Promise<void> {
  await rememberOutcome(prisma, {
    memoryType: "SOURCE_PRIORITY",
    memoryKey: `${input.sourceHost}::${input.contentType}`,
    memoryValue: { sourceHost: input.sourceHost, contentType: input.contentType },
    outcome: input.outcome,
  });
  await rememberOutcome(prisma, {
    memoryType: "CONTENT_TYPE_PRIORITY",
    memoryKey: input.contentType,
    memoryValue: { contentType: input.contentType },
    outcome: input.outcome,
  });
}

export interface LearnFromPublishInput {
  sourceHost: string;
  contentType: string;
  outcome: "success" | "failure";
}

export async function learnFromPublish(
  prisma: PrismaClient,
  input: LearnFromPublishInput,
): Promise<void> {
  await rememberOutcome(prisma, {
    memoryType: "BUILDER_PRIORITY",
    memoryKey: `${input.contentType}::publish`,
    memoryValue: { contentType: input.contentType },
    outcome: input.outcome,
  });
}
