import { describe, expect, it } from "vitest";

import {
  compareSaintsChronologically,
  formatFeastDay,
  parseYear,
  saintEyebrow,
  saintSortYear,
  saintTitleLabel,
} from "@/lib/content-shared/saints";

describe("parseYear", () => {
  it("reads plain years and full dates", () => {
    expect(parseYear("1897")).toBe(1897);
    expect(parseYear("October 1, 1897")).toBe(1897);
    expect(parseYear("1 October 1897")).toBe(1897);
    expect(parseYear("c. 1226")).toBe(1226);
  });

  it("reads era markers, negative for BC", () => {
    expect(parseYear("33 AD")).toBe(33);
    expect(parseYear("A.D. 67")).toBe(67);
    expect(parseYear("100 BC")).toBe(-100);
    expect(parseYear("c. 250 AD")).toBe(250);
  });

  it("maps centuries to their midpoint", () => {
    expect(parseYear("4th century")).toBe(350);
    expect(parseYear("1st century")).toBe(50);
    expect(parseYear("3rd century BC")).toBe(-250);
  });

  it("takes the first year of a range", () => {
    expect(parseYear("1182–1226")).toBe(1182);
    expect(parseYear("1182-1226")).toBe(1182);
  });

  it("returns null when no year is present", () => {
    expect(parseYear("unknown")).toBeNull();
    expect(parseYear(undefined)).toBeNull();
    expect(parseYear("")).toBeNull();
  });
});

describe("saintSortYear", () => {
  it("prefers death, then birth, then canonization", () => {
    expect(saintSortYear({ deathDate: "1897", birthDate: "1873" })).toBe(1897);
    expect(saintSortYear({ birthDate: "1873" })).toBe(1873);
    expect(saintSortYear({ canonizationDate: "1997" })).toBe(1997);
    expect(saintSortYear({})).toBeNull();
  });
});

describe("compareSaintsChronologically", () => {
  const saint = (title: string, deathDate?: string) => ({
    title,
    payload: deathDate ? { deathDate } : {},
  });

  it("orders earliest first, undatable last, tie-break by title", () => {
    const list = [
      saint("Thérèse", "1897"),
      saint("Peter", "67 AD"),
      saint("Unknown One"),
      saint("Aquinas", "1274"),
      saint("Another Unknown"),
    ];
    const ordered = [...list].sort(compareSaintsChronologically).map((s) => s.title);
    expect(ordered).toEqual(["Peter", "Aquinas", "Thérèse", "Another Unknown", "Unknown One"]);
  });
});

describe("saintTitleLabel", () => {
  it("maps the canonical saint type to a strict title", () => {
    expect(saintTitleLabel({ saintType: "apostle" })).toBe("Apostle");
    expect(saintTitleLabel({ saintType: "doctor_of_the_church" })).toBe("Doctor of the Church");
    expect(saintTitleLabel({ saintType: "martyr" })).toBe("Martyr");
  });

  it("returns undefined for 'other' or a missing type", () => {
    expect(saintTitleLabel({ saintType: "other" })).toBeUndefined();
    expect(saintTitleLabel({})).toBeUndefined();
  });
});

describe("formatFeastDay", () => {
  it("formats MM-DD as a readable month and day", () => {
    expect(formatFeastDay("07-25")).toBe("July 25");
    expect(formatFeastDay("01-01")).toBe("January 1");
  });

  it("passes other text through and ignores non-strings", () => {
    expect(formatFeastDay("Movable")).toBe("Movable");
    expect(formatFeastDay(undefined)).toBeUndefined();
  });
});

describe("saintEyebrow", () => {
  it("combines the title and feast day", () => {
    expect(saintEyebrow({ saintType: "doctor_of_the_church", feastDay: "07-25" })).toBe(
      "Doctor of the Church · Feast July 25",
    );
  });

  it("shows just one part when the other is missing", () => {
    expect(saintEyebrow({ saintType: "apostle" })).toBe("Apostle");
    expect(saintEyebrow({ feastDay: "12-25" })).toBe("Feast December 25");
    expect(saintEyebrow({})).toBeUndefined();
  });
});
