/**
 * The column that lets a password reset end other sign-ins has to arrive without signing
 * anybody out and without holding up the deploy. It is nullable, with NULL meaning "accept
 * any cookie" (see credentialsMatch in src/lib/auth/user.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "prisma", "migrations", "0067_user_credential_version", "migration.sql"),
  "utf8",
);
const body = sql.replace(/--[^\n]*/g, "");

describe("0067_user_credential_version", () => {
  it("carries the deploy's marker and a bounded wait for its lock", () => {
    expect(sql).toContain("@idempotent-recoverable");
    expect(body).toMatch(/SET LOCAL lock_timeout/);
  });

  it("adds one nullable column, and writes no row", () => {
    expect(body).toMatch(/ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credentialVersion" TEXT;/);
    expect(body).not.toMatch(/NOT NULL|DEFAULT|UPDATE|DELETE|INSERT/i);
  });

  it("matches the schema, so Prisma selects a column that exists", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const user = /model User \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    expect(user).toMatch(/credentialVersion\s+String\?/);
  });

  it("is checked at startup, because every account read selects it", () => {
    const validator = readFileSync(join(process.cwd(), "scripts", "validate-db.js"), "utf8");
    const userColumns = /User: \[([\s\S]*?)\]/.exec(validator)?.[1] ?? "";
    expect(userColumns).toContain('"credentialVersion"');
  });
});
