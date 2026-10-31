/**
 * Ingestor leases: a short, renewable claim that one process is sweeping a
 * structured ingestor's corpus, so the worker's own ingest lane steps aside.
 *
 * WHY. An operator booster (scripts/booster/saint-sweep.ts) walks the SAINT
 * corpus page after page through the same publish path as the worker. Running
 * both at once doubles the Wikipedia traffic (Wikimedia's API etiquette asks
 * for SERIAL requests, and the in-process request gate cannot see another
 * process) and lets two writers map the same entity in the same minute. The
 * holder writes one GENERIC `AdminWorkerMemory` row; `runStructuredIngest`
 * yields to an unexpired lease it does not hold, and `pickIngestor` skips a
 * leased ingestor so the lane serves the others meanwhile.
 *
 * SAFE BY EXPIRY. A lease is only good until `until`; the holder renews it
 * every page, and a crashed holder simply stops renewing — the worker resumes
 * on its own a few minutes later. No migration, no lock table, nothing that
 * can wedge the worker.
 */

import type { PrismaClient } from "@prisma/client";

export const STRUCTURED_LEASE_PREFIX = "structured-lease:";

export interface IngestorLease {
  holder: string;
  /** Epoch ms after which the lease no longer counts. */
  until: number;
}

export function leaseKey(ingestorId: string): string {
  return `${STRUCTURED_LEASE_PREFIX}${ingestorId}`;
}

function parseLease(value: unknown): IngestorLease | null {
  const v = (value ?? {}) as Partial<IngestorLease>;
  if (typeof v.holder !== "string" || !v.holder) return null;
  if (typeof v.until !== "number" || !Number.isFinite(v.until)) return null;
  return { holder: v.holder, until: v.until };
}

/** The unexpired lease on one ingestor, or null. Fail-open (null on error). */
export async function readIngestorLease(
  prisma: PrismaClient,
  ingestorId: string,
  nowMs: number = Date.now(),
): Promise<IngestorLease | null> {
  try {
    const row = await prisma.adminWorkerMemory.findUnique({
      where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: leaseKey(ingestorId) } },
      select: { memoryValue: true },
    });
    const lease = parseLease(row?.memoryValue);
    return lease && lease.until > nowMs ? lease : null;
  } catch {
    return null;
  }
}

/** Every unexpired lease, by ingestor id (one query). Fail-open (empty). */
export async function activeIngestorLeases(
  prisma: PrismaClient,
  nowMs: number = Date.now(),
): Promise<Map<string, IngestorLease>> {
  const out = new Map<string, IngestorLease>();
  try {
    const rows = await prisma.adminWorkerMemory.findMany({
      where: { memoryType: "GENERIC", memoryKey: { startsWith: STRUCTURED_LEASE_PREFIX } },
      select: { memoryKey: true, memoryValue: true },
    });
    for (const row of rows ?? []) {
      const lease = parseLease(row.memoryValue);
      if (lease && lease.until > nowMs) {
        out.set(row.memoryKey.slice(STRUCTURED_LEASE_PREFIX.length), lease);
      }
    }
  } catch {
    // fail-open: no leases means the worker behaves exactly as before
  }
  return out;
}

/**
 * Take (or renew) the lease for `holder`. Refused while another holder's lease
 * is unexpired. Returns the lease now in force.
 */
export async function acquireIngestorLease(
  prisma: PrismaClient,
  ingestorId: string,
  holder: string,
  ttlMs: number,
  nowMs: number = Date.now(),
): Promise<{ ok: boolean; lease: IngestorLease | null }> {
  const current = await readIngestorLease(prisma, ingestorId, nowMs);
  if (current && current.holder !== holder) return { ok: false, lease: current };
  const lease: IngestorLease = { holder, until: nowMs + Math.max(1_000, ttlMs) };
  await prisma.adminWorkerMemory.upsert({
    where: { memoryType_memoryKey: { memoryType: "GENERIC", memoryKey: leaseKey(ingestorId) } },
    update: { memoryValue: { ...lease }, lastUsedAt: new Date(nowMs) },
    create: {
      memoryType: "GENERIC",
      memoryKey: leaseKey(ingestorId),
      memoryValue: { ...lease },
      lastUsedAt: new Date(nowMs),
    },
  });
  return { ok: true, lease };
}

/** Drop the lease if `holder` still holds it. Never throws. */
export async function releaseIngestorLease(
  prisma: PrismaClient,
  ingestorId: string,
  holder: string,
): Promise<void> {
  try {
    const current = await readIngestorLease(prisma, ingestorId);
    if (current && current.holder !== holder) return;
    await prisma.adminWorkerMemory.deleteMany({
      where: { memoryType: "GENERIC", memoryKey: leaseKey(ingestorId) },
    });
  } catch {
    // the lease expires on its own
  }
}
