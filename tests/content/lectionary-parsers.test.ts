/**
 * Parser tests for the three lectionary sources. The fixtures are short excerpts
 * copied verbatim (entities, footnote markers, Latin-1 punctuation and all) from
 * the files scripts/lectionary/build-tables.ts reads, so the cases that once
 * corrupted a citation stay covered:
 *   - a superscript footnote glued to a verse range ("10-13<sup>5</sup>");
 *   - the sources' own abbreviations ("Hebr", "Zac", "Sgs", "Eccl/Qoh");
 *   - "+" and "&" verse joins, "A) … B) … C) …" cycle splits, pericope titles;
 *   - a USCCB calendar footnote that quotes a Lectionary number.
 */

import { describe, expect, it } from "vitest";

import { parseCitation } from "@/lib/content-shared/bible/citation";
import {
  cleanLectionaryNumber,
  labelCycle,
  labelMonthDay,
  labelVariant,
  parseCatholicResourcesPage,
} from "../../scripts/lectionary/parsers/catholic-resources";
import { cellText, decodeEntities, extractTables } from "../../scripts/lectionary/parsers/html";
import {
  isEmptyCitationCell,
  normaliseCell,
  normaliseCitation,
  splitByCycle,
  stripAnnotations,
} from "../../scripts/lectionary/parsers/citations";
import { parseWesthong } from "../../scripts/lectionary/parsers/westhong";
import { parseUsccbCalendar } from "../../scripts/lectionary/parsers/usccb-calendar";
import { keyFromCatholicResourcesLabel } from "../../scripts/lectionary/key-labels";

const SUNDAY_PAGE = `
<html><body>
<table>
<tr><th>Date</th><th>#</th><th>Sunday</th><th>First Reading</th><th>Responsorial Psalm</th>
    <th>Second Reading</th><th>Alleluia Verse</th><th>Gospel</th></tr>
<tr><td>11/30/25</td><td>1</td><td>1<sup>st</sup> Sunday of Advent - A</td>
    <td>Isa 2:1-5</td><td>Ps 122:1-2, 3-4a, 4b-5, 6-7, 8-9</td><td>Rom 13:11-14</td>
    <td>Ps 85:8</td><td>Matt 24:37-44</td></tr>
<tr><td>3/8/26</td><td>28</td><td>3<sup>rd</sup> Sunday of Lent &ndash; A</td>
    <td>Exod 17:3-7</td><td>Ps 95:1-2, 6-7b, 7c-9</td><td>Rom 5:1-2, 5-8</td>
    <td>cf. John 4:42+15</td><td>John 4:5-42 &ndash; Samaritan Woman or 4:5-15, 19b-26, 39a, 40-42</td></tr>
</table>
</body></html>`;

const WEEKDAY_PAGE = `
<html><body>
<table>
<tr><th>Lect.&nbsp;#</th><th>Day</th><th>First Reading: Year I</th><th>Responsorial Psalm</th>
    <th>Alleluia</th><th>Gospel: Years I &amp; II</th><th>2025</th></tr>
<tr><td>305</td><td>Week 1 - Mon</td><td>Hebr 1:1-6</td><td>Ps 97:1+2b, 6+7c, 9</td>
    <td>Mark 1:15</td><td>Mark 1:14-20</td><td>13-Jan-25</td></tr>
<tr><td>186</td><td>2<sup>nd</sup> Week of Advent &ndash; Sat</td><td>Sir 48:1-4, 9-11</td>
    <td>Ps 80:2ac+3b, 15-16, 18-19</td><td>[ no bibl. ref. ]</td>
    <td>Matt 17:9a, 10-13<sup>5</sup></td><td>12/13/25</td></tr>
</table>
</body></html>`;

describe("catholic-resources HTML helpers", () => {
  it("decodes the entities the pages use", () => {
    expect(decodeEntities("Lect.&nbsp;# &amp; Day &ndash; Mon")).toBe("Lect. # & Day – Mon");
  });

  it("keeps ordinal superscripts but drops footnote markers", () => {
    expect(cellText("1<sup>st</sup> Sunday of Advent")).toBe("1st Sunday of Advent");
    // Without this the citation would read "Matt 17:9a, 10-135".
    expect(cellText("Matt 17:9a, 10-13<sup>5</sup>")).toBe("Matt 17:9a, 10-13");
  });

  it("returns every table as rows of cells", () => {
    const tables = extractTables(SUNDAY_PAGE);
    expect(tables).toHaveLength(1);
    expect(tables[0][0][0]).toBe("Date");
    expect(tables[0]).toHaveLength(3);
  });
});

describe("citation normalisation", () => {
  it("folds the sources' abbreviations onto the USCCB's", () => {
    expect(normaliseCitation("Isa 2:1-5")).toBe("Is 2:1-5");
    expect(normaliseCitation("Hebr 4:12")).toBe("Heb 4:12");
    expect(normaliseCitation("Zac 2:14-17")).toBe("Zec 2:14-17");
    expect(normaliseCitation("1 Petr 3:14-17")).toBe("1 Pt 3:14-17");
    expect(normaliseCitation("Eccl/Qoh 1:2-11")).toBe("Eccl 1:2-11");
    expect(normaliseCitation("Sgs 3:1-4b")).toBe("Sg 3:1-4b");
    expect(normaliseCitation("Acts of the Apostles 10:34a, 37-43")).toBe("Acts 10:34a, 37-43");
  });

  it("normalises the joins, dashes and prefixes", () => {
    expect(normaliseCitation("Ps 97:1+2b, 6+7c, 9")).toBe("Ps 97:1 and 2b, 6 and 7c, 9");
    expect(normaliseCitation("Psalm 78:3 & 4bc, 6c-7, 8")).toBe("Ps 78:3 and 4bc, 6c-7, 8");
    expect(normaliseCitation("Matt 26:14 – 27:66")).toBe("Mt 26:14—27:66");
    expect(normaliseCitation("See 1 Thess 2:13")).toBe("cf. 1 Thes 2:13");
    // "127-28" abbreviates "127-128"; a real descending range must still fail.
    expect(normaliseCitation("Ps 119:57+72, 76-77, 127-28, 129-30")).toBe(
      "Ps 119:57 and 72, 76-77, 127-128, 129-130",
    );
    expect(normaliseCitation("Ps 119:30-20")).toBeNull();
  });

  it("keeps Esther's lettered chapters and mis-punctuated continuations", () => {
    expect(normaliseCitation("Esth C:12, 14-16, 23-25")).toBe("Est C:12, 14-16, 23-25");
    // A ";" group with verse parts but no chapter continues the previous chapter.
    expect(normaliseCitation("Rev 11:19a; 12:1-6a; 10ab")).toBe("Rv 11:19a; 12:1-6a; 12:10ab");
    // A multi-book alternative keeps its own book.
    expect(normaliseCitation("Wis 3:1-9, or 1 John 3:14-18")).toBe("Wis 3:1-9 or 1 Jn 3:14-18");
    expect(normaliseCitation("Jn 16:13a, 14:26d")).toBe("Jn 16:13a; 14:26d");
    expect(normaliseCitation("Col1:1-8")).toBe("Col 1:1-8");
  });

  it("everything it emits parses with the citation parser", () => {
    for (const raw of [
      "Isa 2:1-5",
      "Ps 97:1+2b, 6+7c, 9",
      "Matt 26:14 – 27:66",
      "Esth C:12, 14-16, 23-25",
      "Rev 11:19a; 12:1-6a; 10ab",
    ]) {
      const normalised = normaliseCitation(raw);
      expect(normalised, raw).not.toBeNull();
      expect(parseCitation(normalised as string), normalised as string).not.toBeNull();
    }
  });

  it("returns null rather than guessing at prose", () => {
    expect(normaliseCitation("the reading from Year A")).toBeNull();
    expect(normaliseCitation("Sirarch 5:1-8")).toBeNull();
  });

  it("strips the editorial apparatus", () => {
    expect(stripAnnotations("Eph 4:1-7, 11-13 (#722.8)")).toBe("Eph 4:1-7, 11-13");
    expect(stripAnnotations("Matt 4:1-11 – Temptation")).toBe("Matt 4:1-11");
    expect(stripAnnotations("Matt 14:13-21 or, in Year A, Matt 14:22-36")).toBe(
      "Matt 14:13-21 or Matt 14:22-36",
    );
    expect(isEmptyCitationCell("[ no bibl. ref. ]")).toBe(true);
    expect(isEmptyCitationCell("x")).toBe(true);
  });

  it("splits a cell that gives one citation per Sunday cycle", () => {
    expect(splitByCycle("A: Matt 17:1-9 B: Mark 9:2-10 C: Luke 9:28b-36")).toEqual([
      { cycle: "A", text: "Matt 17:1-9" },
      { cycle: "B", text: "Mark 9:2-10" },
      { cycle: "C", text: "Luke 9:28b-36" },
    ]);
    const vigil = normaliseCell(
      "Gospels for Years A, B, C: A) Matt 28:1-10 B) Mark 16:1-7 ( diff ) C) Luke 24:1-12",
    );
    expect(vigil.unparsed).toEqual([]);
    expect(vigil.citations).toEqual([
      { cycle: "A", citation: "Mt 28:1-10" },
      { cycle: "B", citation: "Mk 16:1-7" },
      { cycle: "C", citation: "Lk 24:1-12" },
    ]);
  });

  it("skips the Easter Vigil's enumerated choice sets instead of failing on them", () => {
    const result = normaliseCell("1) Gen 1:1—2:2 or 1, 26-31a 2) Gen 22:1-18 3) Exod 14:15—15:1");
    expect(result.citations).toEqual([]);
    expect(result.unparsed).toEqual([]);
  });
});

describe("catholic-resources page parser", () => {
  it("reads a Sunday table into cycle-tagged entries", () => {
    const { entries, unparsed } = parseCatholicResourcesPage(SUNDAY_PAGE, "sunday");
    expect(unparsed).toEqual([]);
    expect(entries).toHaveLength(2);
    const advent = entries[0];
    expect(advent).toMatchObject({ number: "1", cycle: "A", kind: "sunday", variant: null });
    expect(advent.label).toBe("1st Sunday of Advent - A");
    expect(advent.sections.map((s) => `${s.kind}:${s.citation}`)).toEqual([
      "FIRST_READING:Is 2:1-5",
      "PSALM:Ps 122:1-2, 3-4a, 4b-5, 6-7, 8-9",
      "SECOND_READING:Rom 13:11-14",
      "ACCLAMATION:Ps 85:8",
      "GOSPEL:Mt 24:37-44",
    ]);
    // The pericope title is dropped, the long/short forms are kept as alternatives.
    // Every alternative repeats its book: the sources are inconsistent about it.
    expect(entries[1].sections.at(-1)?.citation).toBe("Jn 4:5-42 or Jn 4:5-15, 19b-26, 39a, 40-42");
  });

  it("carries the Year I / Year II column onto the section", () => {
    const { entries } = parseCatholicResourcesPage(WEEKDAY_PAGE, "weekday");
    const week1 = entries.find((e) => e.number === "305");
    expect(week1?.sections.find((s) => s.kind === "FIRST_READING")).toEqual({
      kind: "FIRST_READING",
      cycle: "I",
      citation: "Heb 1:1-6",
    });
    expect(week1?.sections.find((s) => s.kind === "GOSPEL")?.cycle).toBeNull();
  });

  it("drops the cells that only cross-reference another table", () => {
    const advent = parseCatholicResourcesPage(WEEKDAY_PAGE, "weekday").entries.find(
      (e) => e.number === "186",
    );
    expect(advent?.sections.some((s) => s.kind === "ACCLAMATION")).toBe(false);
    expect(advent?.sections.at(-1)?.citation).toBe("Mt 17:9a, 10-13");
  });

  it("reads the number, cycle, variant and date out of a row", () => {
    expect(cleanLectionaryNumber("187*")).toBe("187");
    expect(cleanLectionaryNumber("697 17")).toBe("697");
    expect(cleanLectionaryNumber("510/1")).toBe("510/1");
    expect(cleanLectionaryNumber("[18]")).toBeNull();
    expect(labelCycle("1st Sunday of Advent - A")).toBe("A");
    expect(labelCycle("Christmas: Mass during the Day - ABC")).toBeNull();
    expect(labelVariant("The Nativity of the Lord: At the Vigil Mass - ABC")).toBe("vigil");
    expect(labelVariant("Christmas: Mass at Dawn - ABC")).toBe("dawn");
    expect(labelMonthDay("Dec. 26 – Feast of St. Stephen")).toBe("12-26");
    expect(labelMonthDay("Jan. 2")).toBe("01-02");
  });
});

describe("day label → engine key", () => {
  it("maps the temporal labels the dated sources never showed", () => {
    expect(keyFromCatholicResourcesLabel("3rd Week of Advent – Fri", "weekday")).toBe(
      "advent-3-friday",
    );
    expect(keyFromCatholicResourcesLabel("Week 9 - Tues", "weekday")).toBe("ordinary-9-tuesday");
    expect(keyFromCatholicResourcesLabel("9th Sunday in Ordinary Time - C", "sunday")).toBe(
      "ordinary-9-sunday",
    );
    expect(keyFromCatholicResourcesLabel("Octave of Easter - Mon", "weekday")).toBe(
      "easter-octave-monday",
    );
    expect(keyFromCatholicResourcesLabel("Thursday after Ash Wed.", "weekday")).toBe(
      "after-ashes-thursday",
    );
    expect(keyFromCatholicResourcesLabel("Monday after Epiphany ( Jan. 4, 2027 )", "weekday")).toBe(
      "after-epiphany-monday",
    );
    expect(keyFromCatholicResourcesLabel("December 17 (Thursday in 2026)", "weekday")).toBe(
      "advent-1217",
    );
    expect(keyFromCatholicResourcesLabel("Dec. 26 – Feast of St. Stephen", "weekday")).toBe(
      "st-stephen",
    );
    // A named solemnity wins over the week ordinal in its own label.
    expect(
      keyFromCatholicResourcesLabel(
        "34th or Last Sunday in Ordinary Time - A: Solemnity of Our Lord Jesus Christ the King",
        "sunday",
      ),
    ).toBe("christ-the-king");
    expect(
      keyFromCatholicResourcesLabel(
        "Sunday after Pentecost : Solemnity of the Most Holy Trinity - A",
        "sunday",
      ),
    ).toBe("trinity-sunday");
  });

  it("leaves the Proper of Saints to the dated join", () => {
    expect(keyFromCatholicResourcesLabel("Jan. 2", "sanctoral")).toBeNull();
  });
});

describe("readings dataset parser", () => {
  const RAW = {
    "2026-04-05": [
      {
        date: "2026-04-05",
        lectionary_number: 42,
        feast: "Easter Sunday",
        mass: "default",
        readings: {
          first_reading: [{ citation: "Acts 10:34a, 37-43", sources: ["USCCB"] }],
          responsorial_psalm: [{ citation: "Psalm 118:1-2, 16-17, 22-23", sources: ["USCCB"] }],
          second_reading: [
            { citation: "Colossians 3:1-4", sources: ["USCCB"] },
            { citation: "1 Corinthians 5:6b-8", sources: ["USCCB"] },
            { citation: "Made up 1:1", sources: ["CatholicOnline"] },
          ],
          alleluia: [{ citation: "cf. 1 Corinthians 5:7", sources: ["USCCB"] }],
          gospel: [{ citation: "John 20:1-9", sources: ["USCCB"] }],
        },
      },
    ],
    "2026-01-06": [
      {
        date: "2026-01-06",
        lectionary_number: 212,
        feast: "Christmas Weekday",
        mass: "default",
        readings: {
          first_reading: [{ citation: "Isaiah 61:1 (cited in Lk 4:18)", sources: ["USCCB"] }],
        },
      },
    ],
  };

  it("joins the alternatives back into one citation and prefers the USCCB rows", () => {
    const { days, unparsed } = parseWesthong(RAW);
    expect(unparsed).toEqual([]);
    const easter = days.get("2026-04-05")?.[0];
    expect(easter?.number).toBe("42");
    expect(easter?.sections).toEqual([
      { kind: "FIRST_READING", citation: "Acts 10:34a, 37-43" },
      { kind: "PSALM", citation: "Ps 118:1-2, 16-17, 22-23" },
      { kind: "SECOND_READING", citation: "Col 3:1-4 or 1 Cor 5:6b-8" },
      { kind: "ACCLAMATION", citation: "cf. 1 Cor 5:7" },
      { kind: "GOSPEL", citation: "Jn 20:1-9" },
    ]);
  });

  it("strips the pages' editorial notes", () => {
    const { days } = parseWesthong(RAW);
    expect(days.get("2026-01-06")?.[0].sections[0].citation).toBe("Is 61:1");
  });

  it("ignores anything that is not a dated array", () => {
    expect(parseWesthong({ nonsense: 1, "2026-13-45": [] }).days.size).toBe(0);
    expect(parseWesthong(null).days.size).toBe(0);
  });
});

describe("USCCB calendar parser", () => {
  const CALENDAR = [
    "NOVEMBER–DECEMBER 2025",
    "30 SUN FIRST SUNDAY OF ADVENT violet",
    "Is 2:1-5/Rom 13:11-14/Mt 24:37-44 (1) Pss I",
    "1 Mon Advent Weekday violet",
    "Is 4:2-6 (second choice)/Mt 8:5-11 (175)",
    "25 Thu THE NATIVITY OF THE LORD (Christmas) white",
    "Solemnity [Holyday of Obligation]",
    "Vigil: Is 62:1-5/Acts 13:16-17, 22-25/Mt 1:1-25 or 1:18-25 (13)",
    "Day: Is 52:7-10/Heb 1:1-6/Jn 1:1-18 or 1:1-5, 9-14 (16) Pss Prop",
    "26 Fri Saint Stephen, The First Martyr red",
    "Feast",
    "Acts 6:8-10; 7:54-59/Mt 10:17-22 (696) Pss Prop",
    "6 The following readings may be used on any day this week: Mi 7:7-9/Jn 9:1-41 (243).",
  ].join("\n");

  it("dates every day and reads its Lectionary numbers", () => {
    const { days, warnings } = parseUsccbCalendar(CALENDAR);
    expect(warnings).toEqual([]);
    expect(days.get("2025-11-30")?.masses[0]).toMatchObject({ number: "1", variant: null });
    // The month rolls forward when the day number goes backwards.
    expect(days.get("2025-12-01")?.masses[0].number).toBe("175");
    expect(days.get("2025-12-26")?.celebration).toContain("Saint Stephen");
  });

  it("keeps each Christmas formulary apart", () => {
    const christmas = parseUsccbCalendar(CALENDAR).days.get("2025-12-25");
    expect(christmas?.masses.map((m) => `${m.variant}:${m.number}`)).toEqual([
      "vigil:13",
      "day:16",
    ]);
    expect(christmas?.masses[1].sections).toEqual([
      { kind: "FIRST_READING", citation: "Is 52:7-10" },
      { kind: "SECOND_READING", citation: "Heb 1:1-6" },
      { kind: "GOSPEL", citation: "Jn 1:1-18 or Jn 1:1-5, 9-14" },
    ]);
  });

  it("never files a footnote's Lectionary number under the day it follows", () => {
    const stephen = parseUsccbCalendar(CALENDAR).days.get("2025-12-26");
    expect(stephen?.masses.map((m) => m.number)).toEqual(["696"]);
  });

  it("warns instead of guessing when the printed weekday does not match", () => {
    const { warnings } = parseUsccbCalendar(
      ["JANUARY 2026", "1 SUN New Year white", "Nm 6:22-27/Gal 4:4-7/Lk 2:16-21 (18)"].join("\n"),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("2026-01-01");
  });
});
