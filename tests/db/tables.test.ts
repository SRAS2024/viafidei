import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  checkMigrationsApplied,
  checkRequiredTables,
  checkSeedContent,
  probePublicContentTables,
} from "@/lib/db/tables";

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

describe("checkMigrationsApplied", () => {
  it("returns ok=true with the count of finished, non-rolled-back migrations", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { migration_name: "0001_init", finished_at: new Date(), rolled_back_at: null },
      { migration_name: "0002_more", finished_at: new Date(), rolled_back_at: null },
      // An in-flight migration (no finished_at) is not counted as applied.
      { migration_name: "0003_pending", finished_at: null, rolled_back_at: null },
    ]);
    const result = await checkMigrationsApplied();
    expect(result).toEqual({ ok: true, appliedCount: 2 });
  });

  it("returns ok=false reason=rolled_back, naming the rolled-back migrations", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { migration_name: "0001_init", finished_at: new Date(), rolled_back_at: null },
      { migration_name: "0002_bad", finished_at: new Date(), rolled_back_at: new Date() },
    ]);
    const result = await checkMigrationsApplied();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("rolled_back");
      expect(result.detail).toContain("0002_bad");
    }
  });

  it("returns ok=false reason=table_missing when _prisma_migrations does not exist", async () => {
    prismaMock.$queryRaw.mockRejectedValue(
      new Error('relation "_prisma_migrations" does not exist'),
    );
    const result = await checkMigrationsApplied();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("table_missing");
  });

  it("returns ok=false reason=query_failed for any other error", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection reset"));
    const result = await checkMigrationsApplied();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("query_failed");
      expect(result.detail).toContain("connection reset");
    }
  });
});

describe("probePublicContentTables", () => {
  it("returns ok=true with no failures when the smoke probe succeeds", async () => {
    prismaMock.publishedContent.findFirst.mockResolvedValue({ id: "x" });
    const result = await probePublicContentTables();
    // The probe succeeded, so failures is empty and ok is true.
    expect(result).toEqual({ ok: true, failures: [] });
  });

  it("records a failure (table + error) when the probe throws", async () => {
    prismaMock.publishedContent.findFirst.mockRejectedValue(new Error("column does not exist"));
    const result = await probePublicContentTables();
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].table).toBe("PublishedContent");
    expect(result.failures[0].error).toContain("column does not exist");
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
