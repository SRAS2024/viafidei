/**
 * What the readings page resolves for a date, against the USCCB. Each row below
 * was copied from the printed Liturgical Calendar for the Dioceses of the United
 * States of America (2026, 2027, 2028) or the USCCB daily readings page of the date,
 * so these are facts about the Lectionary, not read back from the tables.
 *
 * The rows concentrate on what the first version of the tables got wrong:
 *   - the Ordinary-Time weekday psalm, which differs by Year I and Year II;
 *   - weekday Gospels that change with the Sunday cycle;
 *   - memorials that own only part of their Mass;
 *   - a memorial's Gospel leaking into the weekday it once fell on;
 *   - Vigils, and readings that are an "or" rather than a replacement.
 */

import { describe, expect, it } from "vitest";

import { resolveDayReadings } from "@/lib/content-shared/lectionary";
import { resolveLiturgicalDay } from "@/lib/content-shared/liturgical-calendar";

const D = (iso: string) => new Date(`${iso}T00:00:00Z`);

function readings(iso: string, variant?: string) {
  return resolveDayReadings(resolveLiturgicalDay(D(iso)), variant ? { variant } : {});
}

function citation(iso: string, kind: string, variant?: string) {
  return readings(iso, variant)?.sections.find((s) => s.kind === kind)?.citation;
}

describe("Ordinary-Time weekdays read the psalm of their own year", () => {
  it.each([
    // Year II (2026)
    ["2026-01-12", "Ps 116:12-13, 14-17, 18-19"],
    ["2026-07-21", "Ps 85:2-4, 5-6, 7-8"],
    ["2026-10-05", "Ps 111:1b-2, 7-8, 9 and 10c"],
    ["2026-11-07", "Ps 112:1b-2, 5-6, 8a and 9"],
    ["2026-11-23", "Ps 24:1bc-2, 3-4ab, 5-6"],
    // Year I (2027)
    ["2027-01-11", "Ps 97:1 and 2b, 6 and 7c, 9"],
    ["2027-11-06", "Ps 145:2-3, 4-5, 10-11"],
    ["2027-11-22", "Dn 3:52, 53, 54, 55, 56"],
  ])("%s", (iso, psalm) => {
    expect(citation(iso, "PSALM")).toBe(psalm);
  });

  it("never cites a verse the chapter does not have, so the text is shown", () => {
    // These once read "-22" for "-20" and the chapter ends at 20.
    expect(citation("2026-07-21", "FIRST_READING")).toBe("Mi 7:14-15, 18-20");
    expect(citation("2026-10-29", "FIRST_READING")).toBe("Eph 6:10-20");
    expect(citation("2026-11-12", "FIRST_READING")).toBe("Phlm 7-20");
    expect(readings("2026-07-21")?.sections[0].body).toMatch(/Micheas|shepherd|people/i);
  });
});

describe("weekday Gospels that change with the Sunday cycle", () => {
  it("the 18th Monday reads on from the Sunday in Year A", () => {
    expect(citation("2026-08-03", "GOSPEL")).toBe("Mt 14:22-36"); // Year A
    expect(citation("2027-08-02", "GOSPEL")).toBe("Mt 14:13-21"); // Year B
    expect(citation("2028-08-07", "GOSPEL")).toBe("Mt 14:13-21"); // Year C
  });

  it("the 4th Monday of Easter", () => {
    expect(citation("2026-04-27", "GOSPEL")).toBe("Jn 10:11-18"); // Year A
    expect(citation("2027-04-19", "GOSPEL")).toBe("Jn 10:1-10"); // Year B
    expect(citation("2028-05-08", "GOSPEL")).toBe("Jn 10:1-10"); // Year C
  });

  it("the 5th Monday of Lent", () => {
    expect(citation("2026-03-23", "GOSPEL")).toBe("Jn 8:1-11"); // Year A
    expect(citation("2027-03-15", "GOSPEL")).toBe("Jn 8:1-11"); // Year B
    expect(citation("2028-04-03", "GOSPEL")).toBe("Jn 8:12-20"); // Year C
  });

  it("the 1st Monday of Advent", () => {
    expect(citation("2026-11-30", "FIRST_READING")).toBe("Rom 10:9-18"); // Saint Andrew that year
    expect(citation("2027-11-29", "FIRST_READING")).toBe("Is 2:1-5"); // Year C
    expect(citation("2028-12-04", "FIRST_READING")).toBe("Is 4:2-6"); // Year A
  });
});

describe("a memorial's own readings beside the weekday's", () => {
  it.each([
    // [date, number, first reading, psalm, gospel]: first reading and psalm of the
    // weekday, Gospel of the memorial, as the USCCB prints them.
    [
      "2026-07-29",
      "403/607",
      "Jer 15:10, 16-21",
      "Ps 59:2-3, 4, 10-11, 17, 18",
      "Jn 11:19-27 or Lk 10:38-42",
    ],
    ["2026-08-29", "430/634", "1 Cor 1:26-31", "Ps 33:12-13, 18-19, 20-21", "Mk 6:17-29"],
    [
      "2026-09-15",
      "444/639",
      "1 Cor 12:12-14, 27-31a",
      "Ps 100:1b-2, 3, 4, 5",
      "Jn 19:25-27 or Lk 2:33-35",
    ],
    [
      "2026-10-02",
      "459/650",
      "Jb 38:1, 12-21; 40:3-5",
      "Ps 139:1-3, 7-8, 9-10, 13-14ab",
      "Mt 18:1-5, 10",
    ],
  ])(
    "%s, its first reading the weekday's and its Gospel its own",
    (iso, number, first, psalm, gospel) => {
      const r = readings(iso);
      expect(r?.number).toBe(number);
      expect(citation(iso, "FIRST_READING")).toBe(first);
      expect(citation(iso, "PSALM")).toBe(psalm);
      expect(citation(iso, "GOSPEL")).toBe(gospel);
    },
  );

  it.each([
    // First reading and psalm of the memorial, Gospel of the weekday.
    ["2026-06-11", "580/362", "Acts 11:21b-26; 13:1-3", "Mt 5:20-26"],
    ["2027-06-11", "580/363", "Acts 11:21b-26; 13:1-3", "Mt 5:27-32"],
    ["2026-01-26", "520/317", "2 Tm 1:1-8 or Ti 1:1-5", "Mk 3:22-30"],
    ["2027-01-26", "520/318", "2 Tm 1:1-8 or Ti 1:1-5", "Mk 3:31-35"],
  ])("%s, its first reading its own and its Gospel the weekday's", (iso, number, first, gospel) => {
    expect(readings(iso)?.number).toBe(number);
    expect(citation(iso, "FIRST_READING")).toBe(first);
    expect(citation(iso, "GOSPEL")).toBe(gospel);
  });

  it("Mary, Mother of the Church has a formulary of her own, and the Visitation keeps hers", () => {
    expect(readings("2026-05-25")?.number).toBe("572A");
    expect(citation("2026-05-25", "FIRST_READING")).toBe("Gn 3:9-15, 20 or Acts 1:12-14");
    expect(citation("2026-05-25", "PSALM")).toBe("Ps 87:1-2, 3 and 5, 6-7");
    expect(citation("2026-05-25", "GOSPEL")).toBe("Jn 19:25-34");

    expect(readings("2027-05-31")?.number).toBe("572");
    expect(citation("2027-05-31", "FIRST_READING")).toBe("Zep 3:14-18a or Rom 12:9-16");
    expect(citation("2027-05-31", "GOSPEL")).toBe("Lk 1:39-56");
  });

  it("a memorial's Gospel does not stay behind on the weekday it fell on", () => {
    // Saturday of the 16th week: Saint Martha fell on it in 2023 and 2028.
    expect(citation("2027-07-24", "GOSPEL")).toBe("Mt 13:24-30");
    // Saturday of the 9th week: the Immaculate Heart fell on it in 2024.
    expect(citation("2026-06-06", "GOSPEL")).toBe("Mk 12:38-44");
    // A collision makes it a plain weekday: 5 June 2027.
    expect(citation("2027-06-05", "GOSPEL")).toBe("Mk 12:38-44");
  });
});

describe("the great days", () => {
  it("Palm Sunday reads the Passion at its Mass", () => {
    expect(readings("2027-03-21")?.number).toBe("38");
    expect(citation("2027-03-21", "GOSPEL")).toBe("Mk 14:1—15:47 or Mk 15:1-39");
    expect(citation("2027-03-21", "GOSPEL", "procession")).toBe("Mk 11:1-10 or Jn 12:12-16");
  });

  it("the Easter Vigil is whole, with the year's Gospel", () => {
    const vigil = readings("2027-03-27");
    expect(vigil?.number).toBe("41");
    const citations = vigil?.sections.map((s) => s.citation) ?? [];
    for (const expected of [
      "Gn 1:1—2:2 or Gn 1:1, 26-31a",
      "Gn 22:1-18 or Gn 22:1-2, 9a, 10-13, 15-18",
      "Ex 14:15—15:1",
      "Is 54:5-14",
      "Is 55:1-11",
      "Bar 3:9-15, 32—4:4",
      "Ez 36:16-17a, 18-28",
      "Rom 6:3-11",
      "Mk 16:1-7",
    ]) {
      expect(citations).toContain(expected);
    }
  });

  it("Easter Sunday offers John, the Vigil's Gospel of the year, and Emmaus", () => {
    expect(citation("2026-04-05", "GOSPEL")).toBe("Jn 20:1-9 or Mt 28:1-10 or Lk 24:13-35");
    expect(citation("2027-03-28", "GOSPEL")).toBe("Jn 20:1-9 or Mk 16:1-7 or Lk 24:13-35");
    expect(citation("2028-04-16", "GOSPEL")).toBe("Jn 20:1-9 or Lk 24:1-12 or Lk 24:13-35");
  });

  it("the Holy Family and the Baptism read the shared readings first", () => {
    expect(citation("2026-12-27", "FIRST_READING")).toBe("Sir 3:2-6, 12-14 or Gn 15:1-6; 21:1-3");
    expect(citation("2026-12-27", "GOSPEL")).toBe("Lk 2:22-40 or Lk 2:22, 39-40");
    expect(citation("2027-01-10", "FIRST_READING")).toBe("Is 42:1-4, 6-7 or Is 55:1-11");
    expect(citation("2027-01-10", "GOSPEL")).toBe("Mk 1:7-11");
  });

  it("the Ascension and Pentecost keep the readings every year may use", () => {
    expect(citation("2027-05-09", "SECOND_READING")).toBe(
      "Eph 1:17-23 or Eph 4:1-13 or Eph 4:1-7, 11-13",
    );
    expect(citation("2026-05-24", "SECOND_READING")).toBe("1 Cor 12:3b-7, 12-13");
    expect(citation("2027-05-16", "SECOND_READING")).toBe("1 Cor 12:3b-7, 12-13 or Gal 5:16-25");
    expect(citation("2027-05-16", "GOSPEL")).toBe("Jn 20:19-23 or Jn 15:26-27; 16:12-15");
  });

  it("the Vigils of John the Baptist and of Peter and Paul have their own readings", () => {
    expect(citation("2026-06-24", "FIRST_READING", "vigil")).toBe("Jer 1:4-10");
    expect(citation("2026-06-24", "PSALM", "vigil")).toBe("Ps 71:1-2, 3-4a, 5-6ab, 15ab and 17");
    expect(citation("2026-06-24", "FIRST_READING")).toBe("Is 49:1-6");
    expect(citation("2026-06-29", "FIRST_READING", "vigil")).toBe("Acts 3:1-10");
    expect(citation("2026-06-29", "SECOND_READING", "vigil")).toBe("Gal 1:11-20");
    expect(citation("2026-06-29", "FIRST_READING")).toBe("Acts 12:1-11");
  });

  it("the Scrutiny readings stay an option in Years B and C on all three Sundays", () => {
    for (const iso of ["2027-02-28", "2027-03-07", "2027-03-14", "2028-03-26"]) {
      expect(
        readings(iso)?.masses.map((m) => m.variant),
        iso,
      ).toEqual([null, "year-a"]);
    }
  });

  it("All Souls offers both second readings", () => {
    expect(citation("2026-11-02", "SECOND_READING")).toBe("Rom 5:5-11 or Rom 6:3-9");
    expect(citation("2026-11-02", "GOSPEL")).toBe("Jn 6:37-40");
  });
});

describe("whole days, as the USCCB prints them", () => {
  it.each([
    ["2026-11-08", "154", "Wis 6:12-16", "1 Thes 4:13-18 or 1 Thes 4:13-14", "Mt 25:1-13"],
    ["2026-11-29", "2", "Is 63:16b-17, 19b; 64:2-7", "1 Cor 1:3-9", "Mk 13:33-37"],
    ["2026-12-08", "689", "Gn 3:9-15, 20", "Eph 1:3-6, 11-12", "Lk 1:26-38"],
    ["2026-11-01", "667", "Rv 7:2-4, 9-14", "1 Jn 3:1-3", "Mt 5:1-12a"],
    ["2027-01-03", "20", "Is 60:1-6", "Eph 3:2-3a, 5-6", "Mt 2:1-12"],
    ["2027-08-15", "622", "Rv 11:19a; 12:1-6a, 10ab", "1 Cor 15:20-27", "Lk 1:39-56"],
  ])("%s", (iso, number, first, second, gospel) => {
    expect(readings(iso)?.number).toBe(number);
    expect(citation(iso, "FIRST_READING")).toBe(first);
    expect(citation(iso, "SECOND_READING")).toBe(second);
    expect(citation(iso, "GOSPEL")).toBe(gospel);
  });
});
