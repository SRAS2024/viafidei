import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  deleteJournalEntry,
  getJournalEntry,
  setJournalFavorite,
  updateJournalEntry,
} from "@/lib/data/journal";

beforeEach(() => {
  resetPrismaMock();
});

describe("journal ownership scoping", () => {
  it("getJournalEntry returns not_found when no row exists", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue(null);
    const result = await getJournalEntry("entry-missing", "user-A");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("getJournalEntry returns forbidden when the row belongs to a different user", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-B",
      title: "Theirs",
      body: "...",
    });
    const result = await getJournalEntry("e1", "user-A");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("getJournalEntry returns ok when the user owns the row", async () => {
    const entry = { id: "e1", userId: "user-A", title: "Mine", body: "..." };
    prismaMock.journalEntry.findUnique.mockResolvedValue(entry);
    const result = await getJournalEntry("e1", "user-A");
    expect(result).toEqual({ ok: true, entry });
  });

  it("updateJournalEntry refuses to mutate a row that belongs to another user", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-B",
      title: "Theirs",
      body: "...",
    });
    const result = await updateJournalEntry("e1", "user-A", { title: "Hijacked" });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    // Critical: the write must not have been attempted.
    expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
  });

  it("setJournalFavorite refuses to flip the favorite flag on another user's row", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-B",
    });
    const result = await setJournalFavorite("e1", "user-A", true);
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(prismaMock.journalEntry.update).not.toHaveBeenCalled();
  });

  it("deleteJournalEntry refuses to delete a row that belongs to another user", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-B",
    });
    const result = await deleteJournalEntry("e1", "user-A");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    // Critical: the delete must not have been attempted.
    expect(prismaMock.journalEntry.delete).not.toHaveBeenCalled();
  });

  it("deleteJournalEntry deletes only when the user owns the row", async () => {
    prismaMock.journalEntry.findUnique.mockResolvedValue({
      id: "e1",
      userId: "user-A",
    });
    prismaMock.journalEntry.delete.mockResolvedValue({});
    const result = await deleteJournalEntry("e1", "user-A");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.journalEntry.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
});
