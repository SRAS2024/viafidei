import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  addChecklistItem,
  deleteChecklistItem,
  deleteGoal,
  getGoal,
  updateChecklistItem,
  updateGoal,
} from "@/lib/data/goals";

beforeEach(() => {
  resetPrismaMock();
});

describe("goal ownership scoping", () => {
  it("getGoal returns not_found when no row exists", async () => {
    prismaMock.goal.findUnique.mockResolvedValue(null);
    const result = await getGoal("user-A", "missing");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("getGoal returns forbidden when the row belongs to another user", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-B",
      title: "Theirs",
      checklist: [],
    });
    const result = await getGoal("user-A", "g1");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("getGoal returns the row only when the user owns it", async () => {
    const row = { id: "g1", userId: "user-A", title: "Mine", checklist: [] };
    prismaMock.goal.findUnique.mockResolvedValue(row);
    const result = await getGoal("user-A", "g1");
    expect(result).toEqual({ ok: true, goal: row });
  });

  it("updateGoal refuses to mutate a goal that belongs to another user", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-B",
      title: "Theirs",
      checklist: [],
    });
    const result = await updateGoal("user-A", "g1", { title: "Hijacked" });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(prismaMock.goal.update).not.toHaveBeenCalled();
  });

  it("deleteGoal refuses to delete a goal that belongs to another user", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-B",
      title: "Theirs",
      checklist: [],
    });
    const result = await deleteGoal("user-A", "g1");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(prismaMock.goal.delete).not.toHaveBeenCalled();
  });

  it("addChecklistItem refuses to add an item to a goal the user does not own", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-B",
      checklist: [],
    });
    const result = await addChecklistItem("user-A", "g1", "Hijacked item");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(prismaMock.goalChecklistItem.create).not.toHaveBeenCalled();
  });

  it("updateChecklistItem refuses to touch items on a goal owned by another user", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-B",
      checklist: [],
    });
    const result = await updateChecklistItem("user-A", "g1", "i1", { isCompleted: true });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(prismaMock.goalChecklistItem.update).not.toHaveBeenCalled();
  });

  it("deleteChecklistItem refuses to delete items on a goal owned by another user", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-B",
      checklist: [],
    });
    const result = await deleteChecklistItem("user-A", "g1", "i1");
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(prismaMock.goalChecklistItem.delete).not.toHaveBeenCalled();
  });

  it("updateChecklistItem rejects an item that belongs to a different goal", async () => {
    prismaMock.goal.findUnique.mockResolvedValue({
      id: "g1",
      userId: "user-A",
      checklist: [],
    });
    prismaMock.goalChecklistItem.findUnique.mockResolvedValue({ id: "i1", goalId: "g2" });
    const result = await updateChecklistItem("user-A", "g1", "i1", { isCompleted: true });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(prismaMock.goalChecklistItem.update).not.toHaveBeenCalled();
  });
});
