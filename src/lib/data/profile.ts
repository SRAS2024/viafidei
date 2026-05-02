import { prisma } from "../db/client";
import { isSupportedLocale } from "../i18n/locales";

export type ProfileCounts = {
  journalCount: number;
  prayersSaved: number;
  saintsSaved: number;
  apparitionsSaved: number;
  parishesSaved: number;
  devotionsSaved: number;
  goalsCount: number;
  milestonesCount: number;
};

export type UpdateProfileInput = {
  languageOverride?: string | null;
  theme?: string | null;
};

export async function getProfileForUser(userId: string) {
  return prisma.profile.findUnique({
    where: { userId },
    include: { avatarMedia: true },
  });
}

export async function ensureProfile(userId: string) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.profile.create({ data: { userId } });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  await ensureProfile(userId);
  const data: { languageOverride?: string | null; theme?: string | null } = {};
  if (input.languageOverride !== undefined) {
    if (input.languageOverride === null || input.languageOverride === "") {
      data.languageOverride = null;
    } else if (isSupportedLocale(input.languageOverride)) {
      data.languageOverride = input.languageOverride;
    } else {
      return { ok: false as const, reason: "invalid_locale" as const };
    }
  }
  if (input.theme !== undefined) {
    data.theme = input.theme === null || input.theme === "" ? null : input.theme;
  }
  const updated = await prisma.profile.update({ where: { userId }, data });
  return { ok: true as const, profile: updated };
}

export async function setProfileAvatar(userId: string, mediaAssetId: string | null) {
  await ensureProfile(userId);
  const updated = await prisma.profile.update({
    where: { userId },
    data: { avatarMediaId: mediaAssetId },
    include: { avatarMedia: true },
  });
  return updated;
}

export async function getProfileCounts(userId: string): Promise<ProfileCounts> {
  const [
    journalCount,
    prayersSaved,
    saintsSaved,
    apparitionsSaved,
    parishesSaved,
    devotionsSaved,
    goalsCount,
    milestonesCount,
  ] = await Promise.all([
    prisma.journalEntry.count({ where: { userId } }),
    prisma.userSavedPrayer.count({ where: { userId } }),
    prisma.userSavedSaint.count({ where: { userId } }),
    prisma.userSavedApparition.count({ where: { userId } }),
    prisma.userSavedParish.count({ where: { userId } }),
    prisma.userSavedDevotion.count({ where: { userId } }),
    prisma.goal.count({ where: { userId } }),
    prisma.milestone.count({ where: { userId } }),
  ]);
  return {
    journalCount,
    prayersSaved,
    saintsSaved,
    apparitionsSaved,
    parishesSaved,
    devotionsSaved,
    goalsCount,
    milestonesCount,
  };
}

export function listGoalsForUser(userId: string) {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      checklist: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export function listMilestonesForUser(userId: string) {
  return prisma.milestone.findMany({
    where: { userId },
    orderBy: [{ tier: "asc" }, { createdAt: "desc" }],
  });
}
