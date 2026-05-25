/**
 * User saved-content data layer.
 *
 * Replaces the legacy 5-table UserSaved* feature with a single
 * UserSavedContent table that references PublishedContent by
 * (contentType, slug). The Admin Worker writes every public row to
 * PublishedContent — saved entries point at slugs there, not at
 * legacy id-keyed rows.
 *
 * `SavedKind` keeps the old public string identifiers so existing
 * API URLs (/api/saved/prayers, /api/saved/saints, …) continue to
 * work without breaking client links.
 */

import type { ChecklistContentType } from "@prisma/client";

import { prisma } from "../db/client";

export type SavedKind = "prayer" | "saint" | "apparition" | "devotion";

const SAVED_KIND_TO_CONTENT_TYPE: Record<SavedKind, ChecklistContentType> = {
  prayer: "PRAYER",
  saint: "SAINT",
  apparition: "APPARITION",
  devotion: "DEVOTION",
};

export type SaveOutcome = { ok: true; created: boolean } | { ok: false; reason: "not_found" };

/**
 * Confirm the slug exists + is currently published before allowing a
 * save. Prevents saves pointing at content that was later unpublished
 * or never existed.
 */
async function entityExists(kind: SavedKind, slug: string): Promise<boolean> {
  const contentType = SAVED_KIND_TO_CONTENT_TYPE[kind];
  const row = await prisma.publishedContent.findFirst({
    where: { contentType, slug, isPublished: true },
    select: { id: true },
  });
  return Boolean(row);
}

export async function saveItem(
  kind: SavedKind,
  userId: string,
  slug: string,
): Promise<SaveOutcome> {
  if (!(await entityExists(kind, slug))) return { ok: false, reason: "not_found" };
  const contentType = SAVED_KIND_TO_CONTENT_TYPE[kind];
  const existing = await prisma.userSavedContent.findUnique({
    where: {
      userId_contentType_contentSlug: { userId, contentType, contentSlug: slug },
    },
    select: { id: true },
  });
  if (existing) return { ok: true, created: false };
  await prisma.userSavedContent.create({
    data: { userId, contentType, contentSlug: slug },
  });
  return { ok: true, created: true };
}

export async function unsaveItem(
  kind: SavedKind,
  userId: string,
  slug: string,
): Promise<{ ok: true; removed: boolean }> {
  const contentType = SAVED_KIND_TO_CONTENT_TYPE[kind];
  const result = await prisma.userSavedContent.deleteMany({
    where: { userId, contentType, contentSlug: slug },
  });
  return { ok: true, removed: result.count > 0 };
}

export async function isSaved(kind: SavedKind, userId: string, slug: string): Promise<boolean> {
  const contentType = SAVED_KIND_TO_CONTENT_TYPE[kind];
  const row = await prisma.userSavedContent.findUnique({
    where: {
      userId_contentType_contentSlug: { userId, contentType, contentSlug: slug },
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function listSavedForKind(kind: SavedKind, userId: string) {
  const contentType = SAVED_KIND_TO_CONTENT_TYPE[kind];
  // Inner join: only return saved rows whose PublishedContent is
  // still published. A row that was unpublished or deleted disappears
  // from the user's saved list automatically.
  const saves = await prisma.userSavedContent.findMany({
    where: { userId, contentType },
    orderBy: { createdAt: "desc" },
  });
  if (saves.length === 0) return [];
  const slugs = saves.map((s) => s.contentSlug);
  const published = await prisma.publishedContent.findMany({
    where: { contentType, isPublished: true, slug: { in: slugs } },
  });
  const bySlug = new Map(published.map((p) => [p.slug, p]));
  return saves
    .map((save) => {
      const content = bySlug.get(save.contentSlug);
      if (!content) return null;
      return {
        id: save.id,
        savedAt: save.createdAt,
        contentType: save.contentType,
        slug: save.contentSlug,
        title: content.title,
        payload: content.payload,
        publishedAt: content.publishedAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function listSavedPrayers(userId: string) {
  return listSavedForKind("prayer", userId);
}
export async function listSavedSaints(userId: string) {
  return listSavedForKind("saint", userId);
}
export async function listSavedApparitions(userId: string) {
  return listSavedForKind("apparition", userId);
}
export async function listSavedDevotions(userId: string) {
  return listSavedForKind("devotion", userId);
}

/**
 * Sweep saved rows whose target PublishedContent is no longer
 * published. Called by the Admin Worker cleanup pass so a user's
 * saved list never contains an invisible target.
 */
export async function pruneOrphanedSaves(): Promise<number> {
  // Collect all (contentType, slug) pairs currently in UserSavedContent
  // that don't have a matching published row.
  const allSaves = await prisma.userSavedContent.findMany({
    select: { id: true, contentType: true, contentSlug: true },
  });
  if (allSaves.length === 0) return 0;
  const orphanedIds: string[] = [];
  for (const save of allSaves) {
    const live = await prisma.publishedContent.findFirst({
      where: {
        contentType: save.contentType,
        slug: save.contentSlug,
        isPublished: true,
      },
      select: { id: true },
    });
    if (!live) orphanedIds.push(save.id);
  }
  if (orphanedIds.length === 0) return 0;
  const result = await prisma.userSavedContent.deleteMany({
    where: { id: { in: orphanedIds } },
  });
  return result.count;
}
