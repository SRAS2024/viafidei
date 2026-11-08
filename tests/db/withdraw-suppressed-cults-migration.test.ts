/**
 * Migration 0072 withdraws three published records that are cults of the blood libel. It
 * must unpublish exactly those, reject their checklist items so no pass rebuilds them,
 * and be safe to run again.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isSuppressedCult } from "@/lib/content-shared/suppressed-cults";

const NAME = "0072_withdraw_suppressed_cults";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");
const SLUGS = ["saint-simon-of-trent", "saint-werner-of-oberwesel", "saint-dominguito-del-val"];

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("rejects the checklist items and unpublishes the rows, and only these three", () => {
    const lists = [...sql.matchAll(/"slug" IN \(([^)]*)\)/g)].map((match) =>
      [...match[1]!.matchAll(/'([^']+)'/g)].map((slug) => slug[1]),
    );
    expect(lists).toEqual([SLUGS, SLUGS]);
    expect(sql).toContain(`SET "approvalStatus" = 'REJECTED'`);
    expect(sql).toContain(`SET "isPublished" = false`);
  });

  it("matches nothing a second time", () => {
    expect(sql).toContain(`WHERE "approvalStatus" <> 'REJECTED'`);
    expect(sql).toContain(`WHERE "isPublished"`);
  });

  it("names cults the import refuses too", () => {
    for (const name of ["Simon of Trent", "Werner of Oberwesel", "Dominguito del Val"]) {
      expect(isSuppressedCult(name), name).toBe(true);
    }
  });
});
