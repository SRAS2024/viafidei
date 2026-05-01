import { prisma } from "../db/client";

export function listIngestionSourcesWithLatestRuns() {
  return prisma.ingestionSource.findMany({
    include: {
      jobs: { include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } } },
    },
  });
}
