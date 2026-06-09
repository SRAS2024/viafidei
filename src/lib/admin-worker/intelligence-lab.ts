/**
 * Intelligence Laboratory pass (spec: "Integrate the Intelligence Laboratory
 * into the worker loop — it should not be passive").
 *
 * Runs periodically (throttled, best-effort, non-blocking, and a no-op when the
 * Python brain is offline). It consults the lab's brain operations and records
 * the results to the audit trail so they surface in the Developer Audit and the
 * admin dashboard. It is strictly ADVISORY: the lab may recommend changes, but
 * it never deploys code, mutates schema, or publishes. Code/schema/architecture
 * recommendations flow through developer requests + human review; only safe
 * ranking/learning signals may be adopted by TypeScript policy.
 */

import type { PrismaClient } from "@prisma/client";

import { callBrain } from "./intelligence/client";
import { isBrainEnabled } from "./intelligence";
import { recordBrainCall } from "./intelligence/store";
import { writeAdminWorkerLog } from "./logs";

export interface LabPassResult {
  ran: boolean;
  consulted: string[];
  highestLeverage?: string | null;
  architectureIntegrity?: number | null;
}

/**
 * One Intelligence Laboratory consultation. Best-effort: each brain call is
 * guarded and recorded; failures never propagate. Returns what it learned.
 */
export async function runIntelligenceLabPass(
  prisma: PrismaClient,
  opts: {
    passId?: string;
    signals?: Record<string, number>;
    report?: Record<string, unknown>;
  } = {},
): Promise<LabPassResult> {
  const consulted: string[] = [];
  const result: LabPassResult = { ran: false, consulted };
  if (!isBrainEnabled()) return result;
  result.ran = true;

  // 1. Highest-leverage next change — the single most valuable improvement now.
  const leverage = await callBrain<{ highest_leverage?: string | null }>(
    "rank_highest_leverage_change",
    {},
  ).catch(() => null);
  if (leverage) {
    consulted.push("rank_highest_leverage_change");
    result.highestLeverage = leverage.result?.highest_leverage ?? null;
    await recordBrainCall(prisma, "rank_highest_leverage_change", leverage, {
      entityId: "lab",
      passId: opts.passId ?? null,
    }).catch(() => undefined);
  }

  // 2. Architecture integrity — keep the one unified brain unified (advisory).
  const arch = await callBrain<{ integrity?: number }>("generate_architecture_report", {
    report: opts.report ?? {},
  }).catch(() => null);
  if (arch) {
    consulted.push("generate_architecture_report");
    result.architectureIntegrity = arch.result?.integrity ?? null;
    await recordBrainCall(prisma, "generate_architecture_report", arch, {
      entityId: "lab",
      passId: opts.passId ?? null,
    }).catch(() => undefined);
  }

  // 3. Causal root cause for the worker's current dominant symptom (if any).
  const symptom = Object.entries(opts.signals ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (symptom) {
    const root = await callBrain("explain_root_cause", {
      symptom,
      signals: opts.signals ?? {},
    }).catch(() => null);
    if (root) {
      consulted.push("explain_root_cause");
      await recordBrainCall(prisma, "explain_root_cause", root, {
        entityId: symptom,
        passId: opts.passId ?? null,
      }).catch(() => undefined);
    }
  }

  await writeAdminWorkerLog(prisma, {
    passId: opts.passId,
    category: "REPORT",
    severity: "INFO",
    eventName: "intelligence_lab_pass",
    message: `Intelligence Lab consulted ${consulted.length} op(s); highest-leverage: ${result.highestLeverage ?? "n/a"}; architecture integrity: ${result.architectureIntegrity ?? "n/a"}.`,
    safeMetadata: {
      consulted,
      highestLeverage: result.highestLeverage ?? null,
      architectureIntegrity: result.architectureIntegrity ?? null,
    },
  }).catch(() => undefined);

  return result;
}

// Throttle so the loop can call it every pass cheaply; runs at most once per
// window per process. The lab is supplementary self-evaluation, not the
// pass's final action (the Python brain selects that elsewhere).
let lastLabPassAt = 0;
const LAB_PASS_THROTTLE_MS = 30 * 60 * 1000;

/** Loop-friendly throttled wrapper around {@link runIntelligenceLabPass}. */
export async function maybeRunIntelligenceLabPass(
  prisma: PrismaClient,
  opts: {
    passId?: string;
    signals?: Record<string, number>;
    report?: Record<string, unknown>;
  } = {},
): Promise<LabPassResult | null> {
  if (Date.now() - lastLabPassAt < LAB_PASS_THROTTLE_MS) return null;
  lastLabPassAt = Date.now();
  return runIntelligenceLabPass(prisma, opts);
}
