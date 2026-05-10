#!/usr/bin/env node
/* eslint-disable */
// Account email flow database validator.
//
// Confirms that the three database pieces the welcome / verify-email /
// forgot-password / resend-verification flows depend on are actually
// present in the connected database:
//
//   1. User.emailVerifiedAt        — set when verify-email succeeds; the
//                                     /profile dashboard reads it to decide
//                                     whether to show the resend button.
//   2. PasswordResetToken (table)  — written by the forgot-password route,
//                                     consumed by the reset-password route.
//   3. EmailVerificationToken (table) — written by registration and the
//                                     resend-verification route, consumed
//                                     by the verify-email route.
//
// Run on its own to triage a deployment that is rejecting auth flows:
//
//     node scripts/validate-account-email-db.js
//
// Exit codes:
//   0 — all three pieces exist; auth flows can run.
//   1 — at least one is missing; prints a structured JSON line to stderr
//       per missing piece so the operator can run `prisma migrate deploy`
//       (or investigate a partial migration) and try again.
"use strict";

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

function emit(level, fields) {
  const line = JSON.stringify(Object.assign({ level, time: new Date().toISOString() }, fields));
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

async function tableExists(prisma, name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
    name,
  );
  return rows.length > 0;
}

async function columnExists(prisma, table, column) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    table,
    column,
  );
  return rows.length > 0;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    emit("error", {
      stage: "env",
      message: "DATABASE_URL is not set — cannot validate account email database pieces.",
    });
    process.exit(1);
  }

  const prisma = new PrismaClient({
    log: ["error"],
    datasources: { db: { url: databaseUrl } },
  });

  const missing = [];

  try {
    if (!(await tableExists(prisma, "User"))) {
      missing.push({ kind: "table", name: "User" });
      emit("error", {
        stage: "table.missing",
        table: "User",
        message: "User table missing — registration cannot run",
      });
    } else if (!(await columnExists(prisma, "User", "emailVerifiedAt"))) {
      missing.push({ kind: "column", name: "User.emailVerifiedAt" });
      emit("error", {
        stage: "column.missing",
        table: "User",
        column: "emailVerifiedAt",
        message: "User.emailVerifiedAt missing — verify-email cannot mark accounts as verified",
      });
    } else {
      emit("info", { stage: "column.ok", table: "User", column: "emailVerifiedAt" });
    }

    if (!(await tableExists(prisma, "PasswordResetToken"))) {
      missing.push({ kind: "table", name: "PasswordResetToken" });
      emit("error", {
        stage: "table.missing",
        table: "PasswordResetToken",
        message: "PasswordResetToken missing — forgot-password / reset-password will throw",
      });
    } else {
      emit("info", { stage: "table.ok", table: "PasswordResetToken" });
    }

    if (!(await tableExists(prisma, "EmailVerificationToken"))) {
      missing.push({ kind: "table", name: "EmailVerificationToken" });
      emit("error", {
        stage: "table.missing",
        table: "EmailVerificationToken",
        message: "EmailVerificationToken missing — registration / resend / verify-email will throw",
      });
    } else {
      emit("info", { stage: "table.ok", table: "EmailVerificationToken" });
    }
  } catch (err) {
    emit("error", {
      stage: "query.failed",
      message: "Could not query schema metadata.",
      error: err && err.message ? err.message : String(err),
    });
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }

  await prisma.$disconnect().catch(() => {});

  if (missing.length > 0) {
    emit("error", {
      stage: "summary",
      message:
        "account email database contract is broken — run `prisma migrate deploy` and re-run this validator",
      missing,
    });
    process.exit(1);
  }

  emit("info", {
    stage: "summary",
    message:
      "account email database contract OK: User.emailVerifiedAt + PasswordResetToken + EmailVerificationToken all present",
  });
  process.exit(0);
}

main().catch((err) => {
  emit("error", {
    stage: "unhandled",
    message: "unexpected error during account email database validation",
    error: err && err.message ? err.message : String(err),
    stack: err && err.stack ? err.stack : undefined,
  });
  process.exit(1);
});
