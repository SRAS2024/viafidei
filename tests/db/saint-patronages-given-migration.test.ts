/**
 * Migration 0081 gives Saint Carlo Acutis and Saint Pier Giorgio Frassati their patronages
 * and sets two run-together lists right. Each list it writes must read on the page exactly
 * as it is stored, with the subtitle the application writes for it, and each row must
 * change only while it still holds what the live site showed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { saintPatronageList } from "@/lib/content-shared/saints";

const NAME = "0081_saint_patronages_the_church_gives_them";
const raw = readFileSync(
  join(process.cwd(), "prisma", "migrations", NAME, "migration.sql"),
  "utf8",
);
const sql = raw.replace(/--[^\n]*/g, "");

const LITERAL = "'(?:[^']|'')*'";
const unquote = (literal: string) => literal.slice(1, -1).replace(/''/g, "'");
const rows = [
  ...sql.matchAll(
    new RegExp(
      `\\((${LITERAL}),\\s*(${LITERAL}),\\s*(${LITERAL})::jsonb,\\s*(${LITERAL}),\\s*(${LITERAL})\\)`,
      "g",
    ),
  ),
].map((match) => ({
  slug: unquote(match[1]!),
  oldList: unquote(match[2]!),
  newList: JSON.parse(unquote(match[3]!)) as string[],
  oldSubtitle: unquote(match[4]!),
  newSubtitle: unquote(match[5]!),
}));

/** The stored fields behind each live subtitle (type, feast), as the live site showed them. */
const STORED: Record<string, { saintType: string; feastDay: string }> = {
  "saint-carlo-acutis": { saintType: "other", feastDay: "10-12" },
  "saint-pier-giorgio-frassati": { saintType: "confessor", feastDay: "07-04" },
  "saint-lorcan-ua-tuathail": { saintType: "bishop", feastDay: "11-14" },
  "saint-albertus-magnus": { saintType: "bishop", feastDay: "11-15" },
};

function subtitleFor(slug: string, patronages: string[]): string {
  return generateContentSubtitle({
    contentType: "SAINT",
    fields: { ...STORED[slug], canonizationStatus: "canonized", patronages },
  });
}

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("touches only the four saints, and only while the old list stands", () => {
    expect(rows.map((row) => row.slug).sort()).toEqual(Object.keys(STORED).sort());
    expect(sql).toContain(`content."contentType" = 'SAINT'::"ChecklistContentType"`);
    expect(sql).toMatch(/END = corrected\."oldList";\s*$/);
    expect(sql).toContain(`WHEN content."subtitle" = corrected."oldSubtitle"`);
  });

  it("guards on what the live site showed, and the subtitle the application wrote for it", () => {
    for (const { slug, oldList, oldSubtitle } of rows) {
      const old = oldList ? oldList.split(", ") : [];
      // Albert's four entries were separate; Laurence's two ran together as one.
      expect(oldSubtitle, slug).toBe(subtitleFor(slug, old));
    }
    expect(rows.find((row) => row.slug === "saint-carlo-acutis")!.oldList).toBe("");
    expect(rows.find((row) => row.slug === "saint-pier-giorgio-frassati")!.oldList).toBe("");
  });

  it("stores lists the page reads as they stand", () => {
    for (const { slug, newList } of rows) {
      expect(saintPatronageList(newList), slug).toEqual(newList);
      for (const phrase of newList) expect(phrase, slug).not.toMatch(/^(?:Those|Head)\b|\.\s/);
    }
  });

  it("re-projects the subtitle the application writes for the new list", () => {
    for (const { slug, newList, newSubtitle } of rows) {
      expect(newSubtitle, slug).toBe(subtitleFor(slug, newList));
    }
  });

  it("keeps every word of a list it sets right", () => {
    // The owner's condition: correcting a list must not take anything off the site.
    for (const { slug, oldList, newList } of rows) {
      const kept = newList.join(" ").toLowerCase();
      for (const word of oldList.toLowerCase().split(/[^\p{L}]+/u)) {
        // "injury" is kept as "injuries": compare the stem.
        if (word.length > 3) expect(kept, `${slug}: ${word}`).toContain(word.slice(0, 5));
      }
    }
  });

  it("leaves out the popular patronage no act of the Holy See names", () => {
    const carlo = rows.find((row) => row.slug === "saint-carlo-acutis")!;
    expect(carlo.newList).toEqual(["young people", "computer programmers"]);
    expect(carlo.newList.join(" ")).not.toMatch(/internet/i);
  });
});
