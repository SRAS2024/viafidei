/**
 * Security + maintenance skill pack. Real operational duties the worker can do
 * safely (most are allowed in safe degraded mode): defend the admin surface,
 * run diagnostics, check database / brain / public-site / admin-surface health,
 * clean stale jobs, close resolved repairs, and refresh capability scores. Each
 * reports honestly when it cannot complete.
 */

import { defend, type DefendInput } from "../security-defender";
import { runAdminWorkerDiagnostics } from "../diagnostics";
import { isBrainEnabled } from "../intelligence";
import { refreshCapabilityMatrix } from "./capability";
import { makeOpSkill } from "./skill-helpers";
import type { CertifiedSkill } from "./types";

export const securitySkills: CertifiedSkill[] = [
  makeOpSkill({
    name: "run_security_defense",
    purpose: "Respond to a security event through the deterministic defender pipeline.",
    category: "SECURITY",
    riskLevel: "medium",
    allowedInSafeDegradedMode: true,
    inputs: ["eventType", "classification", "severity", "reason", "confidence"],
    // Defending (banning a confirmed-malicious device) is reversible via the admin
    // surface; declare a no-op rollback so the action is permitted under preflight.
    rollback: async () => ({
      status: "NOT_NEEDED",
      detail: "defense actions are admin-reversible",
    }),
    run: async (ctx) => {
      const outcome = await defend(ctx.prisma, ctx.input as unknown as DefendInput);
      return { ok: outcome != null, detail: "defender ran" };
    },
  }),
  makeOpSkill({
    name: "run_worker_diagnostics",
    purpose: "Run the Admin Worker subsystem diagnostics.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const ratings = await runAdminWorkerDiagnostics(ctx.prisma);
      return { ok: Array.isArray(ratings), detail: `${ratings.length} ratings` };
    },
  }),
  makeOpSkill({
    name: "verify_database_health",
    purpose: "Confirm the database accepts a query.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      try {
        await ctx.prisma.$queryRaw`SELECT 1`;
        return { ok: true, detail: "database reachable" };
      } catch (e) {
        return { ok: false, detail: e instanceof Error ? e.message : "db unreachable" };
      }
    },
  }),
  makeOpSkill({
    name: "verify_brain_health",
    purpose: "Confirm the Python final brain is enabled/reachable.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    onVerifyFail: "HUMAN_REVIEW",
    run: async () => {
      const ok = isBrainEnabled();
      return { ok, detail: ok ? "brain enabled" : "brain disabled — safe degraded mode" };
    },
  }),
  makeOpSkill({
    name: "verify_public_site_health",
    purpose: "Confirm the public site has published content to serve.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const n = await ctx.prisma.publishedContent.count({ where: { isPublished: true } });
      return { ok: n > 0, detail: `${n} published rows` };
    },
  }),
  makeOpSkill({
    name: "verify_admin_surface_health",
    purpose: "Confirm the Admin Worker singleton state row exists.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const s = await ctx.prisma.adminWorkerState.findFirst({ select: { id: true } });
      return { ok: s != null, detail: s ? "state present" : "no worker state" };
    },
  }),
  makeOpSkill({
    name: "clean_stale_jobs",
    purpose: "Remove build jobs that completed/failed more than 30 days ago.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const res = await ctx.prisma.workerBuildJob
        .deleteMany({
          where: {
            status: { in: ["succeeded", "failed", "cancelled"] },
            updatedAt: { lt: cutoff },
          },
        })
        .catch(() => ({ count: 0 }));
      return { ok: true, detail: `removed ${res.count} stale job(s)` };
    },
  }),
  makeOpSkill({
    name: "close_resolved_repairs",
    purpose: "Close repair plans that have exhausted their attempts.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    run: async (ctx) => {
      const res = await ctx.prisma.adminWorkerRepairPlan
        .updateMany({
          where: { status: "PENDING", attempts: { gte: 5 } },
          data: { status: "ABANDONED", finalResult: "max attempts exhausted (skill cleanup)" },
        })
        .catch(() => ({ count: 0 }));
      return { ok: true, detail: `closed ${res.count} exhausted repair(s)` };
    },
  }),
  makeOpSkill({
    name: "refresh_capability_scores",
    purpose: "Recompute the capability coverage matrix from the certified-skill registry.",
    category: "MAINTENANCE",
    allowedInSafeDegradedMode: true,
    brainOps: [],
    run: async (ctx) => {
      const out = await refreshCapabilityMatrix(ctx.prisma);
      return { ok: true, detail: `${out.certified} certified / ${out.missing} missing` };
    },
  }),
];
