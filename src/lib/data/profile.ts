import { prisma } from "../db/client";
import { isSupportedLocale } from "../i18n/locales";
import { checksumDataUrl, type AvatarDataUrlOk } from "../media/avatar-data-url";

export type ProfileCounts = {
  journalCount: number;
  prayersSaved: number;
  saintsSaved: number;
  apparitionsSaved: number;
  parishesSaved: number;
  devotionsSaved: number;
  goalsCount: number;
  completedGoalsCount: number;
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
  let userLanguage: string | undefined;
  if (input.languageOverride !== undefined) {
    if (input.languageOverride === null || input.languageOverride === "") {
      data.languageOverride = null;
    } else if (isSupportedLocale(input.languageOverride)) {
      data.languageOverride = input.languageOverride;
      userLanguage = input.languageOverride;
    } else {
      return { ok: false as const, reason: "invalid_locale" as const };
    }
  }
  if (input.theme !== undefined) {
    data.theme = input.theme === null || input.theme === "" ? null : input.theme;
  }
  const updated = await prisma.profile.update({ where: { userId }, data });
  if (userLanguage) {
    await prisma.user.update({ where: { id: userId }, data: { language: userLanguage } });
  }
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

/**
 * Persist a user-uploaded, browser-optimized profile photo.
 *
 * The image arrives as a self-contained `data:` URL (no upstream URL,
 * because the user uploaded it from their device). We dedupe on a sha256
 * checksum so re-uploading the same photo doesn't pile up MediaAsset rows,
 * and we link the resulting asset to the profile in a single transaction
 * so the avatar is committed before the route returns — there is no
 * separate "save" step that the user could forget.
 */
export async function setProfileAvatarFromDataUrl(userId: string, validated: AvatarDataUrlOk) {
  await ensureProfile(userId);
  const checksum = await checksumDataUrl(validated.dataUrl);

  const profile = await prisma.$transaction(async (tx) => {
    const existingAsset = await tx.mediaAsset.findFirst({ where: { checksum } });
    const asset = existingAsset
      ? existingAsset
      : await tx.mediaAsset.create({
          data: {
            url: validated.dataUrl,
            kind: "PHOTO",
            altText: "Profile photo",
            attribution: "User upload",
            checksum,
            reviewStatus: "AUTO_APPROVED",
          },
        });
    return tx.profile.update({
      where: { userId },
      data: { avatarMediaId: asset.id },
      include: { avatarMedia: true },
    });
  });

  return { profile };
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
    completedGoalsCount,
    milestonesCount,
  ] = await Promise.all([
    prisma.journalEntry.count({ where: { userId } }),
    prisma.userSavedPrayer.count({ where: { userId } }),
    prisma.userSavedSaint.count({ where: { userId } }),
    prisma.userSavedApparition.count({ where: { userId } }),
    prisma.userSavedParish.count({ where: { userId } }),
    prisma.userSavedDevotion.count({ where: { userId } }),
    prisma.goal.count({ where: { userId } }),
    prisma.goal.count({ where: { userId, status: "COMPLETED" } }),
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
    completedGoalsCount,
    milestonesCount,
  };
}

/**
 * Goals shown on the active /profile/goals page. We exclude COMPLETED
 * goals here because they live under /profile/goals/completed as part
 * of the user's preserved spiritual history. Archived goals stay so
 * the user can un-archive them without leaving the page.
 */
export function listGoalsForUser(userId: string) {
  return prisma.goal.findMany({
    where: { userId, status: { in: ["ACTIVE", "OVERDUE", "ARCHIVED"] } },
    orderBy: { updatedAt: "desc" },
    include: {
      checklist: { orderBy: { sortOrder: "asc" } },
    },
  });
}

/**
 * Completed goals as they appear on the profile's "Completed goals"
 * section. Each row carries the checklist (so the user can revisit what
 * they actually did) and the journal entries they wrote inside the
 * goal, ordered by most recent first.
 *
 * Completed goals are kept indefinitely — they form the user's
 * spiritual history alongside the milestones they earned.
 */
export function listCompletedGoalsForUser(userId: string) {
  return prisma.goal.findMany({
    where: { userId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    include: {
      checklist: { orderBy: { sortOrder: "asc" } },
      journalEntries: { orderBy: { createdAt: "desc" } },
    },
  });
}

export function countCompletedGoalsForUser(userId: string) {
  return prisma.goal.count({ where: { userId, status: "COMPLETED" } });
}

export function listMilestonesForUser(userId: string) {
  return prisma.milestone.findMany({
    where: { userId },
    orderBy: [{ tier: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Returns the user's sacrament and consecration badges in display order
 * — sacraments first, then consecrations, then any other PERSONAL or
 * SPIRITUAL milestones. Used by the profile header to render the
 * achievement strip directly under the avatar and name.
 *
 * The badge image / icon is resolved from `goal.templateSlug` via
 * `getBadgeForGoalSlug` on the client; here we just return the
 * milestone metadata in a serialisable shape.
 */
export async function listBadgesForUser(userId: string) {
  const milestones = await prisma.milestone.findMany({
    where: { userId },
    include: { goal: true },
    orderBy: [{ tier: "asc" }, { createdAt: "asc" }],
  });
  return milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    tier: m.tier as "SACRAMENT" | "SPIRITUAL" | "PERSONAL",
    earnedAt: m.createdAt,
    /** Goal templateSlug (e.g. "sacrament-baptism", "consecration-marian-de-montfort"). */
    templateSlug: m.goal?.templateSlug ?? null,
  }));
}
