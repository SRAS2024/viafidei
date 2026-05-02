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

export async function listSavedPrayers(userId: string, locale: Locale) {
  return prisma.userSavedPrayer.findMany({
    where: { userId },
    include: { prayer: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSavedSaints(userId: string, locale: Locale) {
  return prisma.userSavedSaint.findMany({
    where: { userId },
    include: { saint: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSavedApparitions(userId: string, locale: Locale) {
  return prisma.userSavedApparition.findMany({
    where: { userId },
    include: { apparition: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSavedParishes(userId: string) {
  return prisma.userSavedParish.findMany({
    where: { userId },
    include: { parish: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSavedDevotions(userId: string, locale: Locale) {
  return prisma.userSavedDevotion.findMany({
    where: { userId },
    include: { devotion: { include: { translations: { where: { locale } } } } },
    orderBy: { createdAt: "desc" },
  });
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
