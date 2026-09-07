/**
 * Lectionary resolver (the TEXT layer over the committed Lectionary tables).
 *
 * Proves that a liturgical day resolves to its real formulary in proclamation
 * order with Douay-Rheims text, that the cycles are honoured (a Sunday's Year
 * A/B/C readings and an Ordinary-Time weekday's Year I/II first reading), that
 * the Lectionary's "or" alternatives are all resolved rather than silently
 * dropped, that partial-verse citations are FLAGGED rather than passed off as
 * exact, and that an unknown day resolves to null so the caller falls back to
 * the official link instead of a fabricated reading.
 *
 * The hand-encoded seed table this module used to carry lives on here as a
 * FIXTURE: the generated tables must still agree with it on which book each of
 * the principal days' readings comes from.
 */

import { describe, expect, it } from "vitest";

import { resolveLiturgicalDay } from "@/lib/content-shared/liturgical-calendar";
import {
  clearReadingsMemo,
  coveredLectionaryKeys,
  LECTIONARY_ATTRIBUTION,
  resolveAlternative,
  resolveLectionarySection,
  resolveReadings,
  splitAlternatives,
  toStoredSections,
} from "@/lib/content-shared/lectionary";
import type { LectionarySection } from "@/lib/content-shared/lectionary/index";

const at = (iso: string) => resolveLiturgicalDay(new Date(`${iso}T00:00:00Z`));

/** Resolve a civil date the way the page does: key + both cycles. */
function readingsOn(iso: string, variant?: string) {
  const day = at(iso);
  return resolveReadings(day.lectionaryKey, {
    sundayCycle: day.sundayCycle,
    weekdayCycle: day.weekdayCycle,
    ...(variant ? { variant } : {}),
  });
}

describe("resolveReadings", () => {
  it("assembles Christmas Day in proclamation order with real Douay-Rheims text", () => {
    const r = readingsOn("2025-12-25");
    expect(r).not.toBeNull();
    expect(r!.number).toBe("16");
    expect(r!.sections.map((s) => s.kind)).toEqual([
      "FIRST_READING",
      "PSALM",
      "SECOND_READING",
      "GOSPEL",
    ]);
    expect(r!.sections.map((s) => s.label)).toEqual([
      "First Reading",
      "Responsorial Psalm",
      "Second Reading",
      "Gospel",
    ]);
    const gospel = r!.sections[3];
    expect(gospel.citation).toBe("Jn 1:1-18 or Jn 1:1-5, 9-14");
    expect(gospel.body).toMatch(/Word/);
  });

  it("resolves the Psalm through the Vulgate-numbering aligner (Ps 98 = DRA Ps 97)", () => {
    const psalm = readingsOn("2025-12-25")!.sections.find((s) => s.kind === "PSALM")!;
    expect(psalm.citation).toMatch(/^Ps 98:/);
    expect(psalm.body).toMatch(/Sing ye to the Lord/i);
    expect(psalm.douayCitation).toContain("Vulgate numbering");
    expect(psalm.note).toMatch(/Vulgate/);
  });

  it("honours the Sunday cycle: Pentecost's Second Reading and Gospel differ by year", () => {
    const a = resolveReadings("pentecost", { sundayCycle: "A" })!;
    const b = resolveReadings("pentecost", { sundayCycle: "B" })!;
    const c = resolveReadings("pentecost", { sundayCycle: "C" })!;
    const second = (r: typeof a) => r.sections.find((s) => s.kind === "SECOND_READING")!.citation;
    expect(second(a)).toBe("1 Cor 12:3b-7, 12-13");
    expect(second(b)).toBe("Gal 5:16-25");
    expect(second(c)).toBe("Rom 8:8-17");
    // One section per kind — the other cycles' readings must not leak through.
    expect(a.sections.filter((s) => s.kind === "GOSPEL")).toHaveLength(1);
    expect(a.sections.find((s) => s.kind === "GOSPEL")!.citation).toBe("Jn 20:19-23");
  });

  it("honours the weekday cycle: an Ordinary-Time weekday's First Reading differs I vs II", () => {
    const one = resolveReadings("ordinary-7-tuesday", { weekdayCycle: "I" })!;
    const two = resolveReadings("ordinary-7-tuesday", { weekdayCycle: "II" })!;
    const first = (r: typeof one) => r.sections.find((s) => s.kind === "FIRST_READING")!.citation;
    expect(first(one)).not.toBe(first(two));
    // The Gospel of an Ordinary-Time weekday is the same in both years.
    const gospel = (r: typeof one) => r.sections.find((s) => s.kind === "GOSPEL")!.citation;
    expect(gospel(one)).toBe(gospel(two));
  });

  it("resolves EVERY 'or' alternative the Lectionary offers, primary first", () => {
    const gospel = readingsOn("2025-12-25")!.sections.find((s) => s.kind === "GOSPEL")!;
    expect(gospel.alternatives.map((a) => a.citation)).toEqual(["Jn 1:1-18", "Jn 1:1-5, 9-14"]);
    expect(gospel.alternatives[0].body).toBe(gospel.body);
    expect(gospel.alternatives[1].body).toMatch(/Word/);
    // The shorter form really is shorter — the two are not the same text.
    expect(gospel.alternatives[1].body!.length).toBeLessThan(gospel.alternatives[0].body!.length);
  });

  it("flags partial-verse citations instead of implying an exact pericope", () => {
    const first = readingsOn("2026-04-05")!.sections.find((s) => s.kind === "FIRST_READING")!;
    expect(first.citation).toBe("Acts 10:34a, 37-43"); // "34a" — part of a verse
    expect(first.partialVerses).toBe(true);
    expect(first.note).toMatch(/whole Douay-Rheims verse is shown/i);
    // A citation with no letter suffix is not flagged.
    expect(resolveAlternative("Jn 20:1-9").partialVerses).toBe(false);
  });

  it("returns null for a key the tables do not cover (caller falls back to the link)", () => {
    expect(resolveReadings("nonexistent-key")).toBeNull();
    // A real key with a Mass formulary it does not have is also null, never a
    // silent substitution of the principal Mass.
    expect(resolveReadings("nativity", { variant: "not-a-mass" })).toBeNull();
  });

  it("offers the day's other Mass formularies (Christmas vigil / night / dawn / day)", () => {
    const day = readingsOn("2025-12-25")!;
    expect(day.variant).toBe("day");
    const variants = day.masses.map((m) => m.variant);
    expect(variants[0]).toBe("day"); // principal Mass first
    expect(variants).toEqual(expect.arrayContaining(["vigil", "night", "dawn", "day"]));
    const night = readingsOn("2025-12-25", "night")!;
    expect(night.number).not.toBe(day.number);
    expect(night.sections.find((s) => s.kind === "GOSPEL")!.citation).toMatch(/^Lk 2:/);
  });

  it("reports confidence as the share of sections with verified text", () => {
    const r = readingsOn("2025-12-25")!;
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    for (const s of r.sections) {
      // Every section always carries its citation, text or not.
      expect(s.citation.length).toBeGreaterThan(2);
    }
  });

  it("is memoised per (key, cycles, variant) and returns the same result after a clear", () => {
    const a = resolveReadings("pentecost", { sundayCycle: "B" });
    const b = resolveReadings("pentecost", { sundayCycle: "B" });
    expect(b).toBe(a); // identical object — served from the memo
    clearReadingsMemo();
    const c = resolveReadings("pentecost", { sundayCycle: "B" });
    expect(c).not.toBe(a);
    expect(c).toEqual(a);
  });

  it("stores a compact section shape (no alternatives / notes persisted)", () => {
    const stored = toStoredSections(readingsOn("2025-12-25")!.sections);
    expect(Object.keys(stored[0]).sort()).toEqual(["body", "citation", "kind", "label"]);
  });

  it("carries the credit lines the tables must be published with", () => {
    expect(LECTIONARY_ATTRIBUTION.map((a) => a.source)).toEqual(["usccb", "catholic-resources"]);
    expect(LECTIONARY_ATTRIBUTION[1].note).toBe(
      "Material provided by Rev. Felix Just, S.J., at http://catholic-resources.org",
    );
  });
});

describe("splitAlternatives / resolveLectionarySection", () => {
  it("splits on ' or ' only, keeping each alternative self-contained", () => {
    expect(splitAlternatives("Col 3:1-4 or 1 Cor 5:6b-8")).toEqual(["Col 3:1-4", "1 Cor 5:6b-8"]);
    expect(splitAlternatives("Jn 20:1-9")).toEqual(["Jn 20:1-9"]);
  });

  it("resolves a psalm's response verse when the table supplies one", () => {
    // The generated tables do not yet carry response verses; the resolver reads
    // one defensively so the page gains it the moment the build emits it.
    const section = {
      kind: "PSALM",
      cycle: null,
      citation: "Ps 118:1-2, 16-17, 22-23",
      source: "usccb",
      response: "Ps 118:24",
    } as LectionarySection;
    const resolved = resolveLectionarySection(section);
    expect(resolved.response).not.toBeNull();
    expect(resolved.response!.citation).toBe("Ps 118:24");
    expect(resolved.response!.body).toMatch(/day which the Lord hath made/i);
    expect(resolveLectionarySection({ ...section, response: undefined }).response).toBeNull();
  });
});

/**
 * FIXTURE — the hand-encoded seed table that preceded the generated tables.
 * Each citation was verified by hand against the USCCB; the generated tables
 * must agree with it on the BOOK of every reading of these principal days
 * (the exact verse selection is the Lectionary's and is finer-grained here).
 */
const SEED_FIXTURE: Record<string, Partial<Record<string, string>>> = {
  nativity: {
    FIRST_READING: "Isaiah 52:7-10",
    PSALM: "Psalm 98:1-6",
    SECOND_READING: "Hebrews 1:1-6",
    GOSPEL: "John 1:1-18",
  },
  epiphany: {
    FIRST_READING: "Isaiah 60:1-6",
    PSALM: "Psalm 72:1-2, 7-8, 10-13",
    SECOND_READING: "Ephesians 3:2-3a, 5-6",
    GOSPEL: "Matthew 2:1-12",
  },
  "easter-sunday": {
    FIRST_READING: "Acts 10:34a, 37-43",
    PSALM: "Psalm 118:1-2, 16-17, 22-23",
    SECOND_READING: "Colossians 3:1-4",
    GOSPEL: "John 20:1-9",
  },
  pentecost: {
    FIRST_READING: "Acts 2:1-11",
    PSALM: "Psalm 104:1, 24, 29-31, 34",
    SECOND_READING: "1 Corinthians 12:3b-7, 12-13",
    GOSPEL: "John 20:19-23",
  },
  "ash-wednesday": {
    FIRST_READING: "Joel 2:12-18",
    PSALM: "Psalm 51:3-6, 12-14, 17",
    SECOND_READING: "2 Corinthians 5:20—6:2",
    GOSPEL: "Matthew 6:1-6, 16-18",
  },
  "holy-thursday": {
    FIRST_READING: "Exodus 12:1-8, 11-14",
    PSALM: "Psalm 116:12-13, 15-18",
    SECOND_READING: "1 Corinthians 11:23-26",
    GOSPEL: "John 13:1-15",
  },
  "good-friday": {
    FIRST_READING: "Isaiah 52:13—53:12",
    PSALM: "Psalm 31:2, 6, 12-13, 15-17, 25",
    SECOND_READING: "Hebrews 4:14-16; 5:7-9",
    GOSPEL: "John 18:1—19:42",
  },
  "mary-mother-of-god": {
    FIRST_READING: "Numbers 6:22-27",
    PSALM: "Psalm 67:2-3, 5-6, 8",
    SECOND_READING: "Galatians 4:4-7",
    GOSPEL: "Luke 2:16-21",
  },
  assumption: {
    FIRST_READING: "Revelation 11:19a; 12:1-6a, 10ab",
    PSALM: "Psalm 45:10-12, 16",
    SECOND_READING: "1 Corinthians 15:20-27",
    GOSPEL: "Luke 1:39-56",
  },
  "all-saints": {
    FIRST_READING: "Revelation 7:2-4, 9-14",
    PSALM: "Psalm 24:1-6",
    SECOND_READING: "1 John 3:1-3",
    GOSPEL: "Matthew 5:1-12a",
  },
  "immaculate-conception": {
    FIRST_READING: "Genesis 3:9-15, 20",
    PSALM: "Psalm 98:1-4",
    SECOND_READING: "Ephesians 1:3-6, 11-12",
    GOSPEL: "Luke 1:26-38",
  },
};

/** Book part of a citation ("1 Cor 12:3b-7" → "1 Cor"; "Psalm 98:1-6" → "Psalm"). */
function bookOf(citation: string): string {
  return citation
    .split(/\s+\d+:/)[0]
    .split(/\s+\d+\s*$/)[0]
    .trim();
}

const BOOK_ALIASES: Record<string, string> = {
  Isaiah: "Is",
  Psalm: "Ps",
  Hebrews: "Heb",
  John: "Jn",
  Ephesians: "Eph",
  Matthew: "Mt",
  Acts: "Acts",
  Colossians: "Col",
  Joel: "Jl",
  Exodus: "Ex",
  Numbers: "Nm",
  Galatians: "Gal",
  Revelation: "Rv",
  Genesis: "Gn",
  Luke: "Lk",
  "1 Corinthians": "1 Cor",
  "2 Corinthians": "2 Cor",
  "1 John": "1 Jn",
};

describe("the generated tables agree with the hand-verified seed table", () => {
  for (const [key, expected] of Object.entries(SEED_FIXTURE)) {
    it(`${key}: every reading comes from the same book`, () => {
      const r = resolveReadings(key, { sundayCycle: "A" });
      expect(r, key).not.toBeNull();
      for (const [kind, seedCitation] of Object.entries(expected)) {
        const section = r!.sections.find((s) => s.kind === kind);
        expect(section, `${key} ${kind}`).toBeTruthy();
        const seedBook = bookOf(seedCitation!);
        expect(bookOf(section!.alternatives[0].citation), `${key} ${kind}`).toBe(
          BOOK_ALIASES[seedBook] ?? seedBook,
        );
      }
    });
  }

  it("covers far more days than the seed table's eleven", () => {
    expect(coveredLectionaryKeys().length).toBeGreaterThan(400);
    for (const key of Object.keys(SEED_FIXTURE)) {
      expect(coveredLectionaryKeys(), key).toContain(key);
    }
  });
});

describe("end-to-end: a civil date resolves through the calendar to its readings", () => {
  it("covers every day of a full liturgical year with citations", () => {
    let missing = 0;
    let withText = 0;
    let total = 0;
    for (let i = 0; i < 366; i++) {
      const date = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000);
      const day = resolveLiturgicalDay(date);
      const r = resolveReadings(day.lectionaryKey, {
        sundayCycle: day.sundayCycle,
        weekdayCycle: day.weekdayCycle,
      });
      if (!r) {
        missing++;
        continue;
      }
      total += r.sections.length;
      withText += r.sections.filter((s) => s.body).length;
    }
    expect(missing).toBe(0);
    // The Douay-Rheims store cannot align every book (Sirach, Tobit, Esther,
    // Judith); those days stay citation-only by design, never mis-aligned.
    expect(withText / total).toBeGreaterThan(0.7);
  });

  it("Easter Sunday 2026 and the Assumption resolve to their proper readings", () => {
    expect(at("2026-04-05").lectionaryKey).toBe("easter-sunday");
    expect(readingsOn("2026-04-05")!.sections[0].body).toMatch(/Peter/);
    expect(at("2025-08-15").lectionaryKey).toBe("assumption");
    expect(readingsOn("2025-08-15")!.sections.find((s) => s.kind === "GOSPEL")!.body).toMatch(
      /magnif/i,
    );
  });
});
