import { prisma } from "../db/client";
import type { Locale } from "../i18n/locales";

export type SavedKind = "prayer" | "saint" | "apparition" | "parish" | "devotion";

export type SaveOutcome = { ok: true; created: boolean } | { ok: false; reason: "not_found" };

async function entityExists(kind: SavedKind, id: string): Promise<boolean> {
  switch (kind) {
    case "prayer":
      return Boolean(await prisma.prayer.findUnique({ where: { id }, select: { id: true } }));
    case "saint":
      return Boolean(await prisma.saint.findUnique({ where: { id }, select: { id: true } }));
    case "apparition":
      return Boolean(
        await prisma.marianApparition.findUnique({ where: { id }, select: { id: true } }),
      );
    case "parish":
      return Boolean(await prisma.parish.findUnique({ where: { id }, select: { id: true } }));
    case "devotion":
      return Boolean(await prisma.devotion.findUnique({ where: { id }, select: { id: true } }));
  }
}

export async function saveItem(
  kind: SavedKind,
  userId: string,
  entityId: string,
): Promise<SaveOutcome> {
  if (!(await entityExists(kind, entityId))) return { ok: false, reason: "not_found" };
  switch (kind) {
    case "prayer": {
      const result = await prisma.userSavedPrayer.upsert({
        where: { userId_prayerId: { userId, prayerId: entityId } },
        create: { userId, prayerId: entityId },
        update: {},
      });
      return { ok: true, created: result.createdAt.getTime() === result.createdAt.getTime() };
    }
    case "saint": {
      await prisma.userSavedSaint.upsert({
        where: { userId_saintId: { userId, saintId: entityId } },
        create: { userId, saintId: entityId },
        update: {},
      });
      return { ok: true, created: true };
    }
    case "apparition": {
      await prisma.userSavedApparition.upsert({
        where: { userId_apparitionId: { userId, apparitionId: entityId } },
        create: { userId, apparitionId: entityId },
        update: {},
      });
      return { ok: true, created: true };
    }
    case "parish": {
      await prisma.userSavedParish.upsert({
        where: { userId_parishId: { userId, parishId: entityId } },
        create: { userId, parishId: entityId },
        update: {},
      });
      return { ok: true, created: true };
    }
    case "devotion": {
      await prisma.userSavedDevotion.upsert({
        where: { userId_devotionId: { userId, devotionId: entityId } },
        create: { userId, devotionId: entityId },
        update: {},
      });
      return { ok: true, created: true };
    }
  }
}

export async function unsaveItem(
  kind: SavedKind,
  userId: string,
  entityId: string,
): Promise<{ ok: true; removed: boolean }> {
  switch (kind) {
    case "prayer": {
      const r = await prisma.userSavedPrayer.deleteMany({ where: { userId, prayerId: entityId } });
      return { ok: true, removed: r.count > 0 };
    }
    case "saint": {
      const r = await prisma.userSavedSaint.deleteMany({ where: { userId, saintId: entityId } });
      return { ok: true, removed: r.count > 0 };
    }
    case "apparition": {
      const r = await prisma.userSavedApparition.deleteMany({
        where: { userId, apparitionId: entityId },
      });
      return { ok: true, removed: r.count > 0 };
    }
    case "parish": {
      const r = await prisma.userSavedParish.deleteMany({ where: { userId, parishId: entityId } });
      return { ok: true, removed: r.count > 0 };
    }
    case "devotion": {
      const r = await prisma.userSavedDevotion.deleteMany({
        where: { userId, devotionId: entityId },
      });
      return { ok: true, removed: r.count > 0 };
    }
  }
}

// Strict visibility gate. Saved content listings filter out rows that
// are no longer publicly visible (failed strict QA, archived, deleted
// invalid by the factory) so a user never sees a save pointing at a
// row that has been hard-deleted. Cascade FK handles the actual
// reference cleanup; this filter handles the rows still in the table
// but no longer public.
const SAVED_PUBLIC_WHERE = {
  status: "PUBLISHED" as const,
  publicRenderReady: true,
  isThresholdEligible: true,
  archivedAt: null,
};

export async function listSavedPrayers(userId: string, locale: Locale) {
  const rows = await prisma.userSavedPrayer.findMany({
    where: { userId, prayer: SAVED_PUBLIC_WHERE },
    include: { prayer: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function listSavedSaints(userId: string, locale: Locale) {
  const rows = await prisma.userSavedSaint.findMany({
    where: { userId, saint: SAVED_PUBLIC_WHERE },
    include: { saint: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function listSavedApparitions(userId: string, locale: Locale) {
  const rows = await prisma.userSavedApparition.findMany({
    where: { userId, apparition: SAVED_PUBLIC_WHERE },
    include: { apparition: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function listSavedParishes(userId: string) {
  const rows = await prisma.userSavedParish.findMany({
    where: { userId, parish: SAVED_PUBLIC_WHERE },
    include: { parish: true },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function listSavedDevotions(userId: string, locale: Locale) {
  const rows = await prisma.userSavedDevotion.findMany({
    where: { userId, devotion: SAVED_PUBLIC_WHERE },
    include: { devotion: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

/**
 * Sweep saved rows whose target content is no longer publicly visible.
 * Called by the worker after every strict_cleanup pass so a user's
 * saved list never contains an invisible target. Cascade FK handles
 * hard-deleted rows; this handles archived / soft-removed rows that
 * are still in the catalog but not public anymore.
 */
export async function pruneOrphanedSaves(): Promise<{
  prayers: number;
  saints: number;
  apparitions: number;
  parishes: number;
  devotions: number;
}> {
  const orphan = { NOT: SAVED_PUBLIC_WHERE };
  const [pr, sa, ap, pa, dv] = await Promise.all([
    prisma.userSavedPrayer.deleteMany({ where: { prayer: orphan } }),
    prisma.userSavedSaint.deleteMany({ where: { saint: orphan } }),
    prisma.userSavedApparition.deleteMany({ where: { apparition: orphan } }),
    prisma.userSavedParish.deleteMany({ where: { parish: orphan } }),
    prisma.userSavedDevotion.deleteMany({ where: { devotion: orphan } }),
  ]);
  return {
    prayers: pr.count,
    saints: sa.count,
    apparitions: ap.count,
    parishes: pa.count,
    devotions: dv.count,
  };
}

export async function isSaved(kind: SavedKind, userId: string, entityId: string): Promise<boolean> {
  switch (kind) {
    case "prayer":
      return Boolean(
        await prisma.userSavedPrayer.findUnique({
          where: { userId_prayerId: { userId, prayerId: entityId } },
          select: { userId: true },
        }),
      );
    case "saint":
      return Boolean(
        await prisma.userSavedSaint.findUnique({
          where: { userId_saintId: { userId, saintId: entityId } },
          select: { userId: true },
        }),
      );
    case "apparition":
      return Boolean(
        await prisma.userSavedApparition.findUnique({
          where: { userId_apparitionId: { userId, apparitionId: entityId } },
          select: { userId: true },
        }),
      );
    case "parish":
      return Boolean(
        await prisma.userSavedParish.findUnique({
          where: { userId_parishId: { userId, parishId: entityId } },
          select: { userId: true },
        }),
      );
    case "devotion":
      return Boolean(
        await prisma.userSavedDevotion.findUnique({
          where: { userId_devotionId: { userId, devotionId: entityId } },
          select: { userId: true },
        }),
      );
  }
}
