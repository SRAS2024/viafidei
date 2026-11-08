/**
 * Migration 0079 clears the sort year of saints whose records give no year of their lives,
 * which the application used to take from the canonization. It must clear only what the
 * application's own rule leaves without a year, so the worker's hygiene sweep, which
 * keeps the column in step with that rule, never puts a year back.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { derivedColumnsFor } from "@/lib/content-shared/derived-columns";

const NAME = "0079_saints_dated_by_their_lives_alone";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

/** The migration's predicate, read as the database reads it. */
function cleared(payload: Record<string, unknown>): boolean {
  const holdsDigit = (value: unknown) => typeof value === "string" && /[0-9]/.test(value);
  return !holdsDigit(payload.deathDate) && !holdsDigit(payload.birthDate);
}

const RECORDS: Array<Record<string, unknown>> = [
  { canonizationDate: "1588" },
  { canonizationDate: "29 June 1930", birthDate: "unknown" },
  { birthDate: "", deathDate: "", canonizationDate: "1729" },
  { deathDate: 1897, canonizationDate: "1925" },
  { deathDate: "1897", canonizationDate: "1925" },
  { birthDate: "c. 1170", canonizationDate: "1234" },
  { deathDate: "4th century" },
  { deathDate: "27 August", canonizationDate: "1650" },
  {},
];

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
    expect(sql).toContain(`"contentType" = 'SAINT'::"ChecklistContentType"`);
    expect(sql).toContain(`"sortYear" IS NOT NULL`);
    expect(sql).not.toMatch(/canonizationDate/);
  });

  it("clears a sort year only where the application reads none", () => {
    for (const payload of RECORDS) {
      if (cleared(payload)) {
        expect(derivedColumnsFor("SAINT", payload).sortYear, JSON.stringify(payload)).toBeNull();
      }
    }
  });

  it("keeps every year the application still reads", () => {
    expect(cleared({ deathDate: "1897", canonizationDate: "1925" })).toBe(false);
    expect(derivedColumnsFor("SAINT", { deathDate: "1897" }).sortYear).toBe(1897);
    expect(cleared({ birthDate: "c. 1170" })).toBe(false);
    expect(derivedColumnsFor("SAINT", { canonizationDate: "1588" }).sortYear).toBeNull();
  });
});
