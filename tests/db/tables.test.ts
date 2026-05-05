import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { checkRequiredTables, checkSeedContent } from "@/lib/db/tables";

const ALL_TABLES = [
  "User",
  "Session",
  "Profile",
  "PasswordResetToken",
  "EmailVerificationToken",
  "Prayer",
  "Saint",
  "MarianApparition",
  "Parish",
  "Devotion",
  "LiturgyEntry",
  "SpiritualLifeGuide",
  "DailyLiturgy",
  "PrayerTranslation",
  "SaintTranslation",
  "MarianApparitionTranslation",
  "DevotionTranslation",
  "LiturgyEntryTranslation",
  "SpiritualLifeGuideTranslation",
  "JournalEntry",
  "Goal",
  "GoalChecklistItem",
  "Milestone",
  "Category",
  "Tag",
  "EntityTag",
  "MediaAsset",
  "EntityMediaLink",
  "SiteSetting",
  "HomePage",
  "HomePageBlock",
  "AdminAuditLog",
  "ContentReview",
  "RateLimitBucket",
  "IngestionSource",
  "IngestionJob",
  "IngestionJobRun",
  "UserSavedPrayer",
  "UserSavedSaint",
  "UserSavedApparition",
  "UserSavedParish",
  "UserSavedDevotion",
];

// All columns required by REQUIRED_COLUMNS in src/lib/db/tables.ts. The mock
// pretends these columns exist on every table so `checkRequiredTables`
// reports `columnsMissing: []` whenever the table is present.
const ALL_COLUMNS = [
  "id",
  "email",
  "passwordHash",
  "firstName",
  "lastName",
  "role",
  "language",
  "emailVerifiedAt",
  "createdAt",
  "updatedAt",
  "userId",
  "tokenHash",
  "expiresAt",
  "slug",
  "defaultTitle",
  "body",
  "category",
  "officialPrayer",
  "externalSourceKey",
  "sourceHost",
  "status",
  "canonicalName",
  "biography",
  "patronages",
  "title",
  "summary",
  "kind",
];

/**
 * The new checkRequiredTables makes one query for tables and then one query
 * per entry in REQUIRED_COLUMNS to verify columns. The mock dispatches by
 * inspecting the SQL string so tests don't need to chain mockResolvedValueOnce.
 */
function mockSchema({
  tables = ALL_TABLES,
  columns = ALL_COLUMNS,
}: {
  tables?: readonly string[];
  columns?: readonly string[];
} = {}) {
  prismaMock.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = Array.isArray(strings) ? strings.join("") : String(strings);
    if (/pg_tables/i.test(sql)) {
      return Promise.resolve(tables.map((tablename) => ({ tablename })));
    }
    if (/information_schema\.columns/i.test(sql)) {
      return Promise.resolve(columns.map((column_name) => ({ column_name })));
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRequiredTables", () => {
  it("returns ok=true and no missing entries when every required table is present", async () => {
    mockSchema();
    const result = await checkRequiredTables();
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.present).toHaveLength(ALL_TABLES.length);
    expect(result.publicContentMissing).toEqual([]);
    expect(result.columnsMissing).toEqual([]);
  });

  it("flags individual missing tables (not silently passing)", async () => {
    mockSchema({
      tables: ALL_TABLES.filter((t) => t !== "Goal" && t !== "Milestone"),
    });
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.missing.sort()).toEqual(["Goal", "Milestone"]);
    expect(result.present).not.toContain("Goal");
    expect(result.publicContentMissing).toEqual([]);
  });

  it("treats an empty schema (DB exists but no tables) as fully missing", async () => {
    mockSchema({ tables: [] });
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.missing.sort()).toEqual([...ALL_TABLES].sort());
    expect(result.present).toEqual([]);
  });

  it("flags missing public content tables separately from other required tables", async () => {
    // Drop the Prayer + LiturgyEntry tables — public reads will 500 without
    // them, so the health check must call this out as its own bucket.
    mockSchema({
      tables: ALL_TABLES.filter((t) => t !== "Prayer" && t !== "LiturgyEntry"),
    });
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.publicContentMissing.sort()).toEqual(["LiturgyEntry", "Prayer"]);
  });

  it("flags missing columns on a present table without claiming the table itself is missing", async () => {
    // User table is present but is missing "language" — exactly the symptom
    // we get when migration 0005 hasn't run.
    mockSchema({
      columns: ALL_COLUMNS.filter((c) => c !== "language"),
    });
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    const userMissing = result.columnsMissing.find((c) => c.table === "User");
    expect(userMissing?.columns).toContain("language");
  });
});

describe("checkSeedContent (empty database behavior)", () => {
  function stubAllCounts(value: number) {
    prismaMock.$queryRaw.mockResolvedValue([]);
    type CountableModel = { count?: ReturnType<typeof vi.fn> };
    const m = prismaMock as unknown as Record<string, CountableModel>;
    for (const model of [
      "prayer",
      "saint",
      "marianApparition",
      "devotion",
      "liturgyEntry",
      "spiritualLifeGuide",
      "parish",
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
      parishes: 0,
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
