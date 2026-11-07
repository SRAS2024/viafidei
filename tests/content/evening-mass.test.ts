/**
 * The evening Mass a date offers, for dates across 2026 to 2028. Every expected
 * answer here was reasoned out from the rules and checked against the printed USCCB
 * calendars, not read back from the code:
 *   - a Saturday evening is Sunday's, even when the Saturday is itself a solemnity
 *     or a feast (can. 1248 §1), and a solemnity on the Sunday replaces it;
 *   - any other evening anticipates only a holy day or a solemnity with its own
 *     Vigil readings, and only if that day outranks this one (UNLY 61);
 *   - Holy Saturday has nothing to choose between: the Easter Vigil is its Mass.
 *
 * Easter 2026-04-05, 2027-03-28, 2028-04-16. Advent 2026-11-29 (Year B), 2027-11-28
 * (Year C), 2028-12-03 (Year A).
 */

import { describe, expect, it } from "vitest";

import { resolveDayReadings } from "@/lib/content-shared/lectionary";
import {
  eveningMass,
  liturgicalColorLabel,
  liturgicalObligationLabel,
  liturgicalRankLabel,
  resolveLiturgicalDay,
} from "@/lib/content-shared/liturgical-calendar";

const D = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** The Lectionary number the Vigil reads: its own formulary, or the next day's Mass. */
function vigilNumber(iso: string): string | null {
  const evening = eveningMass(D(iso));
  if (!evening) return null;
  return (
    resolveDayReadings(evening.next, evening.ownReadings ? { variant: "vigil" } : {})?.number ??
    null
  );
}

describe("a Saturday evening anticipates Sunday", () => {
  // [Saturday, the Sunday's celebration, title, label, Lectionary number]
  it.each([
    [
      "2026-11-07",
      "32nd Sunday in Ordinary Time",
      "Vigil of the 32nd Sunday in Ordinary Time",
      "Sunday Vigil (Saturday evening)",
      "154",
    ],
    [
      "2026-11-14",
      "33rd Sunday in Ordinary Time",
      "Vigil of the 33rd Sunday in Ordinary Time",
      "Sunday Vigil (Saturday evening)",
      "157",
    ],
    [
      "2026-11-21",
      "Our Lord Jesus Christ, King of the Universe",
      "Vigil of Our Lord Jesus Christ, King of the Universe",
      "Christ the King Vigil (Saturday evening)",
      "160",
    ],
    [
      "2026-11-28",
      "1st Sunday of Advent",
      "Vigil of the 1st Sunday of Advent",
      "Sunday Vigil (Saturday evening)",
      "2",
    ],
    [
      "2026-12-19",
      "4th Sunday of Advent",
      "Vigil of the 4th Sunday of Advent",
      "Sunday Vigil (Saturday evening)",
      "11",
    ],
    [
      "2027-01-02",
      "The Epiphany of the Lord",
      "Vigil of the Epiphany of the Lord",
      "Epiphany Vigil (Saturday evening)",
      "20",
    ],
    [
      "2027-01-09",
      "The Baptism of the Lord",
      "Vigil of the Baptism of the Lord",
      "Baptism of the Lord Vigil (Saturday evening)",
      "21",
    ],
    [
      "2027-02-13",
      "1st Sunday of Lent",
      "Vigil of the 1st Sunday of Lent",
      "Sunday Vigil (Saturday evening)",
      "23",
    ],
    [
      "2027-03-20",
      "Palm Sunday of the Passion of the Lord",
      "Vigil of Palm Sunday of the Passion of the Lord",
      "Palm Sunday Vigil (Saturday evening)",
      "38",
    ],
    [
      "2027-05-08",
      "The Ascension of the Lord",
      "Vigil of the Ascension of the Lord",
      "Ascension Vigil (Saturday evening)",
      "58",
    ],
    [
      "2027-05-22",
      "The Most Holy Trinity",
      "Vigil of the Most Holy Trinity",
      "Trinity Sunday Vigil (Saturday evening)",
      "165",
    ],
    [
      "2027-05-29",
      "The Most Holy Body and Blood of Christ",
      "Vigil of the Most Holy Body and Blood of Christ",
      "Corpus Christi Vigil (Saturday evening)",
      "168",
    ],
    [
      "2028-07-29",
      "17th Sunday in Ordinary Time",
      "Vigil of the 17th Sunday in Ordinary Time",
      "Sunday Vigil (Saturday evening)",
      "111",
    ],
    [
      "2028-12-02",
      "1st Sunday of Advent",
      "Vigil of the 1st Sunday of Advent",
      "Sunday Vigil (Saturday evening)",
      "1",
    ],
    [
      "2028-12-23",
      "4th Sunday of Advent",
      "Vigil of the 4th Sunday of Advent",
      "Sunday Vigil (Saturday evening)",
      "10",
    ],
  ])("%s → %s", (iso, celebration, title, label, number) => {
    const evening = eveningMass(D(iso));
    expect(evening?.next.celebration).toBe(celebration);
    expect(evening?.title).toBe(title);
    expect(evening?.label).toBe(label);
    expect(evening?.dayLabel).toBe("Saturday Mass");
    expect(evening?.ownReadings).toBe(false);
    expect(vigilNumber(iso)).toBe(number);
  });

  it("reads the next day's cycle, which a Saturday before Advent does not share", () => {
    const saturday = resolveLiturgicalDay(D("2026-11-28"));
    expect(saturday.sundayCycle).toBe("A");
    expect(saturday.weekdayCycle).toBe("II");
    const vigil = eveningMass(D("2026-11-28"))?.next;
    expect(vigil?.sundayCycle).toBe("B");
    expect(vigil?.weekdayCycle).toBe("I");
  });

  it("carries the next day's colour: rose on the eve of Gaudete and Laetare", () => {
    expect(eveningMass(D("2026-12-12"))?.next.color).toBe("Rose");
    expect(eveningMass(D("2027-03-06"))?.next.color).toBe("Rose");
    expect(eveningMass(D("2027-03-13"))?.next.color).toBe("Violet");
  });
});

describe("a Saturday that is itself a solemnity or feast: the evening is still Sunday's", () => {
  it.each([
    // [Saturday, its own daytime celebration, the Sunday the evening anticipates, number]
    ["2026-08-15", "assumption", "20th Sunday in Ordinary Time", "118"],
    ["2026-12-12", "our-lady-of-guadalupe", "3rd Sunday of Advent", "8"],
    ["2026-12-26", "st-stephen", "The Holy Family of Jesus, Mary and Joseph", "17"],
    ["2027-12-25", "nativity", "The Holy Family of Jesus, Mary and Joseph", "17"],
    ["2028-01-01", "mary-mother-of-god", "The Epiphany of the Lord", "20"],
    ["2028-03-25", "annunciation", "4th Sunday of Lent", "33"],
    ["2028-06-24", "nativity-of-john-the-baptist", "12th Sunday in Ordinary Time", "96"],
  ])("%s (%s) → %s", (iso, ownKey, celebration, number) => {
    expect(resolveLiturgicalDay(D(iso)).lectionaryKey).toBe(ownKey);
    const evening = eveningMass(D(iso));
    expect(evening?.next.celebration).toBe(celebration);
    expect(vigilNumber(iso)).toBe(number);
  });

  it("keeps the day's Mass as the day's on an Easter octave Saturday", () => {
    expect(resolveLiturgicalDay(D("2027-04-03")).temporalKey).toBe("easter-octave-saturday");
    expect(eveningMass(D("2027-04-03"))?.title).toBe(
      "Vigil of the 2nd Sunday of Easter (Divine Mercy)",
    );
    expect(vigilNumber("2027-04-03")).toBe("44");
  });
});

describe("a solemnity or feast on the Sunday replaces it, and the evening reads its Mass", () => {
  it.each([
    [
      "2026-10-31",
      "All Saints",
      "Vigil of All Saints",
      "All Saints Vigil (Saturday evening)",
      "667",
    ],
    [
      "2028-08-05",
      "The Transfiguration of the Lord",
      "Vigil of the Transfiguration of the Lord",
      "Sunday Vigil (Saturday evening)",
      "614",
    ],
  ])("%s → %s", (iso, celebration, title, label, number) => {
    const evening = eveningMass(D(iso));
    expect(evening?.next.celebration).toBe(celebration);
    expect(evening?.title).toBe(title);
    expect(evening?.label).toBe(label);
    expect(evening?.ownReadings).toBe(false);
    expect(vigilNumber(iso)).toBe(number);
  });
});

describe("a Vigil with readings of its own in the Lectionary uses them", () => {
  it.each([
    ["2026-12-24", "Thursday Mass", "Christmas Vigil (Thursday evening)", "13", "Is 62:1-5"],
    ["2027-12-24", "Friday Mass", "Christmas Vigil (Friday evening)", "13", "Is 62:1-5"],
    // The 4th Sunday of Advent keeps the day; its evening is still Christmas.
    ["2028-12-24", "Sunday Mass", "Christmas Vigil (Sunday evening)", "13", "Is 62:1-5"],
    ["2026-05-23", "Saturday Mass", "Pentecost Vigil (Saturday evening)", "62", "Gn 11:1-9"],
    ["2027-05-15", "Saturday Mass", "Pentecost Vigil (Saturday evening)", "62", "Gn 11:1-9"],
    ["2028-06-03", "Saturday Mass", "Pentecost Vigil (Saturday evening)", "62", "Gn 11:1-9"],
    ["2026-08-14", "Friday Mass", "Assumption Vigil (Friday evening)", "621", "1 Chr 15:3-4"],
    ["2027-08-14", "Saturday Mass", "Assumption Vigil (Saturday evening)", "621", "1 Chr 15:3-4"],
    ["2028-08-14", "Monday Mass", "Assumption Vigil (Monday evening)", "621", "1 Chr 15:3-4"],
    [
      "2026-06-23",
      "Tuesday Mass",
      "Saint John the Baptist Vigil (Tuesday evening)",
      "586",
      "Jer 1:4-10",
    ],
    [
      "2027-06-23",
      "Wednesday Mass",
      "Saint John the Baptist Vigil (Wednesday evening)",
      "586",
      "Jer 1:4-10",
    ],
    // The 13th Sunday in Ordinary Time gives way: a solemnity outranks it.
    [
      "2026-06-28",
      "Sunday Mass",
      "Saints Peter and Paul Vigil (Sunday evening)",
      "590",
      "Acts 3:1-10",
    ],
    [
      "2027-06-28",
      "Monday Mass",
      "Saints Peter and Paul Vigil (Monday evening)",
      "590",
      "Acts 3:1-10",
    ],
  ])("%s", (iso, dayLabel, label, number, firstReading) => {
    const evening = eveningMass(D(iso));
    expect(evening?.dayLabel).toBe(dayLabel);
    expect(evening?.label).toBe(label);
    expect(evening?.ownReadings).toBe(true);
    const readings = resolveDayReadings(evening!.next, { variant: "vigil" });
    expect(readings?.number).toBe(number);
    expect(readings?.sections[0].citation.startsWith(firstReading)).toBe(true);
  });

  it("titles those Vigils after the celebration", () => {
    expect(eveningMass(D("2026-12-24"))?.title).toBe("Vigil of the Nativity of the Lord");
    expect(eveningMass(D("2027-05-15"))?.title).toBe("Vigil of Pentecost Sunday");
    expect(eveningMass(D("2026-08-14"))?.title).toBe(
      "Vigil of the Assumption of the Blessed Virgin Mary",
    );
    expect(eveningMass(D("2026-06-28"))?.title).toBe("Vigil of Saints Peter and Paul, Apostles");
  });
});

describe("the evening before a holy day", () => {
  it.each([
    ["2026-12-07", "Immaculate Conception Vigil (Monday evening)", "689"],
    ["2027-12-07", "Immaculate Conception Vigil (Tuesday evening)", "689"],
    ["2028-12-07", "Immaculate Conception Vigil (Thursday evening)", "689"],
    ["2026-12-31", "Mary, Mother of God Vigil (Thursday evening)", "18"],
    ["2028-10-31", "All Saints Vigil (Tuesday evening)", "667"],
  ])("%s → %s", (iso, label, number) => {
    const evening = eveningMass(D(iso));
    expect(evening?.label).toBe(label);
    expect(evening?.ownReadings).toBe(false);
    expect(vigilNumber(iso)).toBe(number);
  });

  it("keeps a holy day's evening when the obligation is lifted, since it has not moved", () => {
    // Monday 1 Nov 2027 and Saturday 1 Jan 2028: no obligation, still the solemnity.
    expect(resolveLiturgicalDay(D("2027-11-01")).isHolyDayOfObligation).toBe(false);
    expect(eveningMass(D("2027-10-31"))?.label).toBe("All Saints Vigil (Sunday evening)");
    expect(resolveLiturgicalDay(D("2028-01-01")).isHolyDayOfObligation).toBe(false);
    expect(eveningMass(D("2027-12-31"))?.label).toBe("Mary, Mother of God Vigil (Friday evening)");
  });

  it("the Ascension on Thursday, where a province keeps it there", () => {
    const thursday = { calendar: "roman-us", ascensionOnThursday: true } as const;
    expect(eveningMass(D("2026-05-13"), thursday)?.label).toBe(
      "Ascension Vigil (Wednesday evening)",
    );
    expect(eveningMass(D("2026-05-13"))).toBeNull();
  });

  it("the general calendar's Epiphany on 6 January", () => {
    expect(eveningMass(D("2026-01-05"), { calendar: "roman-general" })?.label).toBe(
      "Epiphany Vigil (Monday evening)",
    );
  });
});

describe("no evening Mass to offer", () => {
  it.each([
    // Holy Saturday: the Easter Vigil is its one Mass.
    ["2026-04-04"],
    ["2027-03-27"],
    ["2028-04-15"],
    // The Triduum's other days lead to no anticipated Mass.
    ["2027-03-25"],
    ["2027-03-26"],
    // Ordinary weekdays.
    ["2026-11-06"],
    ["2026-11-09"],
    // Solemnities with neither an obligation nor Vigil readings: Saint Joseph, the
    // Annunciation, the Sacred Heart.
    ["2026-03-18"],
    ["2026-03-24"],
    ["2026-06-11"],
    // All Saints on a Sunday: the Monday after, All Souls, is no anticipated day.
    ["2026-11-01"],
    // Ash Wednesday's eve.
    ["2027-02-09"],
  ])("%s", (iso) => {
    expect(eveningMass(D(iso))).toBeNull();
  });

  it("a higher or equal rank keeps its own evening", () => {
    // Sunday 7 Dec 2025 and 2031: the 2nd Sunday of Advent outranks the Immaculate
    // Conception on the Monday, and in 2024 outranks its transfer to the Monday.
    expect(eveningMass(D("2025-12-07"))).toBeNull();
    expect(eveningMass(D("2031-12-07"))).toBeNull();
    expect(eveningMass(D("2024-12-08"))).toBeNull();
    // Friday 23 June 2028 is the Sacred Heart and the 24th John the Baptist. Equal
    // rank: the current day's Vespers prevail, so its evening stays the Sacred Heart.
    expect(resolveLiturgicalDay(D("2028-06-23")).lectionaryKey).toBe("sacred-heart");
    expect(eveningMass(D("2028-06-23"))).toBeNull();
  });
});

describe("the holy-day note the USCCB prints beside a rank", () => {
  const note = (iso: string) => liturgicalObligationLabel(resolveLiturgicalDay(D(iso)));

  it("names a holy day, and says so when a Saturday or Monday lifts the obligation", () => {
    expect(note("2026-12-08")).toBe("Holy day of obligation");
    expect(note("2026-12-25")).toBe("Holy day of obligation");
    expect(note("2027-01-01")).toBe("Holy day of obligation");
    expect(note("2028-11-01")).toBe("Holy day of obligation");
    expect(note("2026-08-15")).toBe("Not a holy day of obligation this year");
    expect(note("2027-11-01")).toBe("Not a holy day of obligation this year");
    expect(note("2028-01-01")).toBe("Not a holy day of obligation this year");
    // A Sunday needs no note, and an ordinary solemnity has no obligation to lift.
    expect(note("2026-11-01")).toBeNull();
    expect(note("2027-03-19")).toBeNull();
    expect(note("2026-11-07")).toBeNull();
  });
});

describe("colours and ranks as the calendar prints them", () => {
  const color = (iso: string) => liturgicalColorLabel(resolveLiturgicalDay(D(iso)));
  const rank = (iso: string) => liturgicalRankLabel(resolveLiturgicalDay(D(iso)));

  it("offers rose on Gaudete and Laetare, with violet beside it", () => {
    expect(color("2026-12-13")).toBe("Rose or violet");
    expect(color("2027-12-12")).toBe("Rose or violet");
    expect(color("2028-12-17")).toBe("Rose or violet");
    expect(color("2026-03-15")).toBe("Rose or violet");
    expect(color("2027-03-07")).toBe("Rose or violet");
    expect(color("2028-03-26")).toBe("Rose or violet");
    // The Sundays beside them are violet alone.
    expect(color("2026-12-06")).toBe("Violet");
    expect(color("2027-03-14")).toBe("Violet");
  });

  it("offers All Souls' three colours and the Day of Prayer's two", () => {
    expect(color("2026-11-02")).toBe("Violet, white or black");
    expect(color("2027-01-22")).toBe("White or violet");
  });

  it("does not print a rank the calendar does not give", () => {
    expect(rank("2027-03-25")).toBe("Paschal Triduum");
    expect(rank("2027-03-26")).toBe("Paschal Triduum");
    expect(rank("2027-03-27")).toBe("Paschal Triduum");
    expect(rank("2027-01-22")).toBe("Day of prayer");
    expect(rank("2027-03-28")).toBe("Solemnity");
    expect(rank("2026-11-02")).toBe("Commemoration");
    expect(rank("2026-11-07")).toBe("Weekday");
    expect(rank("2026-11-08")).toBe("Sunday");
    expect(rank("2026-07-22")).toBe("Feast");
    expect(rank("2026-12-07")).toBe("Memorial");
  });
});
