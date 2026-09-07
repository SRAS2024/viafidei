/**
 * Lectionary resolver — proves the worker assembles each covered day's
 * readings deterministically, in proclamation order, with Douay-Rheims text
 * resolved from the vendored store (bible/dra.ts), and falls back (null) for
 * days not yet encoded so the caller shows the official link instead of a
 * fabricated reading.
 */

import { describe, expect, it } from "vitest";

import { resolveLiturgicalDay } from "@/lib/content-shared/liturgical-calendar";
import {
  coveredLectionaryKeys,
  resolveReadings,
  vulgatePsalmNumber,
} from "@/lib/content-shared/lectionary";

const at = (iso: string) => resolveLiturgicalDay(new Date(`${iso}T00:00:00Z`));

describe("resolveReadings", () => {
  it("assembles Easter Sunday in order with real Douay-Rheims text", () => {
    const r = resolveReadings("easter-sunday");
    expect(r).not.toBeNull();
    const kinds = r!.sections.map((s) => s.kind);
    expect(kinds).toEqual(["FIRST_READING", "PSALM", "SECOND_READING", "GOSPEL"]);

    const first = r!.sections[0];
    expect(first.citation).toBe("Acts 10:34a, 37-43");
    expect(first.body && first.body.length).toBeGreaterThan(20);
    expect(first.body).toMatch(/Peter/);

    const gospel = r!.sections[3];
    expect(gospel.citation).toBe("John 20:1-9");
    expect(gospel.body).toMatch(/Magdalen/);
  });

  it("resolves the Psalm through the Vulgate-numbering aligner (Ps 98 = DRA Ps 97)", () => {
    const psalm = resolveReadings("nativity")!.sections.find((s) => s.kind === "PSALM")!;
    expect(psalm.citation).toBe("Psalm 98:1-6");
    expect(psalm.body).toMatch(/Sing ye to the Lord/);
    expect(psalm.body).toMatch(/all the ends of the earth have seen the salvation of our God/i);
  });

  it("reports confidence as the share of readings with verified text", () => {
    // All four sections (First/Psalm/Second/Gospel) now carry verified text.
    expect(resolveReadings("pentecost")!.confidence).toBe(1);
    for (const key of coveredLectionaryKeys()) {
      expect(resolveReadings(key)!.confidence, key).toBe(1);
    }
  });

  it("returns null for a day not yet in the table (caller falls back to the link)", () => {
    expect(resolveReadings("ordinary-7-tuesday")).toBeNull();
    expect(resolveReadings("nonexistent-key")).toBeNull();
  });

  it("covers the principal fixed-reading days (Temporal + sanctoral)", () => {
    expect(coveredLectionaryKeys().sort()).toEqual(
      [
        "all-saints",
        "ash-wednesday",
        "assumption",
        "easter-sunday",
        "epiphany",
        "good-friday",
        "holy-thursday",
        "immaculate-conception",
        "mary-mother-of-god",
        "nativity",
        "pentecost",
      ].sort(),
    );
  });

  it("resolves the newly added days with real Douay-Rheims text", () => {
    expect(resolveReadings("good-friday")!.sections.find((s) => s.kind === "GOSPEL")!.body).toMatch(
      /Jesus/,
    );
    expect(resolveReadings("assumption")!.sections.find((s) => s.kind === "GOSPEL")!.body).toMatch(
      /Mary/,
    );
    expect(resolveReadings("ash-wednesday")!.sections[0].body).toMatch(/Lord/);
  });

  it("end-to-end: a civil date resolves through the calendar to its readings", () => {
    // Christmas Day → Nativity → the Prologue of John, every year.
    expect(at("2025-12-25").lectionaryKey).toBe("nativity");
    const r = resolveReadings(at("2025-12-25").lectionaryKey)!;
    expect(r.sections.find((s) => s.kind === "GOSPEL")!.body).toMatch(/Word/);
    // Easter Sunday 2026 (5 Apr) → the empty-tomb Gospel.
    expect(at("2026-04-05").lectionaryKey).toBe("easter-sunday");
    expect(resolveReadings(at("2026-04-05").lectionaryKey)!.sections[0].body).toMatch(/Peter/);
    // The Assumption (15 Aug 2025) resolves via the sanctoral overlay → the
    // Visitation Gospel with the Magnificat.
    expect(at("2025-08-15").lectionaryKey).toBe("assumption");
    expect(resolveReadings(at("2025-08-15").lectionaryKey)!.sections[3].body).toMatch(/magnif/i);
  });
});

describe("vulgatePsalmNumber (Masoretic → Douay-Rheims/Vulgate)", () => {
  it("aligns with the known merges and splits", () => {
    expect(vulgatePsalmNumber(8)).toBe(8); // identical below 9
    expect(vulgatePsalmNumber(9)).toBe(9); // 9–10 merged → 9
    expect(vulgatePsalmNumber(10)).toBe(9);
    expect(vulgatePsalmNumber(11)).toBe(10);
    expect(vulgatePsalmNumber(98)).toBe(97); // the Christmas psalm
    expect(vulgatePsalmNumber(118)).toBe(117); // the Easter psalm
    expect(vulgatePsalmNumber(115)).toBe(113); // 114–115 merged
    expect(vulgatePsalmNumber(116)).toBe(114); // split
    expect(vulgatePsalmNumber(147)).toBe(146); // split
    expect(vulgatePsalmNumber(150)).toBe(150); // identical at the end
  });
});
