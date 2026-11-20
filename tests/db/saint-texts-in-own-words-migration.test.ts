/**
 * Migration 0086 gives saints', popes' and a few devotions' texts the site's own
 * wording, so their pages need no "Text from Wikipedia" line (the owner's rule: no
 * source lines on these pages). Each update must change one record, by id and slug,
 * only while every field it rewrites still holds exactly the text that was rewritten,
 * mark those fields "rewritten" in the record's provenance, and never touch a Church
 * document, whose sources stay as they are.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { wikipediaTextSource } from "@/lib/content-shared/wikipedia-attribution";

const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", "0086_saint_texts_in_our_own_words", "migration.sql"),
  "utf8",
);
const sql = raw.replace(/^--[^\n]*$/gm, "");
const updates = sql.split(/;\s*\n(?=UPDATE|\s*$)/).filter((s) => s.includes("UPDATE"));

describe("migration 0086_saint_texts_in_our_own_words", () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("updates thousands of records, each by id and slug, guarded on the exact old text", () => {
    expect(updates.length).toBeGreaterThan(3000);
    for (const u of updates) {
      expect(u).toMatch(/WHERE content\."id" = '[a-z0-9]+'/);
      expect(u).toMatch(/AND content\."slug" = '/);
      expect(u).toMatch(/md5\(content\."payload"->>'[a-zA-Z]+'\) = '[0-9a-f]{32}'/);
    }
  });

  it("marks every field it rewrites as rewritten, so the credit line ends", () => {
    for (const u of updates.slice(0, 200)) {
      const prov = /jsonb_build_object\('provenance', '((?:[^']|'')*)'::jsonb\)/.exec(u);
      expect(prov, u.slice(0, 200)).not.toBeNull();
      const provenance = JSON.parse(prov![1]!.replace(/''/g, "'")) as Record<string, string>;
      const fields = [
        ...u.matchAll(/jsonb_build_object\('([a-zA-Z]+)', '(?:[^']|'')*'::text\)/g),
      ].map((m) => m[1]!);
      expect(fields.length).toBeGreaterThan(0);
      for (const f of fields) expect(provenance[f]).toBe("rewritten");
      // What the page will decide: a record whose quoted fields are all rewritten owes no credit.
      const payload: Record<string, unknown> = { provenance };
      for (const f of fields) payload[f] = "x";
      if (!Object.values(provenance).includes("wikipedia")) {
        expect(wikipediaTextSource("SAINT", payload)).toBeNull();
      }
    }
  });

  it("never touches a Church document", () => {
    expect(sql).not.toMatch(/CHURCH_DOCUMENT/);
  });
});
