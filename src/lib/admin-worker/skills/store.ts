/**
 * Prisma-backed skill runtime deps. Wires the executor to the durable skill
 * ledger (AdminWorkerSkillExecution), idempotency + circuit-breaker queries,
 * capability-matrix learning, and real developer-request / repair-plan filing.
 * The executor stays DB-free + unit-testable; production passes these deps.
 */

import type { PrismaClient } from "@prisma/client";

import type { CertifiedSkill, SkillContext, SkillRunResult, SkillRuntimeDeps } from "./types";
import { upsertCapabilityFromRun } from "./capability";

/** Circuit breaker: open after this many failures within the window. */
const CIRCUIT_WINDOW_MIN = 60;
const CIRCUIT_THRESHOLD = 5;

function repairKindForCategory(category: string): string {
  switch (category) {
    case "SOURCE":
      return "FETCH_FAILED";
    case "EXTRACTION":
      return "EXTRACT_FAILED";
    case "VERIFICATION":
      return "VALIDATION_FAILED";
    case "PUBLISHING":
      return "PERSIST_FAILED";
    case "MAINTENANCE":
      return "QUEUE_STUCK";
    default:
      return "BUILD_REPEATED_FAILURE";
  }
}

export function makeSkillRuntimeDeps(prisma: PrismaClient): SkillRuntimeDeps {
  return {
    async recordExecution(row) {
      const created = await prisma.adminWorkerSkillExecution
        .create({ data: { ...row }, select: { id: true } })
        .catch(() => null);
      return created?.id ?? null;
    },

    async isIdempotentDone(skillName, idempotencyKey) {
      const hit = await prisma.adminWorkerSkillExecution
        .findFirst({
          where: {
            skillName,
            idempotencyKey,
            executionStatus: "SUCCEEDED",
            verificationStatus: "PROCEED",
          },
          select: { id: true },
        })
        .catch(() => null);
      return hit != null;
    },

    async isCircuitOpen(skillName) {
      const since = new Date(Date.now() - CIRCUIT_WINDOW_MIN * 60_000);
      const fails = await prisma.adminWorkerSkillExecution
        .count({ where: { skillName, executionStatus: "FAILED", createdAt: { gte: since } } })
        .catch(() => 0);
      return fails >= CIRCUIT_THRESHOLD;
    },

    async onOutcome(skill: CertifiedSkill, ctx: SkillContext, run: SkillRunResult) {
      await upsertCapabilityFromRun(prisma, skill, ctx, run).catch(() => undefined);
    },

    async fileDeveloperRequest(input) {
      const fingerprint = `missing-skill:${input.skillName}:${input.contentType ?? ""}:${input.contentSubtype ?? ""}`;
      await prisma.adminWorkerDeveloperRequest
        .upsert({
          where: { fingerprint },
          create: {
            kind: "capability",
            title: `Missing certified skill: ${input.skillName}`,
            detail: input.reason,
            severity: "high",
            status: "OPEN",
            evidence: input.evidence ?? null,
            source: "skill-runtime",
            fingerprint,
            metadata: {
              contentType: input.contentType ?? null,
              contentSubtype: input.contentSubtype ?? null,
              mission: input.mission ?? null,
            },
          },
          update: { occurrences: { increment: 1 } },
        })
        .catch(() => undefined);
    },

    async fileRepairPlan(skill: CertifiedSkill, ctx: SkillContext, reason: string) {
      await prisma.adminWorkerRepairPlan
        .create({
          data: {
            kind: repairKindForCategory(skill.category) as never,
            failedEntity: ctx.targetEntityId ?? skill.name,
            repairAction: `Re-run certified skill ${skill.name}: ${reason}`.slice(0, 400),
            status: "PENDING",
            metadata: {
              skillName: skill.name,
              contentType: ctx.contentType ?? null,
              contentSubtype: ctx.contentSubtype ?? null,
              reason,
            },
          },
        })
        .catch(() => undefined);
    },
  };
}
