#!/usr/bin/env node
/* eslint-disable */
// Production database validator. Runs after `prisma migrate deploy` and
// before `node server.js` so a deploy that ends up with a broken database
// fails fast at the container boot instead of serving 500s to real users.
//
// Verifies, in order:
//   1. The database accepts a connection.
//   2. Prisma's `_prisma_migrations` table is present and every migration in
//      ./prisma/migrations is recorded as applied (no rolled-back rows).
//   3. Every table the app reads or writes is present in the public schema.
//   4. The columns the auth flow and core content lookups depend on exist on
//      User, Profile, Session, PasswordResetToken, EmailVerificationToken,
//      Prayer, Saint, Devotion, MarianApparition, LiturgyEntry, and
//      SpiritualLifeGuide.
//   5. A representative SELECT against each public-facing content table
//      succeeds — surfaces a permission, enum-cast, or column-mismatch error
//      that pure metadata checks would miss.
//
// Exit codes:
//   0 — all checks passed; safe to start the server.
//   1 — at least one check failed; prints a JSON report to stderr and exits.
//
// The script intentionally uses @prisma/client + parameter-less queries so it
// works inside the slim Next.js standalone runtime (no `tsx`, no TS compile).
"use strict";

const fs = require("fs");
const path = require("path");

let PrismaClient;
try {
  ({ PrismaClient } = require("@prisma/client"));
} catch (err) {
  console.error(
    JSON.stringify({
      level: "error",
      stage: "load_prisma_client",
      message: "Could not require @prisma/client — is the build incomplete?",
      error: err && err.message ? err.message : String(err),
    }),
  );
  process.exit(1);
}

// Tables the app touches at runtime. Missing any of these means a public
// page or the auth flow will throw.
const REQUIRED_TABLES = [
  "User",
  "Session",
  "Profile",
  "PasswordResetToken",
  "EmailVerificationToken",
  "JournalEntry",
  "Goal",
  "GoalChecklistItem",
  "Milestone",
  "Prayer",
  "PrayerTranslation",
  "Saint",
  "SaintTranslation",
  "MarianApparition",
  "MarianApparitionTranslation",
  "Parish",
  "Devotion",
  "DevotionTranslation",
  "LiturgyEntry",
  "LiturgyEntryTranslation",
  "SpiritualLifeGuide",
  "SpiritualLifeGuideTranslation",
  "DailyLiturgy",
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

// Columns whose absence we have actually seen cause production 500s. Pinning
// them explicitly turns "missing column" into a startup failure with a clear
// message instead of an opaque Prisma error mid-request.
const REQUIRED_COLUMNS = {
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
  Session: ["id", "userId", "tokenHash", "expiresAt", "createdAt", "updatedAt"],
  PasswordResetToken: ["id", "userId", "tokenHash", "expiresAt", "createdAt", "updatedAt"],
  EmailVerificationToken: [
    "id",
    "userId",
    "tokenHash",
    "expiresAt",
    "createdAt",
    "updatedAt",
  ],
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
    "createdAt",
    "updatedAt",
  ],
  Saint: [
    "id",
    "slug",
    "canonicalName",
    "biography",
    "patronages",
    "status",
    "externalSourceKey",
  ],
  Devotion: ["id", "slug", "title", "summary", "status", "externalSourceKey"],
  MarianApparition: ["id", "slug", "title", "summary", "status"],
  LiturgyEntry: ["id", "slug", "kind", "title", "body", "status"],
  SpiritualLifeGuide: ["id", "slug", "kind", "title", "summary", "status"],
};

// Tables whose readability is required by the public site. We hit each one
// with a count() so a missing enum value or a permissions issue (not just a
// missing column) bubbles up at boot.
const PUBLIC_CONTENT_PROBES = [
  ["Prayer", "prayer"],
  ["Saint", "saint"],
  ["MarianApparition", "marianApparition"],
  ["Devotion", "devotion"],
  ["Parish", "parish"],
  ["LiturgyEntry", "liturgyEntry"],
  ["SpiritualLifeGuide", "spiritualLifeGuide"],
  ["DailyLiturgy", "dailyLiturgy"],
];

function listMigrationDirs() {
  const dir = path.resolve(__dirname, "..", "prisma", "migrations");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(dir.toString(), entry.name, "migration.sql")))
    .map((entry) => entry.name)
    .sort();
}

function emit(level, fields) {
  const line = JSON.stringify(Object.assign({ level, time: new Date().toISOString() }, fields));
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

async function withTimeout(promise, ms, label) {
  let handle;
  const timeout = new Promise((_, reject) => {
    handle = setTimeout(() => reject(new Error(`${label}: timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(handle);
  }
}

async function checkConnection(prisma) {
  await withTimeout(prisma.$queryRaw`SELECT 1`, 5000, "db_connection");
}

async function fetchAppliedMigrations(prisma) {
  // _prisma_migrations is created by `prisma migrate deploy`. If it doesn't
  // exist, migrations never ran here.
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name, finished_at, rolled_back_at
         FROM "_prisma_migrations"`,
    );
    return rows;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    throw new Error(`could not read _prisma_migrations: ${msg}`);
  }
}

async function fetchPublicTables(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  return new Set(rows.map((r) => r.tablename));
}

async function fetchColumns(prisma, table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    table,
  );
  return new Set(rows.map((r) => r.column_name));
}

async function probePublicContent(prisma) {
  const failures = [];
  for (const [table, accessor] of PUBLIC_CONTENT_PROBES) {
    try {
      // findFirst is cheaper than count() and still proves the schema is
      // queryable end-to-end through the Prisma client.
      await prisma[accessor].findFirst({ select: { id: true } });
    } catch (err) {
      failures.push({
        table,
        error: err && err.message ? err.message : String(err),
      });
    }
  }
  return failures;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    emit("error", {
      stage: "env",
      message: "DATABASE_URL is not set — cannot validate database before server start.",
    });
    process.exit(1);
  }

  const prisma = new PrismaClient({
    log: ["error"],
    datasources: { db: { url: databaseUrl } },
  });

  const failures = [];

  try {
    emit("info", { stage: "connection.start", message: "checking database connection" });
    await checkConnection(prisma);
    emit("info", { stage: "connection.ok" });
  } catch (err) {
    failures.push({
      stage: "connection",
      error: err && err.message ? err.message : String(err),
    });
    emit("error", { stage: "connection.failed", error: err && err.message });
    // No point continuing — every other check would just time out.
    await prisma.$disconnect().catch(() => {});
    emit("error", { stage: "summary", failures });
    process.exit(1);
  }

  // 1. migrations
  try {
    const expected = listMigrationDirs();
    const applied = await fetchAppliedMigrations(prisma);
    const appliedNames = new Set(
      applied.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name),
    );
    const missing = expected.filter((name) => !appliedNames.has(name));
    const rolledBack = applied
      .filter((row) => row.rolled_back_at)
      .map((row) => row.migration_name);
    if (missing.length > 0 || rolledBack.length > 0) {
      failures.push({ stage: "migrations", missing, rolledBack });
      emit("error", { stage: "migrations.missing", missing, rolledBack });
    } else {
      emit("info", {
        stage: "migrations.ok",
        applied: appliedNames.size,
        expected: expected.length,
      });
    }
  } catch (err) {
    failures.push({
      stage: "migrations",
      error: err && err.message ? err.message : String(err),
    });
    emit("error", { stage: "migrations.failed", error: err && err.message });
  }

  // 2. tables
  let existingTables = new Set();
  try {
    existingTables = await fetchPublicTables(prisma);
    const missing = REQUIRED_TABLES.filter((t) => !existingTables.has(t));
    if (missing.length > 0) {
      failures.push({ stage: "tables", missing });
      emit("error", { stage: "tables.missing", missing });
    } else {
      emit("info", { stage: "tables.ok", count: REQUIRED_TABLES.length });
    }
  } catch (err) {
    failures.push({
      stage: "tables",
      error: err && err.message ? err.message : String(err),
    });
    emit("error", { stage: "tables.failed", error: err && err.message });
  }

  // 3. columns — only check tables we actually found, otherwise the noise
  // duplicates the table-missing failure.
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!existingTables.has(table)) continue;
    try {
      const existing = await fetchColumns(prisma, table);
      const missing = columns.filter((c) => !existing.has(c));
      if (missing.length > 0) {
        failures.push({ stage: "columns", table, missing });
        emit("error", { stage: "columns.missing", table, missing });
      }
    } catch (err) {
      failures.push({
        stage: "columns",
        table,
        error: err && err.message ? err.message : String(err),
      });
      emit("error", {
        stage: "columns.failed",
        table,
        error: err && err.message,
      });
    }
  }

  // 4. content probes — only run if every required content table is present.
  const contentProbeTables = PUBLIC_CONTENT_PROBES.map(([t]) => t);
  const contentTablesMissing = contentProbeTables.filter((t) => !existingTables.has(t));
  if (contentTablesMissing.length === 0) {
    const probeFailures = await probePublicContent(prisma);
    if (probeFailures.length > 0) {
      failures.push({ stage: "content_probe", failures: probeFailures });
      emit("error", { stage: "content_probe.failed", failures: probeFailures });
    } else {
      emit("info", { stage: "content_probe.ok", count: contentProbeTables.length });
    }
  } else {
    emit("warn", {
      stage: "content_probe.skipped",
      reason: "content tables missing",
      tables: contentTablesMissing,
    });
  }

  await prisma.$disconnect().catch(() => {});

  if (failures.length > 0) {
    emit("error", {
      stage: "summary",
      message: "database validation failed — refusing to start server",
      failures,
    });
    process.exit(1);
  }

  emit("info", { stage: "summary", message: "database validation passed" });
  process.exit(0);
}

main().catch((err) => {
  emit("error", {
    stage: "unhandled",
    message: "unexpected error during database validation",
    error: err && err.message ? err.message : String(err),
    stack: err && err.stack ? err.stack : undefined,
  });
  process.exit(1);
});
