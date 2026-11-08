/**
 * Migration 0074 corrects six stored patronage lists that the import garbled. Each list it
 * writes must read on the page exactly as it is stored, with the subtitle the application
 * writes for it, and each row must change only while it still holds the garbled list the
 * live site showed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { saintPatronage, saintPatronageList } from "@/lib/content-shared/saints";

const NAME = "0074_saint_patronages_as_their_sources_list_them";
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

const TYPE_OF: Record<string, string> = {
  Saint: "other",
  Apostle: "apostle",
  Bishop: "bishop",
  Confessor: "confessor",
};
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

describe(`migration ${NAME}`, () => {
  it("is certified re-runnable and bounds its locks before anything else", () => {
    expect(raw).toContain("@idempotent-recoverable");
    expect(sql.trim()).toMatch(/^SET LOCAL lock_timeout/);
  });

  it("corrects the six saints the review named, and only while the old list stands", () => {
    expect(rows.map((row) => row.slug).sort()).toEqual([
      "saint-gabriel-of-our-lady-of-sorrows",
      "saint-joachim",
      "saint-john-the-apostle",
      "saint-mary-of-bethany",
      "saint-michael",
      "saint-willibrord",
    ]);
    expect(sql).toContain(`content."contentType" = 'SAINT'::"ChecklistContentType"`);
    expect(sql).toContain(`jsonb_typeof(content."payload"->'patronages') = 'array'`);
    expect(sql).toMatch(
      /string_agg\(item\.value, ', ' ORDER BY item\.position\)[\s\S]*\) = corrected\."oldList";/,
    );
    expect(sql).toContain(`WHEN content."subtitle" = corrected."oldSubtitle"`);
  });

  it("stores lists the page reads as they stand", () => {
    for (const { slug, newList } of rows) {
      // Nothing for the page to take off or leave out: what is stored is what is read.
      expect(saintPatronageList(newList), slug).toEqual(newList);
      for (const phrase of newList) {
        expect(phrase, slug).not.toMatch(/^(?:patron|guardian)|-victims|-dealers/i);
      }
    }
    const michael = rows.find((row) => row.slug === "saint-michael")!;
    expect(saintPatronage(michael.newList)).toMatch(/^the Church, the dying, /);
    const joachim = rows.find((row) => row.slug === "saint-joachim")!;
    expect(saintPatronage(joachim.newList)).toBe(
      "fathers; grandparents; Adjuntas, Puerto Rico; Dolores, Eastern Samar; Fasnia, Tenerife; the Carmelites; San Joaquin, Iloilo",
    );
  });

  it("keeps every word of what the site showed", () => {
    // The owner's condition: correcting a list must not take anything off the site.
    const wrappers = new Set(["guardian", "catholic", "patroness", "people"]);
    for (const { slug, oldList, newList } of rows) {
      const kept = newList.join(" ").toLowerCase();
      for (const word of oldList.toLowerCase().split(/[^\p{L}]+/u)) {
        if (word.length > 3 && !wrappers.has(word))
          expect(kept, `${slug}: ${word}`).toContain(word);
      }
    }
  });

  it("re-projects the subtitle the application writes for the new list", () => {
    for (const { slug, newList, oldSubtitle, newSubtitle } of rows) {
      const m = /^(\w+), patron of .+ · Feast (\w+) (\d+)$/.exec(oldSubtitle);
      expect(m, oldSubtitle).toBeTruthy();
      const fields = {
        saintType: TYPE_OF[m![1]!],
        canonizationStatus: "canonized",
        patronages: newList,
        feastDay: `${String(MONTHS.indexOf(m![2]!) + 1).padStart(2, "0")}-${m![3]!.padStart(2, "0")}`,
      };
      expect(newSubtitle, slug).toBe(generateContentSubtitle({ contentType: "SAINT", fields }));
    }
  });

  it("guards each row on the list the live site showed, item by item", () => {
    const willibrord = rows.find((row) => row.slug === "saint-willibrord")!;
    expect(willibrord.oldList.split(", ").filter((item) => item === "Netherlands")).toHaveLength(2);
    expect(willibrord.newList.filter((item) => /Netherlands/.test(item))).toEqual([
      "the Netherlands",
    ]);
    const mary = rows.find((row) => row.slug === "saint-mary-of-bethany")!;
    expect(mary.oldSubtitle).toContain("patron of Patroness of Spiritual Studies");
  });
});
