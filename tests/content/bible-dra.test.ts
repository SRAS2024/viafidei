/**
 * Douay-Rheims resolver — regression fixture + alignment proofs.
 *
 * 1. Every passage vendored in dra-passages.json (the previous hand-built
 *    store) must resolve to the same text through the resolver.
 * 2. Every alignment rule is validated structurally and by the boundary text
 *    it claims (the evidence recorded in alignment.ts).
 * 3. Anything that cannot be mapped with certainty is citation-only.
 */

import { describe, expect, it } from "vitest";

import { ALIGNMENT, vulgatePsalmNumber } from "@/lib/content-shared/bible/alignment";
import { BOOKS, type BookCode } from "@/lib/content-shared/bible/books";
import { douayChapterLength, douayText, resolveDouayPassage } from "@/lib/content-shared/bible/dra";
import { DRA_BOOKS } from "@/lib/content-shared/bible/dra/index";
import { MODERN_VERSES } from "@/lib/content-shared/bible/modern-verses";
import draPassages from "@/lib/content-shared/dra-passages.json";

const FIXTURE = draPassages as Record<string, { translation: string; text: string }>;

const normalise = (s: string) =>
  s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

describe("regression fixture (dra-passages.json)", () => {
  it("has the 33 seed passages", () => {
    expect(Object.keys(FIXTURE)).toHaveLength(33);
  });

  for (const [citation, { text }] of Object.entries(FIXTURE)) {
    it(`resolves "${citation}" to the vendored text`, () => {
      const r = resolveDouayPassage(citation);
      expect(r.alignment, r.note).not.toBe("unverified");
      expect(r.text).not.toBeNull();
      expect(normalise(r.text as string)).toBe(normalise(text));
    });
  }
});

describe("alignment table integrity", () => {
  it("every span has a valid shape and points at verses that exist in the store", () => {
    for (const [book, spans] of Object.entries(ALIGNMENT) as [BookCode, typeof ALIGNMENT.GEN][]) {
      for (const span of spans ?? []) {
        const width = span.to - span.from + 1;
        expect(width, `${book} ${span.chapter}:${span.from}-${span.to}`).toBeGreaterThan(0);
        const oneToOne = span.dra.length === width;
        const merge = span.dra.length === 1 && width > 1;
        const split = width === 1 && span.dra.length > 1;
        expect(oneToOne || merge || split, `${book} ${span.chapter}:${span.from} shape`).toBe(true);
        for (const [c, v] of span.dra) {
          expect(douayText(book, c, v), `${book} DRA ${c}:${v} missing`).not.toBeNull();
        }
        if (typeof span.chapter === "number") {
          const modernCount = MODERN_VERSES[book]?.[span.chapter - 1];
          if (modernCount !== undefined) {
            expect(
              span.to,
              `${book} ${span.chapter}:${span.to} beyond modern count`,
            ).toBeLessThanOrEqual(modernCount);
          }
        }
      }
    }
  });

  it("modern verse counts cover exactly the 69 alignable books", () => {
    const listed = Object.keys(MODERN_VERSES).sort();
    const expected = BOOKS.map((b) => b.code)
      .filter((c) => !["SIR", "TOB", "JDT", "EST"].includes(c))
      .sort();
    expect(listed).toEqual(expected);
    for (const [book, counts] of Object.entries(MODERN_VERSES)) {
      const draChapters = Object.keys(DRA_BOOKS[book as BookCode].chapters).length;
      // Joel (4 vs 3) and Malachi (3 vs 4) are the only chapter-count differences.
      if (book === "JOL") expect([counts.length, draChapters]).toEqual([4, 3]);
      else if (book === "MAL") expect([counts.length, draChapters]).toEqual([3, 4]);
      else expect(draChapters, book).toBe(counts.length);
    }
  });

  it("the psalm number map matches the Vulgate merges and splits", () => {
    expect(vulgatePsalmNumber(8)).toBe(8);
    expect(vulgatePsalmNumber(9)).toBe(9);
    expect(vulgatePsalmNumber(10)).toBe(9);
    expect(vulgatePsalmNumber(11)).toBe(10);
    expect(vulgatePsalmNumber(113)).toBe(112);
    expect(vulgatePsalmNumber(114)).toBe(113);
    expect(vulgatePsalmNumber(115)).toBe(113);
    expect(vulgatePsalmNumber(116)).toBe(114);
    expect(vulgatePsalmNumber(117)).toBe(116);
    expect(vulgatePsalmNumber(146)).toBe(145);
    expect(vulgatePsalmNumber(147)).toBe(146);
    expect(vulgatePsalmNumber(148)).toBe(148);
    // The verse-count identities behind the structural rules.
    expect(douayChapterLength("PSA", 9)).toBe(39); // modern 9 (21) + 10 (18)
    expect(douayChapterLength("PSA", 113)).toBe(26); // modern 114 (8) + 115 (18)
    expect(douayChapterLength("PSA", 114)).toBe(9); // modern 116:1-9
    expect(douayChapterLength("PSA", 115)).toBe(10); // modern 116:10-19
    expect(douayChapterLength("PSA", 146)).toBe(11); // modern 147:1-11
    expect(douayChapterLength("PSA", 147)).toBe(9); // modern 147:12-20
    expect(douayChapterLength("PSA", 50)).toBe(21);
    expect(douayChapterLength("PSA", 22)).toBe(6);
  });
});

const verse = (citation: string) => resolveDouayPassage(citation);

describe("psalm remapping (Vulgate numbering)", () => {
  it("renumbers 11–113 and 117–146 one lower with identical verse numbers", () => {
    const r = verse("Ps 98:1-6");
    expect(r.alignment).toBe("remapped");
    expect(r.verses).toEqual(["97:1", "97:2", "97:3", "97:4", "97:5", "97:6"]);
    expect(r.douayCitation).toBe("Psalm 97:1-6 (Vulgate numbering)");
    expect(r.bookLabel).toBe("Psalm");
    expect(r.text).toMatch(/^A psalm for David himself\. Sing ye to the Lord/);
    expect(r.note).toMatch(/Psalm 98 .* Psalm 97/);
    expect(verse("Ps 23:1-6").text).toMatch(/^A psalm for David\. The Lord ruleth me/);
    expect(verse("Ps 51:3-4").text).toMatch(
      /^Have mercy on me, O God, according to thy great mercy/,
    );
    expect(verse("Ps 118:1").verses).toEqual(["117:1"]);
    expect(verse("Ps 130:1").text).toMatch(/^Out of the depths/);
  });

  it("keeps 1–8 and 148–150 exact", () => {
    expect(verse("Ps 8:2").alignment).toBe("exact");
    expect(verse("Ps 8:2").text).toMatch(/^O Lord our Lord, how admirable is thy name/);
    expect(verse("Ps 150:1-6").alignment).toBe("exact");
    expect(verse("Ps 1:1-6").douayCitation).toBe("Psalm 1:1-6");
  });

  it("merges 9+10 → 9 (10:v → 9:v+21)", () => {
    expect(verse("Ps 9:21").verses).toEqual(["9:21"]);
    const r = verse("Ps 10:1");
    expect(r.verses).toEqual(["9:22"]);
    expect(r.text).toMatch(/^Why, O Lord, hast thou retired afar off/);
    expect(verse("Ps 10:18").verses).toEqual(["9:39"]);
  });

  it("merges 114+115 → 113 (115:v → 113:v+8)", () => {
    expect(verse("Ps 114:1").text).toMatch(/^When Israel went out of Egypt/);
    expect(verse("Ps 114:1").verses).toEqual(["113:1"]);
    const r = verse("Ps 115:1");
    expect(r.verses).toEqual(["113:9"]);
    expect(r.text).toMatch(/^Not to us, O Lord, not to us/);
    expect(verse("Ps 115:18").verses).toEqual(["113:26"]);
  });

  it("splits 116 → 114 (1-9) + 115 (10-19)", () => {
    expect(verse("Ps 116:1").verses).toEqual(["114:1"]);
    expect(verse("Ps 116:1").text).toMatch(/^I have loved, because the Lord will hear/);
    expect(verse("Ps 116:10").verses).toEqual(["115:1"]);
    expect(verse("Ps 116:10").text).toMatch(/^I have believed, therefore have I spoken/);
    const r = verse("Ps 116:12-13, 15 and 16bc, 17-18");
    expect(r.verses).toEqual(["115:3", "115:4", "115:6", "115:7", "115:8", "115:9"]);
    expect(r.text).toMatch(/^What shall I render to the Lord/);
    expect(r.text).toMatch(/Precious in the sight of the Lord is the death of his saints/);
    expect(r.douayCitation).toBe("Psalm 115:3-4, 6-9 (Vulgate numbering)");
  });

  it("splits 147 → 146 (1-11) + 147 (12-20)", () => {
    expect(verse("Ps 147:1").verses).toEqual(["146:1"]);
    expect(verse("Ps 147:11").verses).toEqual(["146:11"]);
    const r = verse("Ps 147:12-15, 19-20");
    expect(r.verses).toEqual(["147:1", "147:2", "147:3", "147:4", "147:8", "147:9"]);
    expect(r.text).toMatch(/^Praise the Lord, O Jerusalem/);
  });

  it("handles the psalms with an internal split/merge", () => {
    expect(verse("Ps 126:6").verses).toEqual(["125:6", "125:7"]);
    expect(verse("Ps 126:1-2, 2-3, 4-5, 6").verses).toEqual([
      "125:1",
      "125:2",
      "125:3",
      "125:4",
      "125:5",
      "125:6",
      "125:7",
    ]);
    expect(verse("Ps 2:12").verses).toEqual(["2:12", "2:13"]);
    expect(verse("Ps 4:2, 4, 7-8, 9").verses).toEqual(["4:2", "4:4", "4:7", "4:8", "4:9", "4:10"]);
    expect(verse("Ps 11:4, 5 and 7").verses).toEqual(["10:5", "10:6", "10:8"]);
    expect(verse("Ps 42:3, 5; 43:3, 4").verses).toEqual(["41:3", "41:5", "42:3", "42:4", "42:5"]);
    expect(verse("Ps 56:13-14").verses).toEqual(["55:12", "55:13"]);
    expect(verse("Ps 136:1-3, 16-18, 21-22, 24-26").verses.at(-1)).toBe("135:26");
  });

  it("withholds the psalms whose internal numbering is not verified", () => {
    expect(verse("Ps 20:2-5").alignment).toBe("unverified");
    expect(verse("Ps 20:2-5").text).toBeNull();
    expect(verse("Ps 44:10-11").alignment).toBe("unverified");
  });

  it("whole psalm", () => {
    expect(verse("Ps 117").verses).toEqual(["116:1", "116:2"]);
    expect(verse("Ps 117").text).toMatch(/^O praise the Lord, all ye nations/);
  });
});

describe("chapter-boundary remaps (evidence in alignment.ts)", () => {
  const cases: [string, string[], RegExp][] = [
    ["Mal 3:19-20", ["4:1", "4:2"], /^For behold the day shall come kindled as a furnace/],
    ["Mal 3:23", ["4:5"], /I will send you Elias the prophet/],
    ["Mal 3:1-4", ["3:1", "3:2", "3:3", "3:4"], /^Behold I send my angel/],
    [
      "Jl 3:1-5",
      ["2:28", "2:29", "2:30", "2:31", "2:32"],
      /^And it shall come to pass after this, that I will pour out my spirit/,
    ],
    ["Jl 4:12-13", ["3:12", "3:13"], /valley of Josaphat/],
    [
      "Hos 2:1-2",
      ["1:10", "1:11"],
      /^And the number of the children of Israel shall be as the sand of the sea/,
    ],
    [
      "Hos 2:16b, 17b, 21-22",
      ["2:14", "2:15", "2:19", "2:20"],
      /^Therefore, behold I will allure her/,
    ],
    ["Hos 12:1", ["11:12"], /^Ephraim hath compassed me about with denials/],
    [
      "Hos 14:2-10",
      ["14:2", "14:3", "14:4", "14:5", "14:6", "14:7", "14:8", "14:9", "14:10"],
      /^Return, O Israel, to the Lord thy God/,
    ],
    ["Na 2:1", ["1:15"], /^Behold upon the mountains the feet of him that bringeth good tidings/],
    ["Na 2:2", ["2:1"], /^He is come up that shall destroy before thy face/],
    ["Is 8:23—9:3", ["9:1", "9:2", "9:3", "9:4"], /^At the first time the land of Zabulon/],
    [
      "Is 9:1-6",
      ["9:2", "9:3", "9:4", "9:5", "9:6", "9:7"],
      /^The people that walked in darkness, have seen a great light/,
    ],
    [
      "Is 63:16b-17, 19b; 64:2-7",
      ["63:16", "63:17", "63:19", "64:1", "64:3", "64:4", "64:5", "64:6", "64:7", "64:8"],
      /That thou wouldst rend the heavens/,
    ],
    ["Jer 8:23", ["9:1"], /^Who will give water to my head/],
    ["Jer 9:1", ["9:2"], /^Who will give me in the wilderness a lodging place/],
    ["Gn 32:1", ["31:55"], /^But Laban arose in the night, and kissed his sons/],
    ["Gn 32:2", ["32:1"], /angels of God met him/],
    ["Ex 7:26", ["8:1"], /Let my people go to sacrifice to me/],
    ["Ex 8:1", ["8:5"], /Stretch forth thy hand upon the streams/],
    ["Ex 21:37", ["22:1"], /^If any man steal an ox or a sheep/],
    [
      "Ex 40:16-21, 34-38",
      [
        "40:14",
        "40:15",
        "40:16",
        "40:17",
        "40:18",
        "40:19",
        "40:32",
        "40:33",
        "40:34",
        "40:35",
        "40:36",
      ],
      /^And Moses did all that the Lord had commanded/,
    ],
    ["Lv 5:20", ["6:1"], /^The Lord spoke to Moses, saying/],
    ["Lv 6:1", ["6:8"], /^And the Lord spoke to Moses, saying/],
    ["Nm 12:16", ["13:1"], /^And the people marched from Haseroth/],
    ["Nm 13:1-2", ["13:2", "13:3"], /Send men to view the land of Chanaan/],
    ["Nm 17:1", ["16:36"], /^And the Lord spoke to Moses, saying/],
    ["Nm 17:16-17", ["17:1", "17:2"], /take of every one of them a rod/],
    [
      "Nm 30:1",
      ["30:1"],
      /^And Moses told the children of Israel all that the Lord had commanded him/,
    ],
    ["Dt 13:1", ["12:32"], /neither add any thing, nor diminish/],
    ["Dt 23:1", ["22:30"], /^No man shall take his father/],
    ["Dt 28:69", ["29:1"], /^These are the words of the covenant/],
    ["1 Sm 21:1", ["20:43"], /Jonathan went into the city/],
    ["1 Sm 21:2", ["21:1"], /^And David came to Nobe to Achimelech/],
    ["1 Sm 24:1", ["24:1"], /strong holds of Engaddi/],
    ["2 Sm 19:1", ["18:33"], /My son Absalom, Absalom my son/],
    ["1 Kgs 5:1", ["4:21"], /^And Solomon had under him all the kingdoms/],
    ["1 Kgs 5:15", ["5:1"], /^And Hiram king of Tyre sent his servants/],
    ["2 Kgs 12:1", ["11:21"], /Joas was seven years old/],
    ["1 Chr 5:27", ["6:1"], /^The sons of Levi were Gerson, Caath, and Merari/],
    ["1 Chr 6:1", ["6:16"], /^So the sons of Levi were Gerson/],
    ["2 Chr 1:18", ["2:1"], /Solomon determined to build a house/],
    ["2 Chr 13:23", ["14:1"], /Abia slept with his fathers/],
    ["Neh 3:33", ["4:1"], /Sanaballat heard that we were building the wall/],
    ["Neh 4:1", ["4:7"], /Tobias, and the Arabians/],
    ["Neh 10:1", ["9:38"], /we ourselves make a covenant/],
    ["Jb 40:3-5", ["39:33", "39:34", "39:35"], /^Then Job answered the Lord/],
    ["Jb 40:25", ["40:20"], /leviathan with a hook/],
    ["Jb 41:1", ["40:28"], /his hope shall fail him/],
    ["Jb 42:12-17", ["42:12", "42:13", "42:14", "42:15", "42:16"], /fourteen thousand sheep/],
    ["Eccl 6:12", ["7:1"], /^What needeth a man to seek things that are above him/],
    ["Eccl 7:1", ["7:2"], /^A good name is better than precious ointments/],
    ["Sg 1:2", ["1:1"], /^Let him kiss me with the kiss of his mouth/],
    ["Sg 6:1", ["5:17"], /Whither is thy beloved gone/],
    ["Sg 7:1", ["6:12"], /Return, return, O Sulamitess/],
    [
      "Sg 2:8-14",
      ["2:8", "2:9", "2:10", "2:11", "2:12", "2:13", "2:14"],
      /^The voice of my beloved, behold he cometh leaping/,
    ],
    [
      "Wis 6:12-16",
      ["6:13", "6:14", "6:15", "6:16", "6:17"],
      /^Wisdom is glorious, and never fadeth away/,
    ],
    [
      "Wis 11:22—12:2",
      ["11:23", "11:24", "11:25", "11:26", "11:27", "12:1", "12:2"],
      /least grain of the balance/,
    ],
    [
      "Wis 9:13-18b",
      ["9:13", "9:14", "9:15", "9:16", "9:17", "9:18", "9:19"],
      /who among men is he that can know the counsel of God/,
    ],
    [
      "Wis 2:12, 17-20",
      ["2:12", "2:17", "2:18", "2:19", "2:20"],
      /^Let us therefore lie in wait for the just/,
    ],
    [
      "Is 45:21c-25",
      ["45:21", "45:22", "45:23", "45:24", "45:25", "45:26"],
      /every knee shall be bowed to me/,
    ],
    ["Ez 2:8—3:4", ["2:8", "2:9", "3:1", "3:2", "3:3", "3:4"], /eat what I give thee/],
    [
      "Ez 21:1-5",
      ["20:45", "20:46", "20:47", "20:48", "20:49"],
      /Doth not this man speak by parables/,
    ],
    [
      "Dn 6:12-28",
      [
        "6:11",
        "6:12",
        "6:13",
        "6:14",
        "6:15",
        "6:16",
        "6:17",
        "6:18",
        "6:19",
        "6:20",
        "6:21",
        "6:22",
        "6:23",
        "6:24",
        "6:25",
        "6:26",
        "6:27",
      ],
      /Daniel out of the lions/,
    ],
    [
      "Dn 13:1-9, 15-17, 19-30, 33-62",
      [
        "13:1",
        "13:2",
        "13:3",
        "13:4",
        "13:5",
        "13:6",
        "13:7",
        "13:8",
        "13:9",
        "13:15",
        "13:16",
        "13:17",
        "13:19",
        "13:20",
        "13:21",
        "13:22",
        "13:23",
        "13:24",
        "13:25",
        "13:26",
        "13:27",
        "13:28",
        "13:29",
        "13:30",
        "13:33",
        "13:34",
        "13:35",
        "13:36",
        "13:37",
        "13:38",
        "13:39",
        "13:40",
        "13:41",
        "13:42",
        "13:43",
        "13:44",
        "13:45",
        "13:46",
        "13:47",
        "13:48",
        "13:49",
        "13:50",
        "13:51",
        "13:52",
        "13:53",
        "13:54",
        "13:55",
        "13:56",
        "13:57",
        "13:58",
        "13:59",
        "13:60",
        "13:61",
        "13:62",
      ],
      /Susanna/,
    ],
    ["Dn 14:1", ["13:65"], /Cyrus the Persian received his kingdom/],
    [
      "Dn 3:52, 53, 54, 55, 56",
      ["3:52", "3:53", "3:54", "3:55", "3:56"],
      /^Blessed art thou, O Lord the God of our fathers/,
    ],
    ["Mi 5:1-4a", ["5:2", "5:3", "5:4", "5:5"], /^AND THOU, BETHLEHEM Ephrata/],
    ["Mi 4:14", ["5:1"], /strike the cheek of the judge of Israel/],
    ["Mi 5:12-14", ["5:12", "5:13", "5:14"], /destroy thy graven things/],
    ["Am 6:1a, 4-7", ["6:1", "6:4", "6:5", "6:6", "6:7"], /^Woe to you that are wealthy in Sion/],
    ["Am 6:11-14", ["6:12", "6:13", "6:14", "6:15"], /strike the greater house with breaches/],
    [
      "Zec 2:5-9, 14-15a",
      ["2:1", "2:2", "2:3", "2:4", "2:5", "2:10", "2:11"],
      /^And I lifted up my eyes, and saw, and behold a man, with a measuring line/,
    ],
    ["Zec 2:1-4", ["1:18", "1:19", "1:20", "1:21"], /behold four horns/],
    [
      "Hg 1:15b—2:9",
      ["2:1", "2:2", "2:3", "2:4", "2:5", "2:6", "2:7", "2:8", "2:9", "2:10"],
      /^In the four and twentieth day of the month, in the sixth month/,
    ],
    [
      "Mt 17:22-27",
      ["17:21", "17:22", "17:23", "17:24", "17:25", "17:26"],
      /^And when they abode together in Galilee/,
    ],
    [
      "Mt 17:14-20",
      ["17:14", "17:15", "17:16", "17:17", "17:18", "17:19"],
      /Lord, have pity on my son/,
    ],
    [
      "Mk 9:2-10",
      ["9:1", "9:2", "9:3", "9:4", "9:5", "9:6", "9:7", "9:8", "9:9"],
      /^And after six days Jesus taketh with him Peter and James and John/,
    ],
    ["Mk 9:1", ["8:39"], /shall not taste death/],
    ["Mk 4:35-41", ["4:35", "4:36", "4:37", "4:38", "4:39", "4:40"], /Peace, be still/],
    [
      "Jn 6:51-58",
      ["6:51", "6:52", "6:53", "6:54", "6:55", "6:56", "6:57", "6:58", "6:59"],
      /^I am the living bread which came down from heaven/,
    ],
    [
      "Jn 6:60-69",
      ["6:61", "6:62", "6:63", "6:64", "6:65", "6:66", "6:67", "6:68", "6:69", "6:70"],
      /Lord, to whom shall we go/,
    ],
    [
      "Jn 6:1-15",
      [
        "6:1",
        "6:2",
        "6:3",
        "6:4",
        "6:5",
        "6:6",
        "6:7",
        "6:8",
        "6:9",
        "6:10",
        "6:11",
        "6:12",
        "6:13",
        "6:14",
        "6:15",
      ],
      /^After these things Jesus went over the sea of Galilee/,
    ],
    [
      "Acts 6:8-10; 7:54-59",
      ["6:8", "6:9", "6:10", "7:54", "7:55", "7:56", "7:57", "7:58"],
      /Lord Jesus, receive my spirit/,
    ],
    ["Acts 7:55-60", ["7:55", "7:56", "7:57", "7:58", "7:59"], /lay not this sin to their charge/],
    [
      "Acts 14:21-27",
      ["14:20", "14:21", "14:22", "14:23", "14:24", "14:25", "14:26"],
      /through many tribulations we must enter into the kingdom of God/,
    ],
    [
      "Acts 14:5-18",
      [
        "14:5",
        "14:6",
        "14:7",
        "14:8",
        "14:9",
        "14:10",
        "14:11",
        "14:12",
        "14:13",
        "14:14",
        "14:15",
        "14:16",
        "14:17",
      ],
      /Stand upright on thy feet/,
    ],
    [
      "1 Thes 4:13-18",
      ["4:12", "4:13", "4:14", "4:15", "4:16", "4:17"],
      /^And we will not have you ignorant, brethren, concerning them that are asleep/,
    ],
    [
      "2 Thes 2:16—3:5",
      ["2:15", "2:16", "3:1", "3:2", "3:3", "3:4", "3:5"],
      /^Now our Lord Jesus Christ himself/,
    ],
    ["3 Jn 5-8", ["1:5", "1:6", "1:7", "1:8"], /./],
    [
      "Est C:12, 14-16, 23-25",
      ["14:1", "14:3", "14:4", "14:5", "14:12", "14:13", "14:14"],
      /^Queen Esther also, fearing the danger/,
    ],
    [
      "Est C:1-11",
      [
        "13:8",
        "13:9",
        "13:10",
        "13:11",
        "13:12",
        "13:13",
        "13:14",
        "13:15",
        "13:16",
        "13:17",
        "13:18",
      ],
      /^But Mardochai besought the Lord/,
    ],
    [
      "1 Mc 1:10-15, 41-43, 54-57, 62-63",
      [
        "1:11",
        "1:12",
        "1:13",
        "1:14",
        "1:15",
        "1:16",
        "1:43",
        "1:44",
        "1:45",
        "1:57",
        "1:58",
        "1:59",
        "1:60",
        "1:65",
        "1:66",
      ],
      /Antiochus the Illustrious/,
    ],
    [
      "Jon 3:1-10",
      ["3:1", "3:2", "3:3", "3:4", "3:5", "3:6", "3:7", "3:8", "3:9", "3:10"],
      /Ninive/,
    ],
    [
      "Bar 5:1-9",
      ["5:1", "5:2", "5:3", "5:4", "5:5", "5:6", "5:7", "5:8", "5:9"],
      /^Put off, O Jerusalem, the garment of thy mourning/,
    ],
  ];
  for (const [citation, expected, pattern] of cases) {
    it(citation, () => {
      const r = verse(citation);
      expect(r.alignment, r.note).not.toBe("unverified");
      expect(r.verses).toEqual(expected);
      expect(r.text).toMatch(pattern);
    });
  }

  it("labels remaps and exact matches correctly", () => {
    expect(verse("Mal 3:19-20").alignment).toBe("remapped");
    expect(verse("Mal 3:19-20").douayCitation).toBe("Malachias 4:1-2");
    expect(verse("Mal 3:1-4").alignment).toBe("exact");
    expect(verse("Joel 2:12-18").alignment).toBe("exact");
    expect(verse("Joel 2:12-18").douayCitation).toBe("Joel 2:12-18");
    expect(verse("Is 52:13—53:12").douayCitation).toBe("Isaias 52:13—53:12");
    expect(verse("Rv 11:19a; 12:1-6a, 10ab").douayCitation).toBe("Apocalypse 11:19; 12:1-6, 10");
    expect(verse("Is 63:16b-17, 19b; 64:2-7").douayCitation).toBe("Isaias 63:16-17, 19—64:1, 3-8");
    expect(verse("Jn 6:51").note).toMatch(/divides verses differently/);
    expect(verse("Mk 4:40-41").verses).toEqual(["4:40"]);
    expect(verse("Mk 4:40-41").note).toMatch(/one Douay verse/);
  });
});

describe("citation-only (unverified) — never a guessed or shifted passage", () => {
  const withheld = (citation: string, reason: RegExp) => {
    const r = verse(citation);
    expect(r.alignment, citation).toBe("unverified");
    expect(r.text, citation).toBeNull();
    expect(r.verses, citation).toEqual([]);
    expect(r.douayCitation, citation).toBe("");
    expect(r.note, citation).toMatch(reason);
  };

  it("Sirach, Tobit and Judith diverge pervasively", () => {
    withheld("Sir 3:2-6, 12-14", /Sirach/);
    expect(verse("Sir 3:2-6, 12-14").bookLabel).toBe("Sirach");
    withheld("Tb 1:3; 2:1a-8", /Tobit/);
    withheld("Jdt 13:18bcde, 19", /Judith/);
  });

  it("Esther outside addition C is not aligned", () => {
    withheld("Est 4:17", /not verified/);
    withheld("Est D:1-4", /not aligned/);
  });

  it("count-mismatched chapters without a verified rule are withheld", () => {
    withheld("Jos 21:1-3", /Joshua 21/);
    withheld("Gn 49:32", /Genesis 49/);
    withheld("Nm 25:19", /Numbers 25/);
    withheld("Wis 19:20-22", /Wisdom 19/);
    withheld("Jgs 5:1-5", /Judges 5/);
    withheld("Sg 1:1", /Song of Songs 1/);
    withheld("1 Mc 1:20-24", /1 Maccabees 1/);
  });

  it("verses beyond the chapter are withheld, not silently dropped", () => {
    withheld("Ex 40:39", /Exodus 40/);
    withheld("Ps 23:7", /only 6 verses/);
    withheld("Jn 21:26", /only 25 verses/);
  });

  it("a range that contains one bad verse withholds the whole passage", () => {
    withheld("Ps 42:2-5; 44:2", /Psalm 44/);
  });

  it("unparseable citations", () => {
    withheld("Jud 13:18", /could not be parsed/);
    withheld("", /could not be parsed/);
    withheld("Gospel of Thomas 1:1", /could not be parsed/);
  });
});

describe("notes, alternatives, multi-book and helpers", () => {
  it("partial verses include the whole verse with a note", () => {
    const r = verse("Mt 5:1-12a");
    expect(r.alignment).toBe("exact");
    expect(r.verses).toHaveLength(12);
    expect(r.note).toMatch(/whole Douay-Rheims verse is shown/);
    expect(verse("Mt 5:1-12").note).toBeUndefined();
  });

  it("resolves the first alternative and says so", () => {
    const r = verse("Jn 20:1-9 or Lk 24:13-35");
    expect(r.bookLabel).toBe("John");
    expect(r.text).toMatch(/Mary Magdalen/);
    expect(r.note).toMatch(/2 alternative readings; the first is shown/);
    expect(verse("Lk 22:14—23:56 or 23:1-49").verses[0]).toBe("22:14");
    expect(verse("Lk 22:14—23:56 or 23:1-49").verses.at(-1)).toBe("23:56");
  });

  it("joins two books cited with 'and'", () => {
    const r = verse("Joel 2:12-18 and 2 Cor 5:20—6:2");
    expect(r.bookLabel).toBe("Joel and 2 Corinthians");
    expect(r.douayCitation).toBe("Joel 2:12-18 and 2 Corinthians 5:20—6:2");
    expect(r.alignment).toBe("exact");
    expect(r.text).toMatch(/^Now therefore saith the Lord: Be converted to me/);
    expect(r.text).toMatch(/now is the day of salvation\.$/);
    expect(r.verses).toEqual([
      "2:12",
      "2:13",
      "2:14",
      "2:15",
      "2:16",
      "2:17",
      "2:18",
      "5:20",
      "5:21",
      "6:1",
      "6:2",
    ]);
  });

  it("dedupes verses cited twice (4a and 4b)", () => {
    const r = verse("Ps 122:1-2, 3-4a, 4b-5, 6-7, 8-9");
    expect(r.verses).toEqual([
      "121:1",
      "121:2",
      "121:3",
      "121:4",
      "121:5",
      "121:6",
      "121:7",
      "121:8",
      "121:9",
    ]);
  });

  it("the Magnificat and the Canticle of Daniel resolve exactly", () => {
    const m = verse("Lk 1:46-47, 48-49, 50-51, 52-53, 54-55");
    expect(m.alignment).toBe("exact");
    expect(m.text).toMatch(/^And Mary said: My soul doth magnify the Lord/);
    expect(verse("Dn 3:52, 53, 54, 55, 56").alignment).toBe("exact");
  });

  it("douayText / douayChapterLength expose the store in Douay numbering", () => {
    expect(douayText("JER", 9, 1)).toMatch(/^Who will give water to my head/);
    expect(douayText("PSA", 22, 1)).toMatch(/The Lord ruleth me/);
    expect(douayText("GEN", 99, 1)).toBeNull();
    expect(douayText("GEN", 1, 0)).toBeNull();
    expect(douayChapterLength("REV", 12)).toBe(18);
    expect(douayChapterLength("REV", 99)).toBeNull();
  });

  it("the store carries all 73 books", () => {
    expect(Object.keys(DRA_BOOKS)).toHaveLength(73);
    for (const b of BOOKS) expect(DRA_BOOKS[b.code].code, b.code).toBe(b.code);
  });
});
