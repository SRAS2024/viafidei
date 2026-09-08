/**
 * The corroboration layer is the accuracy guardrail for automated ingestion of
 * doctrinally-sensitive facts. These tests pin the deterministic feast-day
 * parsing, the "is this date stated in the independent text" corroboration, and
 * the canonization-status mapping (which skips, never guesses, on the unknown).
 */
import { describe, expect, it } from "vitest";

import {
  feastDayInText,
  firstFeastInText,
  mapCanonizationStatus,
  monthName,
  parseFeastValue,
} from "@/lib/admin-worker/structured/corroboration";

describe("parseFeastValue", () => {
  it("parses a 'DD Month' calendar-date label", () => {
    expect(parseFeastValue({ label: "23 August" })).toEqual({
      feastDay: "08-23",
      feastMonth: 8,
      feastDayOfMonth: 23,
    });
  });

  it("parses a 'Month DD' label", () => {
    expect(parseFeastValue({ label: "August 23" })).toEqual({
      feastDay: "08-23",
      feastMonth: 8,
      feastDayOfMonth: 23,
    });
  });

  it("parses a date literal (ignoring the placeholder year)", () => {
    expect(parseFeastValue({ literal: "+0001-08-23T00:00:00Z" })).toEqual({
      feastDay: "08-23",
      feastMonth: 8,
      feastDayOfMonth: 23,
    });
    expect(parseFeastValue({ literal: "2000-11-01T00:00:00Z" })?.feastDay).toBe("11-01");
  });

  it("prefers a usable label over the literal", () => {
    expect(
      parseFeastValue({ label: "1 November", literal: "+0001-08-23T00:00:00Z" })?.feastDay,
    ).toBe("11-01");
  });

  it("returns null when nothing parses", () => {
    expect(parseFeastValue({})).toBeNull();
    expect(parseFeastValue({ label: "movable feast" })).toBeNull();
    expect(parseFeastValue({ literal: "http://www.wikidata.org/entity/Q2306" })).toBeNull();
  });
});

describe("feastDayInText (corroboration)", () => {
  it("matches 'Month DD' and 'DD Month' and ordinals", () => {
    expect(feastDayInText(8, 23, "Her feast is celebrated on August 23 each year.")).toBe(true);
    expect(feastDayInText(8, 23, "Celebrated on 23 August in the calendar.")).toBe(true);
    expect(feastDayInText(8, 23, "kept on August 23rd")).toBe(true);
  });

  it("does NOT match a different day, month, or empty text", () => {
    expect(feastDayInText(8, 23, "Her feast is August 24.")).toBe(false);
    expect(feastDayInText(8, 23, "Her feast is July 23.")).toBe(false);
    expect(feastDayInText(8, 23, "")).toBe(false);
  });
});

describe("mapCanonizationStatus", () => {
  it("maps known statuses (specific before broad)", () => {
    expect(mapCanonizationStatus("saint")).toBe("canonized");
    expect(mapCanonizationStatus("Blessed")).toBe("beatified");
    expect(mapCanonizationStatus("Venerable")).toBe("venerable");
    expect(mapCanonizationStatus("Servant of God")).toBe("servant_of_god");
  });

  it("returns null for an unknown label (skip, never guess)", () => {
    expect(mapCanonizationStatus("pope")).toBeNull();
    expect(mapCanonizationStatus("")).toBeNull();
  });
});

describe("monthName", () => {
  it("returns the English month name or empty", () => {
    expect(monthName(8)).toBe("August");
    expect(monthName(0)).toBe("");
    expect(monthName(13)).toBe("");
  });
});

/**
 * `firstFeastInText` exists because an infobox feast parameter LEADS with the
 * date the calendar keeps today and lists suppressed or other-rite dates after
 * it. "Does Wikidata's day appear?" says yes to every date in the list, so it
 * cannot tell "the article confirms this feast" from "the article confirms a
 * different feast and mentions this one as history".
 */
describe("firstFeastInText", () => {
  it("reports the FIRST day named, not any day named", () => {
    // Pope Zephyrinus (Q101306), verbatim from the article's infobox once the
    // list template is unwrapped. Wikidata's single P841 value is 26 August.
    const infobox =
      "20 December (Maronite Church, Orthodox Churches, Latin Church); " +
      "26 August (Latin Church pre-1969)";
    expect(firstFeastInText(infobox, "en")?.feastDay).toBe("12-20");
  });

  it("reads a single date, in whatever order the text writes it", () => {
    expect(firstFeastInText("23 August", "en")?.feastDay).toBe("08-23");
    expect(firstFeastInText("August 23rd", "en")?.feastDay).toBe("08-23");
  });

  it("never mistakes a longer day number for a shorter one", () => {
    // "26 August" must not report 2 August, which a substring match would.
    expect(firstFeastInText("26 August", "en")?.feastDay).toBe("08-26");
  });

  it("reads the localized editions the ingest corroborates in", () => {
    expect(firstFeastInText("14 lipca", "pl")?.feastDay).toBe("07-14");
    expect(firstFeastInText("14 de julio", "es")?.feastDay).toBe("07-14");
  });

  it("returns null for text with no calendar day, or an unreadable language", () => {
    expect(firstFeastInText("no date at all", "en")).toBeNull();
    expect(firstFeastInText("", "en")).toBeNull();
    expect(firstFeastInText("14 July", "ja")).toBeNull();
  });
});
