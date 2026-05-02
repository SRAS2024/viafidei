import { prisma } from "../db/client";
import type { Prisma } from "@prisma/client";

export const DEFAULT_JOURNAL_PAGE_SIZE = 50;
export const MAX_JOURNAL_PAGE_SIZE = 200;

export type JournalSort = "newest" | "oldest" | "updated" | "favorite";

export type ListJournalOptions = {
  take?: number;
  skip?: number;
  sort?: JournalSort;
  favoritesOnly?: boolean;
};

function orderByForSort(sort: JournalSort): Prisma.JournalEntryOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }];
    case "favorite":
      return [{ isFavorite: "desc" }, { updatedAt: "desc" }];
    case "updated":
    default:
      return [{ updatedAt: "desc" }];
  }
}

export function listJournalEntries(userId: string, options: ListJournalOptions = {}) {
  const take = Math.min(
    Math.max(options.take ?? DEFAULT_JOURNAL_PAGE_SIZE, 1),
    MAX_JOURNAL_PAGE_SIZE,
  );
  const skip = Math.max(options.skip ?? 0, 0);
  const sort = options.sort ?? "updated";
  return prisma.journalEntry.findMany({
    where: { userId, ...(options.favoritesOnly ? { isFavorite: true } : {}) },
    orderBy: orderByForSort(sort),
    take,
    skip,
  });
}

export function countJournalEntries(userId: string) {
  return prisma.journalEntry.count({ where: { userId } });
}

export function createJournalEntry(input: { userId: string; title: string; body: string }) {
  return prisma.journalEntry.create({ data: input });
}

export type DeleteJournalResult = { ok: true } | { ok: false; reason: "not_found" | "forbidden" };

export async function deleteJournalEntry(
  entryId: string,
  userId: string,
): Promise<DeleteJournalResult> {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true },
  });
  if (!entry) return { ok: false, reason: "not_found" };
  if (entry.userId !== userId) return { ok: false, reason: "forbidden" };
  await prisma.journalEntry.delete({ where: { id: entry.id } });
  return { ok: true };
}

export type JournalLookupResult<T> =
  | { ok: true; entry: T }
  | { ok: false; reason: "not_found" | "forbidden" };

export async function getJournalEntry(
  entryId: string,
  userId: string,
): Promise<JournalLookupResult<Awaited<ReturnType<typeof prisma.journalEntry.findUnique>>>> {
  const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { ok: false, reason: "not_found" };
  if (entry.userId !== userId) return { ok: false, reason: "forbidden" };
  return { ok: true, entry };
}

export async function updateJournalEntry(
  entryId: string,
  userId: string,
  patch: { title?: string; body?: string },
) {
  const lookup = await getJournalEntry(entryId, userId);
  if (!lookup.ok) return lookup;
  const updated = await prisma.journalEntry.update({
    where: { id: entryId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
    },
  });
  return { ok: true as const, entry: updated };
}

export async function setJournalFavorite(entryId: string, userId: string, isFavorite: boolean) {
  const lookup = await getJournalEntry(entryId, userId);
  if (!lookup.ok) return lookup;
  const updated = await prisma.journalEntry.update({
    where: { id: entryId },
    data: { isFavorite },
  });
  return { ok: true as const, entry: updated };
}
