import { prisma } from "../db/client";

export type CreateSourceInput = {
  name: string;
  host: string;
  baseUrl: string;
  sourceType: string;
  isOfficial?: boolean;
  isActive?: boolean;
  rateLimitPerMin?: number | null;
  notes?: string | null;
};

export function listIngestionSources() {
  return prisma.ingestionSource.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      jobs: { include: { runs: { orderBy: { startedAt: "desc" }, take: 3 } } },
    },
  });
}

export function getIngestionSource(id: string) {
  return prisma.ingestionSource.findUnique({ where: { id } });
}

export async function createIngestionSource(input: CreateSourceInput) {
  const existing = await prisma.ingestionSource.findUnique({ where: { host: input.host } });
  if (existing) return { ok: false as const, reason: "duplicate" as const };
  const created = await prisma.ingestionSource.create({
    data: {
      name: input.name,
      host: input.host,
      baseUrl: input.baseUrl,
      sourceType: input.sourceType,
      isOfficial: input.isOfficial ?? false,
      isActive: input.isActive ?? true,
      rateLimitPerMin: input.rateLimitPerMin ?? null,
      notes: input.notes ?? null,
    },
  });
  return { ok: true as const, source: created };
}

export async function updateIngestionSource(
  id: string,
  patch: Partial<{
    name: string;
    baseUrl: string;
    sourceType: string;
    isOfficial: boolean;
    isActive: boolean;
    rateLimitPerMin: number | null;
    notes: string | null;
    reliabilityScore: number | null;
  }>,
) {
  const existing = await prisma.ingestionSource.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  const updated = await prisma.ingestionSource.update({ where: { id }, data: patch });
  return { ok: true as const, source: updated };
}

export async function recordSourceSyncResult(id: string, success: boolean, now: Date = new Date()) {
  return prisma.ingestionSource.update({
    where: { id },
    data: success ? { lastSuccessfulSync: now } : { lastFailedSync: now },
  });
}
