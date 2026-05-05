import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { checkRequiredTables, checkSeedContent } from "@/lib/db/tables";

const ALL_TABLES = [
  "User",
  "Session",
  "Profile",
  "Prayer",
  "Saint",
  "MarianApparition",
  "Parish",
  "Devotion",
  "LiturgyEntry",
  "SpiritualLifeGuide",
  "DailyLiturgy",
  "JournalEntry",
  "Goal",
  "Milestone",
  "RateLimitBucket",
  "IngestionSource",
  "IngestionJob",
  "IngestionJobRun",
];

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRequiredTables", () => {
  it("returns ok=true and no missing entries when every required table is present", async () => {
    prismaMock.$queryRaw.mockResolvedValue(ALL_TABLES.map((tablename) => ({ tablename })));
    const result = await checkRequiredTables();
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.present).toHaveLength(ALL_TABLES.length);
    expect(result.publicContentMissing).toEqual([]);
  });

  it("flags individual missing tables (not silently passing)", async () => {
    prismaMock.$queryRaw.mockResolvedValue(
      ALL_TABLES.filter((t) => t !== "Goal" && t !== "Milestone").map((tablename) => ({
        tablename,
      })),
    );
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.missing.sort()).toEqual(["Goal", "Milestone"]);
    expect(result.present).not.toContain("Goal");
    expect(result.publicContentMissing).toEqual([]);
  });

  it("treats an empty schema (DB exists but no tables) as fully missing", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(ALL_TABLES);
    expect(result.present).toEqual([]);
  });

  it("flags missing public content tables separately from other required tables", async () => {
    // Drop the Prayer + LiturgyEntry tables — public reads will 500 without
    // them, so the health check must call this out as its own bucket.
    prismaMock.$queryRaw.mockResolvedValue(
      ALL_TABLES.filter((t) => t !== "Prayer" && t !== "LiturgyEntry").map((tablename) => ({
        tablename,
      })),
    );
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.publicContentMissing.sort()).toEqual(["LiturgyEntry", "Prayer"]);
  });
});

describe("checkSeedContent (empty database behavior)", () => {
  function stubAllCounts(value: number) {
    prismaMock.$queryRaw.mockResolvedValue([]);
    // The function reads `prisma.<model>.count` for six tables. We attach
    // a `count` mock fn to each model the function touches.
    type CountableModel = { count?: ReturnType<typeof vi.fn> };
    const m = prismaMock as unknown as Record<string, CountableModel>;
    for (const model of [
      "prayer",
      "saint",
      "marianApparition",
      "devotion",
      "liturgyEntry",
      "spiritualLifeGuide",
    ]) {
      m[model] = { count: vi.fn().mockResolvedValue(value) };
    }
  }

  it("reports ok=false when every counted table is empty (gracefully, no throw)", async () => {
    stubAllCounts(0);
    const result = await checkSeedContent();
    expect(result.ok).toBe(false);
    expect(result.counts).toEqual({
      prayers: 0,
      saints: 0,
      apparitions: 0,
      devotions: 0,
      liturgy: 0,
      guides: 0,
    });
  });

  it("reports ok=true the moment any one content type has rows", async () => {
    stubAllCounts(0);
    type CountableModel = { count: ReturnType<typeof vi.fn> };
    (prismaMock as unknown as Record<string, CountableModel>).prayer.count.mockResolvedValue(3);
    const result = await checkSeedContent();
    expect(result.ok).toBe(true);
    expect(result.counts.prayers).toBe(3);
  });
});
