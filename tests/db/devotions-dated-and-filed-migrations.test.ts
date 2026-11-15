/**
 * Migrations 0083 and 0084 correct two devotions in place: the First Saturdays' dates
 * (13 July 1917 at Fátima, 10 December 1925 at Pontevedra) and the Chaste Heart of
 * Joseph's type. What they store must be what the import now writes, every other word
 * must stay, and each row must change only while it still holds the old value.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { classifyDevotionType, leadText } from "@/lib/admin-worker/structured/ingestors";
import { subtypeOf } from "@/lib/content-shared/derived-columns";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

function migration(name: string) {
  const raw = readFileSync(
    join(process.cwd(), "prisma", "migrations", name, "migration.sql"),
    "utf8",
  );
  return { raw, sql: raw.replace(/--[^\n]*/g, "") };
}

const LITERAL = /'((?:[^']|'')*)'/g;
const unquote = (literal: string) => literal.replace(/''/g, "'");

/** The text the live page showed (etviafidei.com, 14 November 2026). */
const LIVE_TEXT =
  "The First Saturdays Devotion, also called the Communion of Reparation to the Immaculate Heart of Mary, is a Catholic devotion which, according to Lúcia dos Santos, was requested by the Virgin Mary during the apparitions of Our Lady of Fátima in Fátima, Portugal, on 13 May 1917, as well as during apparitions in Pontevedra, Spain, on 10 December 1925 and 15 February 1926.";

describe("migration 0083_the_first_saturdays_as_fatima_and_pontevedra_tell_them", () => {
  const { raw, sql } = migration("0083_the_first_saturdays_as_fatima_and_pontevedra_tell_them");
  const values = sql.slice(sql.indexOf("AS (VALUES ("), sql.indexOf("))\nUPDATE"));
  const [oldClause, newClause, oldSummary, newSummary] = [...values.matchAll(LITERAL)].map((m) =>
    unquote(m[1]!),
  );

  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
    expect(sql).toContain(`content."contentType" = 'DEVOTION'::"ChecklistContentType"`);
    expect(sql).toContain(`content."slug" = 'first-saturday-devotions'`);
  });

  it("guards on the words the live page showed, and the summary the import cut from them", () => {
    expect(LIVE_TEXT).toContain(oldClause);
    // The old import cut at 280 characters, in the middle of "as".
    expect(oldSummary).toBe(LIVE_TEXT.slice(0, 280));
    expect(oldSummary.endsWith("1917, a")).toBe(true);
  });

  it("dates the request as Fátima and Pontevedra do, and keeps every other word", () => {
    const corrected = LIVE_TEXT.replace(oldClause!, newClause!);
    expect(corrected).toContain("on 13 July 1917");
    expect(corrected).toContain("in Pontevedra, Spain, on 10 December 1925");
    expect(corrected).toContain("on 15 February 1926 the Child Jesus");
    expect(corrected).not.toContain("13 May");
    // Only the clause moves: what comes before it is the record's own.
    expect(corrected.slice(0, LIVE_TEXT.indexOf(oldClause!))).toBe(
      LIVE_TEXT.slice(0, LIVE_TEXT.indexOf(oldClause!)),
    );
  });

  it("stores the summary the import now cuts, on a whole word", () => {
    const corrected = LIVE_TEXT.replace(oldClause!, newClause!);
    expect(newSummary).toBe(leadText(corrected, 280));
    expect(newSummary!.endsWith("…")).toBe(true);
    expect(corrected.startsWith(newSummary!.slice(0, -1))).toBe(true);
  });
});

describe("migration 0084_the_chaste_heart_of_joseph_filed_with_the_saints", () => {
  const { raw, sql } = migration("0084_the_chaste_heart_of_joseph_filed_with_the_saints");

  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
    expect(sql).toContain(`content."slug" = 'chaste-heart-of-joseph'`);
    expect(sql).toContain(`content."payload"->>'devotionType' = 'Marian devotion';`);
  });

  it("stores the type the import now gives it, and the filter column that reads it", () => {
    const type = classifyDevotionType(
      "Chaste Heart of Joseph Marian devotion The Most Chaste Heart of Joseph is a Catholic devotion which venerates Saint Joseph as the chaste guardian of the Blessed Virgin Mary.",
      "Chaste Heart of Joseph",
    );
    expect(sql).toContain(`'{devotionType}', '"${type}"'::jsonb`);
    expect(subtypeOf("DEVOTION", { devotionType: type })).toBe(type);
    expect(sql).toContain(`WHEN content."subtype" = 'Marian devotion' THEN '${type}'`);
    // The subtitle names no type for either value, so it does not move.
    for (const devotionType of ["Marian devotion", type]) {
      expect(generateContentSubtitle({ contentType: "DEVOTION", fields: { devotionType } })).toBe(
        "A devotion of the Catholic faithful",
      );
    }
  });
});
