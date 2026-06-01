/**
 * Migrations certified "@idempotent-recoverable" must actually be idempotent.
 *
 * scripts/migrate-deploy.sh self-heals a wedged (P3009 "failed migration")
 * database by marking the failed migration rolled-back and re-running
 * `migrate deploy` — but ONLY for migrations whose migration.sql carries the
 * `@idempotent-recoverable` marker. That is safe only if re-applying the
 * migration cannot error regardless of how far the failed attempt got, i.e.
 * every statement is guarded:
 *   DROP ...            → IF EXISTS
 *   CREATE TABLE/INDEX  → IF NOT EXISTS
 *   ALTER ADD COLUMN    → IF NOT EXISTS
 *   ALTER DROP COLUMN   → IF EXISTS
 *
 * This test enforces that the marker cannot lie, so the deploy-time
 * self-heal can never re-run a migration that would throw "already exists" /
 * "does not exist" on retry.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");
const MARKER = "@idempotent-recoverable";

function migrationFiles(): Array<{ name: string; raw: string }> {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .map((name) => {
      const path = join(MIGRATIONS_DIR, name, "migration.sql");
      try {
        return { name, raw: readFileSync(path, "utf8") };
      } catch {
        return { name, raw: "" };
      }
    })
    .filter((m) => m.raw);
}

/** Strip `-- …` line comments so prose ("Drops ~30 legacy tables") and the
 *  marker comment itself are not scanned as SQL. */
function strl(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

// Each guard: a regex that should find NOTHING in an idempotent migration.
// No `g` flag on purpose — these are used only with `.test()` for a boolean,
// and the `g` flag would make `.test()` stateful (lastIndex carries between
// migrations) and silently miss violations once more than one is marked.
const FORBIDDEN: Array<{ re: RegExp; why: string }> = [
  { re: /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/i, why: "CREATE TABLE without IF NOT EXISTS" },
  {
    re: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?!IF\s+NOT\s+EXISTS\b)/i,
    why: "CREATE INDEX without IF NOT EXISTS",
  },
  { re: /\bDROP\s+TABLE\s+(?!IF\s+EXISTS\b)/i, why: "DROP TABLE without IF EXISTS" },
  {
    re: /\bDROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?!IF\s+EXISTS\b)/i,
    why: "DROP INDEX without IF EXISTS",
  },
  { re: /\bDROP\s+TYPE\s+(?!IF\s+EXISTS\b)/i, why: "DROP TYPE without IF EXISTS" },
  {
    re: /\bDROP\s+(?:MATERIALIZED\s+)?VIEW\s+(?!IF\s+EXISTS\b)/i,
    why: "DROP VIEW without IF EXISTS",
  },
  { re: /\bDROP\s+SEQUENCE\s+(?!IF\s+EXISTS\b)/i, why: "DROP SEQUENCE without IF EXISTS" },
  { re: /\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/i, why: "ADD COLUMN without IF NOT EXISTS" },
  { re: /\bDROP\s+COLUMN\s+(?!IF\s+EXISTS\b)/i, why: "DROP COLUMN without IF EXISTS" },
  // Postgres CREATE TYPE has no IF NOT EXISTS form, so it can never be part of
  // a re-runnable migration.
  { re: /\bCREATE\s+TYPE\b/i, why: "CREATE TYPE cannot be made idempotent (no IF NOT EXISTS)" },
];

function violations(sql: string): string[] {
  const body = strl(sql);
  const found: string[] = [];
  for (const { re, why } of FORBIDDEN) {
    if (re.test(body)) found.push(why);
  }
  return found;
}

const all = migrationFiles();
const marked = all.filter((m) => m.raw.includes(MARKER));

describe("@idempotent-recoverable migrations are genuinely idempotent", () => {
  it("finds migration files to scan (sanity)", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it("has at least one certified migration (the mechanism is actually used)", () => {
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.map((m) => m.name)).toContain("0025_drop_legacy_system");
  });

  // Positive/negative control: prove the detector actually fires, so the
  // per-migration assertions below can't pass vacuously (e.g. a broken regex
  // that never matches would otherwise make every migration look "guarded").
  it("the idempotency detector actually catches unguarded statements", () => {
    expect(violations('CREATE TABLE "X" ("id" TEXT);')).toContain(
      "CREATE TABLE without IF NOT EXISTS",
    );
    expect(violations('DROP TABLE "X" CASCADE;')).toContain("DROP TABLE without IF EXISTS");
    expect(violations('CREATE INDEX "i" ON "X"("id");')).toContain(
      "CREATE INDEX without IF NOT EXISTS",
    );
    expect(violations("CREATE TYPE \"E\" AS ENUM ('a');")).toContain(
      "CREATE TYPE cannot be made idempotent (no IF NOT EXISTS)",
    );
    // The guarded forms (and prose in -- comments) produce no violations.
    expect(
      violations(
        '-- Drops the legacy Prayer table\nCREATE TABLE IF NOT EXISTS "X" ("id" TEXT);\nDROP TABLE IF EXISTS "Y" CASCADE;',
      ),
    ).toEqual([]);
  });

  for (const m of marked) {
    it(`${m.name}: every statement is guarded`, () => {
      expect(violations(m.raw)).toEqual([]);
    });
  }

  it("the self-heal script only trusts the marker (guards the contract)", () => {
    const script = readFileSync(join(process.cwd(), "scripts", "migrate-deploy.sh"), "utf8");
    expect(script).toContain(MARKER);
    // It must verify the marker is present before resolving, and bound the
    // retry so it can't loop.
    expect(script).toContain("migrate resolve --rolled-back");
    expect(script).toContain("AUTO_RESOLVE_MIGRATIONS");
  });
});
