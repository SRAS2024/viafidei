import { prisma } from "../db/client";

export function listIngestionSources() {
  return prisma.ingestionSource.findMany({
    orderBy: [{ isOfficial: "desc" }, { name: "asc" }],
  });
}

export function getIngestionSourceByHost(host: string) {
  return prisma.ingestionSource.findUnique({ where: { host } });
}

export function upsertIngestionSource(input: {
  name: string;
  host: string;
  baseUrl: string;
  sourceType: string;
  isOfficial?: boolean;
  rateLimitPerMin?: number | null;
}) {
  return prisma.ingestionSource.upsert({
    where: { host: input.host },
    create: {
      name: input.name,
      host: input.host,
      baseUrl: input.baseUrl,
      sourceType: input.sourceType,
      isOfficial: input.isOfficial ?? false,
      rateLimitPerMin: input.rateLimitPerMin ?? null,
    },
    update: {
      name: input.name,
      baseUrl: input.baseUrl,
      sourceType: input.sourceType,
      isOfficial: input.isOfficial ?? false,
      rateLimitPerMin: input.rateLimitPerMin ?? null,
    },
  });
}

export function upsertIngestionJob(input: {
  sourceId: string;
  jobName: string;
  targetEntity: string;
  schedule?: string | null;
  isActive?: boolean;
}) {
  return prisma.ingestionJob.upsert({
    where: { sourceId_jobName: { sourceId: input.sourceId, jobName: input.jobName } },
    create: {
      sourceId: input.sourceId,
      jobName: input.jobName,
      targetEntity: input.targetEntity,
      schedule: input.schedule ?? null,
      isActive: input.isActive ?? true,
    },
    update: {
      targetEntity: input.targetEntity,
      schedule: input.schedule ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

export function listActiveJobs() {
  return prisma.ingestionJob.findMany({
    where: { isActive: true },
    include: { source: true },
  });
}

export function listRecentJobRuns(jobId: string, take = 20) {
  return prisma.ingestionJobRun.findMany({
    where: { jobId },
    orderBy: { startedAt: "desc" },
    take,
  });
}
