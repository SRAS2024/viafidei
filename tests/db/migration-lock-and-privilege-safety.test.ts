/**
 * Deploy-safety rules for migrations, enforced on the files themselves.
 *
 * The deploy path is load-bearing: railway.json → Dockerfile → scripts/start.sh,
 * which runs `prisma migrate deploy` and EXITS NON-ZERO on failure. A migration
 * that errors does not just fail the deploy — the same start.sh is the start
 * command for every restart, so the container cannot boot afterwards.
 *
 * Two rules follow from that, and both were violated by 0055/0056:
 *
 * 1. LOCK BOUND. `prisma migrate deploy` runs each file in ONE transaction, so
 *    an ALTER TABLE's ACCESS EXCLUSIVE is held until COMMIT — and a QUEUED
 *    exclusive lock blocks every reader that arrives behind it. Every public
 *    page reads PublishedContent. Reproduced: an ordinary
 *    `SELECT count(*) FROM "PublishedContent"` issued two seconds AFTER the
 *    ALTER queued died on its own timeout without ever conflicting with the
 *    writer. Failing fast rolls the migration back and leaves the old
 *    container serving; stalling takes the live site's reads with it.
 *
 * 2. PRIVILEGE. Migrations 0001-0054 only ever did CREATE TABLE / ALTER TABLE /
 *    CREATE INDEX / CREATE TYPE. CREATE FUNCTION, CREATE TRIGGER and CREATE
 *    INDEX are SCHEMA objects needing CREATE on schema public, which since
 *    PostgreSQL 15 is no longer granted to PUBLIC — so table ownership does not
 *    imply it. Verified against a local role with the privilege revoked: the
 *    unguarded statements failed the whole file; guarded, the file applies
 *    cleanly and the app's capability probe degrades to the ILIKE fallback.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

function migrations(): Array<{ name: string; raw: string }> {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((name) => {
      try {
        return { name, raw: readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8") };
      } catch {
        return { name, raw: "" };
      }
    })
    .filter((m) => m.raw);
}

/** Strip `-- …` line comments so prose is never scanned as SQL. */
function sqlOnly(raw: string): string {
  return raw.replace(/--[^\n]*/g, "");
}

/** Statements that take a lock long enough to matter on a live table. */
const TAKES_A_HEAVY_LOCK = /\b(ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX)\b/i;
/** Statements that need CREATE on schema public, not merely table ownership. */
const NEEDS_SCHEMA_CREATE = /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|TRIGGER)\b/i;

const NEW = ["0055_published_content_search", "0056_admin_worker_log_event_index"];

describe("migrations bound the locks they take", () => {
  for (const name of NEW) {
    it(`${name}: sets lock_timeout before anything that takes a heavy lock`, () => {
      const m = migrations().find((x) => x.name === name);
      expect(m, `${name} exists`).toBeDefined();
      const sql = sqlOnly(m!.raw);
      const lockTimeoutAt = sql.search(/SET\s+LOCAL\s+lock_timeout/i);
      expect(lockTimeoutAt, "lock_timeout is set").toBeGreaterThanOrEqual(0);
      const heavyAt = sql.search(TAKES_A_HEAVY_LOCK);
      expect(heavyAt, "the file does take a heavy lock").toBeGreaterThanOrEqual(0);
      // SET LOCAL must come FIRST: it only binds statements after it.
      expect(lockTimeoutAt).toBeLessThan(heavyAt);
    });
  }

  it("the detector would notice a migration that took a lock with no bound", () => {
    const unbounded = sqlOnly('ALTER TABLE "PublishedContent" ADD COLUMN "x" text;');
    expect(unbounded.search(/SET\s+LOCAL\s+lock_timeout/i)).toBe(-1);
    expect(unbounded.search(TAKES_A_HEAVY_LOCK)).toBeGreaterThanOrEqual(0);
  });
});

describe("migrations never let a privilege refusal fail the deploy", () => {
  it("every CREATE FUNCTION / CREATE TRIGGER is inside a guarded DO block", () => {
    for (const m of migrations()) {
      const sql = sqlOnly(m.raw);
      if (!NEEDS_SCHEMA_CREATE.test(sql)) continue;
      // The only such statements in the project live in one guarded block.
      // Backreference the dollar tag: a guarded block's body dollar-quotes its
      // own function bodies ($body$ … END $body$), so a tag-agnostic match
      // would terminate on the inner END and leave the rest "outside".
      const blocks = sql.match(/DO\s+\$([A-Za-z]*)\$[\s\S]*?END\s+\$\1\$/g) ?? [];
      const guarded = blocks.filter((b) => /EXCEPTION\s+WHEN/i.test(b)).join("\n");
      const outsideGuards = blocks.reduce((acc, b) => acc.replace(b, ""), sql);
      expect(
        NEEDS_SCHEMA_CREATE.test(outsideGuards),
        `${m.name}: CREATE FUNCTION/TRIGGER outside a guarded DO block`,
      ).toBe(false);
      expect(NEEDS_SCHEMA_CREATE.test(guarded), `${m.name}: guarded block found`).toBe(true);
    }
  });

  it("0055 degrades rather than failing, and names insufficient_privilege", () => {
    const m = migrations().find((x) => x.name === "0055_published_content_search")!;
    // Every schema-object creation in this file is guarded: the two functions,
    // the trigger, the backfill that calls them, the GIN index and the
    // trigram index.
    expect(m.raw).toContain("insufficient_privilege");
    expect(m.raw.match(/EXCEPTION/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    // The app must be able to SEE the degraded state; published.ts probes for
    // this trigger by name, so the two must not drift.
    expect(m.raw).toContain("PublishedContent_searchVector_tgr");
    const published = readFileSync(join(process.cwd(), "src/lib/data/published.ts"), "utf8");
    expect(published).toContain("PublishedContent_searchVector_tgr");
    expect(published).toContain("pg_trigger");
  });
});
