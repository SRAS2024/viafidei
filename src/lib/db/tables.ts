import { prisma } from "./client";

/**
 * Tables that the public site reads from for guides, prayers, saints,
 * devotions, apparitions, liturgy entries, and parishes. The health check
 * surfaces this list separately so a deploy that's missing a content table
 * is reported as `migration_required` instead of crashing the first request.
 */
export const PUBLIC_CONTENT_TABLES = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Parish",
  "Devotion",
  "LiturgyEntry",
  "SpiritualLifeGuide",
  "DailyLiturgy",
] as const;

/**
 * Every table the runtime reads or writes. Kept in sync with prisma/schema.prisma
 * and scripts/validate-db.js. Adding a model means adding it here so the
 * /api/health endpoint reports a missing table instead of a generic 500 from
 * the first request that touches it.
 */
const REQUIRED_TABLES = [
  "User",
  "Session",
  "Profile",
  "PasswordResetToken",
  "EmailVerificationToken",
  ...PUBLIC_CONTENT_TABLES,
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
] as const;

/**
 * Columns whose presence has been required by a code path at least once.
 * Reported separately from "table missing" because a partially applied
 * migration is a different operator action than "no migrations ran".
 */
const REQUIRED_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  User: [
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
  ],
  Profile: ["id", "userId", "createdAt", "updatedAt"],
  Session: ["id", "userId", "tokenHash", "expiresAt"],
  PasswordResetToken: ["id", "userId", "tokenHash", "expiresAt"],
  EmailVerificationToken: ["id", "userId", "tokenHash", "expiresAt"],
  Prayer: [
    "id",
    "slug",
    "defaultTitle",
    "body",
    "category",
    "officialPrayer",
    "externalSourceKey",
    "sourceHost",
    "status",
  ],
  Saint: ["id", "slug", "canonicalName", "biography", "patronages", "status"],
  Devotion: ["id", "slug", "title", "summary", "status"],
  MarianApparition: ["id", "slug", "title", "summary", "status"],
  LiturgyEntry: ["id", "slug", "kind", "title", "body", "status"],
  SpiritualLifeGuide: ["id", "slug", "kind", "title", "summary", "status"],
};

export type TableCheckResult = {
  ok: boolean;
  missing: string[];
  present: string[];
  publicContentMissing: string[];
  columnsMissing: Array<{ table: string; columns: string[] }>;
};

export async function checkRequiredTables(): Promise<TableCheckResult> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  `;
  const existing = new Set(rows.map((r) => r.tablename));
  const present: string[] = [];
  const missing: string[] = [];
  for (const table of REQUIRED_TABLES) {
    if (existing.has(table)) {
      present.push(table);
    } else {
      missing.push(table);
    }
  }
  const publicContentMissing = PUBLIC_CONTENT_TABLES.filter((t) => !existing.has(t));

  const columnsMissing: Array<{ table: string; columns: string[] }> = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!existing.has(table)) continue; // already reported as missing table
    const colRows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    const existingColumns = new Set(colRows.map((r) => r.column_name));
    const missingColumns = columns.filter((c) => !existingColumns.has(c));
    if (missingColumns.length > 0) {
      columnsMissing.push({ table, columns: missingColumns });
    }
  }

  return {
    ok: missing.length === 0 && columnsMissing.length === 0,
    missing,
    present,
    publicContentMissing,
    columnsMissing,
  };
}

export type MigrationCheckResult =
  | { ok: true; appliedCount: number }
  | { ok: false; reason: "table_missing" | "rolled_back" | "query_failed"; detail: string };

/**
 * Inspect Prisma's internal `_prisma_migrations` table to confirm that the
 * database has at least one applied migration and no rolled-back rows. We
 * cannot enumerate the *expected* set at runtime (the prisma/migrations
 * directory isn't shipped with the standalone build), so this is a coarse
 * health signal — the strict expected-vs-applied check happens in
 * scripts/validate-db.js at boot, where the migrations directory is present.
 */
export async function checkMigrationsApplied(): Promise<MigrationCheckResult> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `;
    const rolledBack = rows.filter((r) => r.rolled_back_at !== null);
    if (rolledBack.length > 0) {
      return {
        ok: false,
        reason: "rolled_back",
        detail: rolledBack.map((r) => r.migration_name).join(", "),
      };
    }
    const applied = rows.filter((r) => r.finished_at !== null && r.rolled_back_at === null);
    return { ok: true, appliedCount: applied.length };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "unknown";
    // pg error code 42P01 = undefined_table; if _prisma_migrations is gone
    // then `prisma migrate deploy` was never run on this database.
    if (/relation .*_prisma_migrations.* does not exist/i.test(msg)) {
      return { ok: false, reason: "table_missing", detail: msg };
    }
    return { ok: false, reason: "query_failed", detail: msg };
  }
}

export async function checkSeedContent(): Promise<{ ok: boolean; counts: Record<string, number> }> {
  const [prayers, saints, apparitions, devotions, liturgy, guides, parishes] = await Promise.all([
    prisma.prayer.count({ where: { status: "PUBLISHED" } }),
    prisma.saint.count({ where: { status: "PUBLISHED" } }),
    prisma.marianApparition.count({ where: { status: "PUBLISHED" } }),
    prisma.devotion.count({ where: { status: "PUBLISHED" } }),
    prisma.liturgyEntry.count({ where: { status: "PUBLISHED" } }),
    prisma.spiritualLifeGuide.count({ where: { status: "PUBLISHED" } }),
    prisma.parish.count({ where: { status: "PUBLISHED" } }),
  ]);
  const counts = { prayers, saints, apparitions, devotions, liturgy, guides, parishes };
  const ok = Object.values(counts).some((c) => c > 0);
  return { ok, counts };
}

/**
 * Hits one row of every public content table to prove the schema is queryable
 * end-to-end through Prisma — catches enum-cast and column-mismatch errors
 * that pure metadata checks (table list, column list) miss.
 */
export async function probePublicContentTables(): Promise<{
  ok: boolean;
  failures: Array<{ table: string; error: string }>;
}> {
  const probes: Array<[string, () => Promise<unknown>]> = [
    ["Prayer", () => prisma.prayer.findFirst({ select: { id: true } })],
    ["Saint", () => prisma.saint.findFirst({ select: { id: true } })],
    ["MarianApparition", () => prisma.marianApparition.findFirst({ select: { id: true } })],
    ["Devotion", () => prisma.devotion.findFirst({ select: { id: true } })],
    ["Parish", () => prisma.parish.findFirst({ select: { id: true } })],
    ["LiturgyEntry", () => prisma.liturgyEntry.findFirst({ select: { id: true } })],
    ["SpiritualLifeGuide", () => prisma.spiritualLifeGuide.findFirst({ select: { id: true } })],
    ["DailyLiturgy", () => prisma.dailyLiturgy.findFirst({ select: { id: true } })],
  ];

  const failures: Array<{ table: string; error: string }> = [];
  for (const [table, run] of probes) {
    try {
      await run();
    } catch (error: unknown) {
      failures.push({
        table,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return { ok: failures.length === 0, failures };
}
