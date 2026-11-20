/**
 * Migration 0085 says where the Five First Saturdays were requested: announced at Fátima on
 * 13 July 1917, asked for at Pontevedra on 10 December 1925. What it stores must be what the
 * curated file now says, and each field must change only while it still holds the old words.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raw = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "0085_five_first_saturdays_requested_at_pontevedra",
    "migration.sql",
  ),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");
const curated = readFileSync(
  join(process.cwd(), "src", "lib", "checklist", "knowledge", "devotions.ts"),
  "utf8",
);
const [oldSummary, newSummary, oldBackground, newBackground] = [
  ...sql
    .slice(sql.indexOf("AS (VALUES ("), sql.indexOf("))\nUPDATE"))
    .matchAll(/'((?:[^']|'')*)'/g),
].map((m) => m[1]!.replace(/''/g, "'"));

describe("migration 0085_five_first_saturdays_requested_at_pontevedra", () => {
  it("is certified re-runnable and bounds its locks first", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("stores exactly what the curated file now says", () => {
    expect(curated).toContain(JSON.stringify(newSummary));
    expect(curated).toContain(JSON.stringify(newBackground));
    expect(curated).not.toContain(JSON.stringify(oldSummary));
    expect(curated).not.toContain(JSON.stringify(oldBackground));
  });

  it("dates the announcement at Fátima and the request at Pontevedra, keeping every other word", () => {
    expect(newBackground).toContain("At Fatima, on 13 July 1917");
    expect(newBackground).toContain("at Pontevedra, on 10 December 1925");
    expect(newBackground).toContain(
      "promising her assistance at the hour of death to those who fulfill the devotion.",
    );
    expect(newSummary).toContain("announced at Fatima and requested at Pontevedra");
  });

  it("changes a field only while it holds the old words, on that one devotion", () => {
    expect(sql).toContain("content.\"slug\" = 'five-first-saturdays'");
    expect(sql).toContain('WHEN content."payload"->>\'summary\' = corrected."oldSummary"');
    expect(sql).toContain('WHEN content."payload"->>\'background\' = corrected."oldBackground"');
  });
});
