/**
 * Lectionary citation parser + book table.
 *
 * Proves that every abbreviation the USCCB lectionary and catholic-resources.org
 * use resolves to the right book (never to a Douay-named neighbour: "1 Kings"
 * is the modern 1 Kings, not 1 Samuel) and that every citation shape found in
 * the lectionary parses to the documented AST — or to null, never a throw.
 */

import { describe, expect, it } from "vitest";

import { BOOKS, bookByCode, findBook, normaliseBookToken } from "@/lib/content-shared/bible/books";
import { parseCitation } from "@/lib/content-shared/bible/citation";

const code = (token: string) => findBook(token)?.code ?? null;

describe("book table", () => {
  it("has exactly the 73 books of the Catholic canon with unique codes", () => {
    expect(BOOKS).toHaveLength(73);
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(73);
    expect(bookByCode("PSA").name).toBe("Psalm");
    expect(bookByCode("1SA").douayName).toBe("1 Kings");
  });

  it("resolves every USCCB lectionary abbreviation", () => {
    const usccb: Record<string, string> = {
      Gn: "GEN",
      Ex: "EXO",
      Lv: "LEV",
      Nm: "NUM",
      Dt: "DEU",
      Jos: "JOS",
      Jgs: "JDG",
      Ru: "RUT",
      "1 Sm": "1SA",
      "2 Sm": "2SA",
      "1 Kgs": "1KI",
      "2 Kgs": "2KI",
      "1 Chr": "1CH",
      "2 Chr": "2CH",
      Ezr: "EZR",
      Neh: "NEH",
      Tb: "TOB",
      Jdt: "JDT",
      Est: "EST",
      "1 Mc": "1MA",
      "2 Mc": "2MA",
      Jb: "JOB",
      Ps: "PSA",
      Prv: "PRO",
      Eccl: "ECC",
      Sg: "SNG",
      Wis: "WIS",
      Sir: "SIR",
      Is: "ISA",
      Jer: "JER",
      Lam: "LAM",
      Bar: "BAR",
      Ez: "EZK",
      Dn: "DAN",
      Hos: "HOS",
      Jl: "JOL",
      Am: "AMO",
      Ob: "OBA",
      Jon: "JON",
      Mi: "MIC",
      Na: "NAM",
      Hb: "HAB",
      Zep: "ZEP",
      Hg: "HAG",
      Zec: "ZEC",
      Mal: "MAL",
      Mt: "MAT",
      Mk: "MRK",
      Lk: "LUK",
      Jn: "JHN",
      Acts: "ACT",
      Rom: "ROM",
      "1 Cor": "1CO",
      "2 Cor": "2CO",
      Gal: "GAL",
      Eph: "EPH",
      Phil: "PHP",
      Col: "COL",
      "1 Thes": "1TH",
      "2 Thes": "2TH",
      "1 Tm": "1TI",
      "2 Tm": "2TI",
      Ti: "TIT",
      Phlm: "PHM",
      Heb: "HEB",
      Jas: "JAS",
      "1 Pt": "1PE",
      "2 Pt": "2PE",
      "1 Jn": "1JN",
      "2 Jn": "2JN",
      "3 Jn": "3JN",
      Jude: "JUD",
      Rv: "REV",
    };
    for (const [abbr, expected] of Object.entries(usccb)) {
      expect(code(abbr), abbr).toBe(expected);
      expect(code(`${abbr}.`), `${abbr}.`).toBe(expected);
      expect(code(abbr.toUpperCase()), abbr.toUpperCase()).toBe(expected);
      expect(code(abbr.toLowerCase()), abbr.toLowerCase()).toBe(expected);
    }
  });

  it("resolves the catholic-resources.org abbreviations", () => {
    const cr: Record<string, string> = {
      Isa: "ISA",
      Matt: "MAT",
      "1 Sam": "1SA",
      "2 Sam": "2SA",
      "1 Kgs": "1KI",
      Ezek: "EZK",
      Dan: "DAN",
      Hos: "HOS",
      Joel: "JOL",
      Mic: "MIC",
      Nah: "NAM",
      Hab: "HAB",
      Zeph: "ZEP",
      Hag: "HAG",
      Zech: "ZEC",
      Rev: "REV",
      Sir: "SIR",
      Wis: "WIS",
      Song: "SNG",
      Eccl: "ECC",
      Phil: "PHP",
      "1 Thess": "1TH",
      "2 Thess": "2TH",
      Philem: "PHM",
      Jas: "JAS",
      "1 Pet": "1PE",
      "2 Pet": "2PE",
    };
    for (const [abbr, expected] of Object.entries(cr)) expect(code(abbr), abbr).toBe(expected);
  });

  it("resolves full modern names, Douay names and ordinal variants", () => {
    for (const b of BOOKS) expect(code(b.name), b.name).toBe(b.code);
    expect(code("Song of Songs")).toBe("SNG");
    expect(code("Canticle of Canticles")).toBe("SNG");
    expect(code("Revelation")).toBe("REV");
    expect(code("Apocalypse")).toBe("REV");
    expect(code("Sirach")).toBe("SIR");
    expect(code("Ecclesiasticus")).toBe("SIR");
    expect(code("Psalms")).toBe("PSA");
    expect(code("I Cor")).toBe("1CO");
    expect(code("1Cor")).toBe("1CO");
    expect(code("First Corinthians")).toBe("1CO");
    expect(code("III John")).toBe("3JN");
    expect(normaliseBookToken(" 1Cor. ")).toBe("1 cor");
  });

  it('"1 Kings" is the MODERN 1 Kings (1KI), never 1 Samuel; only "3 Kings" is a Douay alias', () => {
    expect(code("1 Kings")).toBe("1KI");
    expect(code("2 Kings")).toBe("2KI");
    expect(code("3 Kings")).toBe("1KI");
    expect(code("4 Kings")).toBe("2KI");
    expect(code("1 Samuel")).toBe("1SA");
  });

  it("does not guess: unknown or ambiguous tokens are null", () => {
    expect(code("Jud")).toBeNull(); // Judith? Judges? Jude? — refuse
    expect(code("Xyz")).toBeNull();
    expect(code("")).toBeNull();
  });
});

const seg = (
  book: string,
  chapter: number | string,
  verses: [number, number | null, boolean?][] | "all",
) => ({
  book,
  chapter,
  verses:
    verses === "all"
      ? "all"
      : verses.map(([from, to, partial]) => ({ from, to, partial: partial ?? false })),
});

describe("parseCitation", () => {
  it("parses simple ranges and lists", () => {
    expect(parseCitation("Nm 6:22-27")).toEqual({
      raw: "Nm 6:22-27",
      alternatives: [{ segments: [seg("NUM", 6, [[22, 27]])] }],
    });
    expect(parseCitation("Ps 67:2-3, 5, 6, 8")!.alternatives[0].segments).toEqual([
      seg("PSA", 67, [
        [2, 3],
        [5, 5],
        [6, 6],
        [8, 8],
      ]),
    ]);
    expect(parseCitation("Ps 89:2-3, 4-5, 27 and 29")!.alternatives[0].segments).toEqual([
      seg("PSA", 89, [
        [2, 3],
        [4, 5],
        [27, 27],
        [29, 29],
      ]),
    ]);
    expect(parseCitation("Dn 3:52, 53, 54, 55, 56")!.alternatives[0].segments[0].verses).toEqual(
      [52, 53, 54, 55, 56].map((v) => ({ from: v, to: v, partial: false })),
    );
    expect(
      parseCitation("Lk 1:46-47, 48-49, 50-51, 52-53, 54-55")!.alternatives[0].segments,
    ).toEqual([
      seg("LUK", 1, [
        [46, 47],
        [48, 49],
        [50, 51],
        [52, 53],
        [54, 55],
      ]),
    ]);
  });

  it("flags partial verses (letters) but keeps the whole verse", () => {
    expect(parseCitation("Ps 116:12-13, 15 and 16bc, 17-18")!.alternatives[0].segments).toEqual([
      seg("PSA", 116, [
        [12, 13],
        [15, 15],
        [16, 16, true],
        [17, 18],
      ]),
    ]);
    expect(parseCitation("Ps 122:1-2, 3-4a, 4b-5, 6-7, 8-9")!.alternatives[0].segments).toEqual([
      seg("PSA", 122, [
        [1, 2],
        [3, 4, true],
        [4, 5, true],
        [6, 7],
        [8, 9],
      ]),
    ]);
    expect(parseCitation("Mt 5:1-12a")!.alternatives[0].segments).toEqual([
      seg("MAT", 5, [[1, 12, true]]),
    ]);
    expect(parseCitation("1 Cor 12:3b-7, 12-13")!.alternatives[0].segments).toEqual([
      seg("1CO", 12, [
        [3, 7, true],
        [12, 13],
      ]),
    ]);
    expect(parseCitation("Acts 10:34a, 37-43")!.alternatives[0].segments).toEqual([
      seg("ACT", 10, [
        [34, 34, true],
        [37, 43],
      ]),
    ]);
    expect(parseCitation("Is 12:2-3, 4bcd, 5-6")!.alternatives[0].segments).toEqual([
      seg("ISA", 12, [
        [2, 3],
        [4, 4, true],
        [5, 6],
      ]),
    ]);
    expect(parseCitation("1 Sm 2:1, 4-5, 6-7, 8abcd")!.alternatives[0].segments).toEqual([
      seg("1SA", 2, [
        [1, 1],
        [4, 5],
        [6, 7],
        [8, 8, true],
      ]),
    ]);
    expect(parseCitation("Jdt 13:18bcde, 19")!.alternatives[0].segments).toEqual([
      seg("JDT", 13, [
        [18, 18, true],
        [19, 19],
      ]),
    ]);
  });

  it('accepts the catholic-resources.org "+" join', () => {
    expect(parseCitation("Ps 97:1+2b, 6+7c, 9")!.alternatives[0].segments).toEqual([
      seg("PSA", 97, [
        [1, 1],
        [2, 2, true],
        [6, 6],
        [7, 7, true],
        [9, 9],
      ]),
    ]);
  });

  it("parses chapter-crossing ranges (em dash) and ';' groups", () => {
    expect(parseCitation("Is 52:13—53:12")!.alternatives[0].segments).toEqual([
      seg("ISA", 52, [[13, null]]),
      seg("ISA", 53, [[1, 12]]),
    ]);
    expect(parseCitation("2 Cor 5:20—6:2")!.alternatives[0].segments).toEqual([
      seg("2CO", 5, [[20, null]]),
      seg("2CO", 6, [[1, 2]]),
    ]);
    expect(parseCitation("Rv 11:19a; 12:1-6a, 10ab")!.alternatives[0].segments).toEqual([
      seg("REV", 11, [[19, 19, true]]),
      seg("REV", 12, [
        [1, 6, true],
        [10, 10, true],
      ]),
    ]);
    expect(parseCitation("Heb 4:14-16; 5:7-9")!.alternatives[0].segments).toEqual([
      seg("HEB", 4, [[14, 16]]),
      seg("HEB", 5, [[7, 9]]),
    ]);
    expect(parseCitation("Jn 18:1—19:42")!.alternatives[0].segments).toEqual([
      seg("JHN", 18, [[1, null]]),
      seg("JHN", 19, [[1, 42]]),
    ]);
    // Whole chapters in between are included.
    expect(parseCitation("Ex 1:1—3:2")!.alternatives[0].segments).toEqual([
      seg("EXO", 1, [[1, null]]),
      seg("EXO", 2, "all"),
      seg("EXO", 3, [[1, 2]]),
    ]);
    expect(parseCitation("Nm 13:1-2, 25—14:1, 26-29a, 34-35")!.alternatives[0].segments).toEqual([
      seg("NUM", 13, [
        [1, 2],
        [25, null],
      ]),
      seg("NUM", 14, [
        [1, 1],
        [26, 29, true],
        [34, 35],
      ]),
    ]);
  });

  it("parses alternatives ('or'), inheriting the book when omitted", () => {
    expect(parseCitation("Jn 20:1-9 or Lk 24:13-35")!.alternatives).toEqual([
      { segments: [seg("JHN", 20, [[1, 9]])] },
      { segments: [seg("LUK", 24, [[13, 35]])] },
    ]);
    expect(parseCitation("Lk 22:14—23:56 or 23:1-49")!.alternatives).toEqual([
      { segments: [seg("LUK", 22, [[14, null]]), seg("LUK", 23, [[1, 56]])] },
      { segments: [seg("LUK", 23, [[1, 49]])] },
    ]);
    expect(parseCitation("Mt 26:14—27:66 or 27:11-54")!.alternatives).toEqual([
      { segments: [seg("MAT", 26, [[14, null]]), seg("MAT", 27, [[1, 66]])] },
      { segments: [seg("MAT", 27, [[11, 54]])] },
    ]);
    expect(parseCitation("Jn 11:1-45 or 11:3-7, 17, 20-27, 33b-45")!.alternatives).toEqual([
      { segments: [seg("JHN", 11, [[1, 45]])] },
      {
        segments: [
          seg("JHN", 11, [
            [3, 7],
            [17, 17],
            [20, 27],
            [33, 45, true],
          ]),
        ],
      },
    ]);
    expect(parseCitation("Ex 20:1-17 or 20:1-3, 7-8, 12-17")!.alternatives).toEqual([
      { segments: [seg("EXO", 20, [[1, 17]])] },
      {
        segments: [
          seg("EXO", 20, [
            [1, 3],
            [7, 8],
            [12, 17],
          ]),
        ],
      },
    ]);
    expect(parseCitation("Sg 2:8-14 or Zep 3:14-18a")!.alternatives).toEqual([
      { segments: [seg("SNG", 2, [[8, 14]])] },
      { segments: [seg("ZEP", 3, [[14, 18, true]])] },
    ]);
  });

  it("joins a second book with 'and' into the same alternative", () => {
    expect(parseCitation("Joel 2:12-18 and 2 Cor 5:20—6:2")!.alternatives).toEqual([
      {
        segments: [seg("JOL", 2, [[12, 18]]), seg("2CO", 5, [[20, null]]), seg("2CO", 6, [[1, 2]])],
      },
    ]);
  });

  it("strips 'See' / 'cf.' prefixes and accepts full names", () => {
    expect(parseCitation("See Jn 6:63c, 68c")!.alternatives[0].segments).toEqual([
      seg("JHN", 6, [
        [63, 63, true],
        [68, 68, true],
      ]),
    ]);
    expect(parseCitation("cf. Lk 8:15")!.alternatives[0].segments).toEqual([
      seg("LUK", 8, [[15, 15]]),
    ]);
    expect(parseCitation("Isaiah 52:7-10")!.alternatives[0].segments).toEqual([
      seg("ISA", 52, [[7, 10]]),
    ]);
    expect(parseCitation("Revelation 11:19a; 12:1-6a, 10ab")!.alternatives[0].segments).toEqual([
      seg("REV", 11, [[19, 19, true]]),
      seg("REV", 12, [
        [1, 6, true],
        [10, 10, true],
      ]),
    ]);
    expect(parseCitation("Song of Songs 2:8-14")!.alternatives[0].segments[0].book).toBe("SNG");
    expect(parseCitation("1 Kings 19:16b, 19-21")!.alternatives[0].segments[0].book).toBe("1KI");
  });

  it("handles whole chapters, single-chapter books and Esther's additions", () => {
    expect(parseCitation("Ps 117")!.alternatives[0].segments).toEqual([seg("PSA", 117, "all")]);
    expect(parseCitation("Jn 18—19")!.alternatives[0].segments).toEqual([
      seg("JHN", 18, "all"),
      seg("JHN", 19, "all"),
    ]);
    expect(parseCitation("Phlm 9-10, 12-17")!.alternatives[0].segments).toEqual([
      seg("PHM", 1, [
        [9, 10],
        [12, 17],
      ]),
    ]);
    expect(parseCitation("Jude 17, 20b-25")!.alternatives[0].segments).toEqual([
      seg("JUD", 1, [
        [17, 17],
        [20, 25, true],
      ]),
    ]);
    expect(parseCitation("Est C:12, 14-16, 23-25")!.alternatives[0].segments).toEqual([
      seg("EST", "C", [
        [12, 12],
        [14, 16],
        [23, 25],
      ]),
    ]);
  });

  it("is whitespace/dash tolerant", () => {
    expect(parseCitation("  Is 52:13 – 53:12 ")!.alternatives[0].segments).toHaveLength(2);
    expect(parseCitation("Ps 67:2‑3")!.alternatives[0].segments).toEqual([
      seg("PSA", 67, [[2, 3]]),
    ]);
  });

  it("returns null (never throws) for anything it cannot parse", () => {
    for (const bad of [
      "",
      "   ",
      "Xyz 1:1",
      "Jud 13:18", // ambiguous abbreviation
      "Ps",
      "Ps 67:",
      "Ps 67:5-3",
      "Ps 67:0",
      "Ps 0:1",
      "Mt 5:1-12a, or",
      "Gn A:1", // letter chapters only for Esther
      "Is 53:12—52:13", // backwards chapter crossing
      "Jn 19—18",
    ]) {
      expect(parseCitation(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(parseCitation(undefined as unknown as string)).toBeNull();
  });
});
