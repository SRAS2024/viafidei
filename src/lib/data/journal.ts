import { prisma } from "../db/client";

export function listJournalEntries(userId: string) {
  return prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export function createJournalEntry(input: {
  userId: string;
  title: string;
  body: string;
}) {
  return prisma.journalEntry.create({
    data: input,
  });
}

export function deleteJournalEntry(entryId: string, userId: string) {
  return prisma.journalEntry.deleteMany({ where: { id: entryId, userId } });
}
