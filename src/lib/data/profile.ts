import { prisma } from "../db/client";

export type ProfileCounts = {
  journalCount: number;
  prayersSaved: number;
  saintsSaved: number;
  goalsCount: number;
  milestonesCount: number;
};

export async function getProfileCounts(userId: string): Promise<ProfileCounts> {
  const [journalCount, prayersSaved, saintsSaved, goalsCount, milestonesCount] =
    await Promise.all([
      prisma.journalEntry.count({ where: { userId } }),
      prisma.userSavedPrayer.count({ where: { userId } }),
      prisma.userSavedSaint.count({ where: { userId } }),
      prisma.goal.count({ where: { userId } }),
      prisma.milestone.count({ where: { userId } }),
    ]);
  return { journalCount, prayersSaved, saintsSaved, goalsCount, milestonesCount };
}

export function listGoalsForUser(userId: string) {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export function listMilestonesForUser(userId: string) {
  return prisma.milestone.findMany({
    where: { userId },
    orderBy: [{ tier: "asc" }, { createdAt: "desc" }],
  });
}
