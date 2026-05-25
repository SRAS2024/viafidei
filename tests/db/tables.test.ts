import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { checkRequiredTables, checkSeedContent } from "@/lib/db/tables";

/**
 * Every required table the runtime touches in the current (post-legacy)
 * system. Kept in sync with `REQUIRED_TABLES` in
 * `src/lib/db/tables.ts`.
 */
const ALL_TABLES = [
  "User",
  "Session",
  "Profile",
  "PasswordResetToken",
  "EmailVerificationToken",
  "JournalEntry",
  "Goal",
  "GoalChecklistItem",
  "Milestone",
  "UserSavedContent",
  "Category",
  "Tag",
  "EntityTag",
  "MediaAsset",
  "EntityMediaLink",
  "SiteSetting",
  "HomePage",
  "HomePageBlock",
  "ChecklistItem",
  "AuthoritySource",
  "ChecklistCitation",
  "WorkerBuildJob",
  "WorkerBuildLog",
  "ChecklistQAReport",
  "ChecklistVersion",
  "ChecklistRelation",
  "PublishedContent",
  "WorkerHeartbeat",
  "ContentTypePause",
  "AdminWorkerState",
  "AdminWorkerPass",
  "AdminWorkerTask",
  "AdminWorkerLog",
  "AdminWorkerMemory",
  "AdminWorkerSourceReputation",
  "AdminWorkerDecision",
  "AdminWorkerSecurityAction",
  "CandidateSourceUrl",
  "ContentGoal",
  "HumanReviewQueue",
  "HomepageWorkerDraft",
  "AdminDeveloperReportLog",
  "PostPublishVerification",
  "ContentQualityScore",
  "HomepageQualityScore",
  "AdminAuditLog",
  "AdminActionLog",
  "AdminNotificationState",
  "RateLimitBucket",
  "SecurityEvent",
  "BannedDevice",
  "DiagnosticSnapshot",
  "ErrorLog",
];

// All columns required by REQUIRED_COLUMNS in src/lib/db/tables.ts.
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
  "checklistItemId",
  "contentType",
  "slug",
  "title",
  "payload",
  "authorityLevel",
  "isPublished",
  "publishedAt",
  "canonicalName",
  "canonicalSlug",
  "approvalStatus",
  "currentMode",
  "currentPriority",
  "paused",
  "lastHeartbeatAt",
];

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

  it("flags missing PublishedContent as a public-content gap", async () => {
    mockSchema({
      tables: ALL_TABLES.filter((t) => t !== "PublishedContent"),
    });
    const result = await checkRequiredTables();
    expect(result.ok).toBe(false);
    expect(result.publicContentMissing).toEqual(["PublishedContent"]);
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
  it("reports ok=false when PublishedContent has no rows", async () => {
    prismaMock.publishedContent.groupBy = vi.fn().mockResolvedValue([]);
    const result = await checkSeedContent();
    expect(result.ok).toBe(false);
    expect(result.counts).toEqual({});
  });

  it("reports ok=true the moment any content type has rows", async () => {
    prismaMock.publishedContent.groupBy = vi
      .fn()
      .mockResolvedValue([{ contentType: "PRAYER", _count: 5 }]);
    const result = await checkSeedContent();
    expect(result.ok).toBe(true);
    expect(result.counts.PRAYER).toBe(5);
  });
});
