/**
 * Persisted cool-down for the structured (SPARQL) source.
 *
 * The in-process gate in `wikidata.ts` already stops ONE worker process from
 * hammering a throttled Query Service. But the worker runs as passes, and a
 * pass can start in a fresh process (local host restarts, a redeploy, the
 * scripts/run-worker one-shot) that knows nothing about the throttle the last
 * pass hit. Persisting the cool-down in `AdminWorkerMemory` lets the NEXT pass
 * skip the structured lanes outright instead of re-discovering the 429 and
 * consuming another slot of the per-client WDQS error budget. Fail-open: a DB
 * blip reads as "no cool-down".
 */

import type { PrismaClient } from "@prisma/client";

import { applySparqlCooldown, lastSparqlFailure, sparqlCooldownUntil } from "./wikidata";

export const SOURCE_COOLDOWN_KEY = "structured-source-cooldown";

/** Never persist a cool-down longer than this, whatever Retry-After said. */
const MAX_PERSISTED_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Milliseconds the structured source should still be left alone (0 = open).
 * Reads the persisted value and seeds the in-process gate from it so the
 * transport also refuses to send while cooling.
 */
export async function readSourceCooldownMs(prisma: PrismaClient): Promise<number> {
  const row = await prisma.adminWorkerMemory
    .findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SOURCE_COOLDOWN_KEY } },
      select: { memoryValue: true },
    })
    .catch(() => null);
  const until = (row?.memoryValue as { until?: number } | null)?.until;
  if (typeof until === "number" && until > Date.now()) applySparqlCooldown(until);
  const remaining = sparqlCooldownUntil() - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * After a failed runSparql, persist the cool-down the transport decided on (if
 * any) so later passes / processes honour it. Returns the persisted `until`
 * (epoch ms) or null when nothing needed persisting.
 */
export async function persistSourceCooldown(prisma: PrismaClient): Promise<number | null> {
  const failure = lastSparqlFailure();
  const until = failure?.cooldownUntil ?? null;
  if (!until || until <= Date.now()) return null;
  const capped = Math.min(until, Date.now() + MAX_PERSISTED_COOLDOWN_MS);
  const value = {
    until: capped,
    kind: failure?.kind ?? "unknown",
    status: failure?.status ?? null,
  };
  await prisma.adminWorkerMemory
    .upsert({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: SOURCE_COOLDOWN_KEY } },
      update: { memoryValue: value, lastUsedAt: new Date(), failureCount: { increment: 1 } },
      create: {
        memoryType: "GENERIC",
        memoryKey: SOURCE_COOLDOWN_KEY,
        memoryValue: value,
        failureCount: 1,
        lastUsedAt: new Date(),
      },
    })
    .catch(() => undefined);
  return capped;
}
