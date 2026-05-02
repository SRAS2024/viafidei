import { prisma } from "../db/client";

export const DEFAULT_JOURNAL_PAGE_SIZE = 50;
export const MAX_JOURNAL_PAGE_SIZE = 200;

export type ListJournalOptions = {
  take?: number;
  skip?: number;
};

export function listJournalEntries(userId: string, options: ListJournalOptions = {}) {
  const take = Math.min(
    Math.max(options.take ?? DEFAULT_JOURNAL_PAGE_SIZE, 1),
    MAX_JOURNAL_PAGE_SIZE,
  );
  const skip = Math.max(options.skip ?? 0, 0);
  return prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
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
