import { describe, expect, it } from "vitest";

import {
  compareSaintsChronologically,
  formatFeastDay,
  parseYear,
  saintCardDetails,
  saintDetailEyebrow,
  saintEyebrow,
  saintLifeDates,
  saintOrderRank,
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

  it("takes the earliest year of a BC range (era marker sits by the later year)", () => {
    expect(parseYear("100–44 BC")).toBe(-100);
    expect(parseYear("356-323 BC")).toBe(-356);
    // A single BC year and a numeric date are unaffected.
    expect(parseYear("100 BC")).toBe(-100);
    expect(parseYear("10-01-1897")).toBe(1897);
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

describe("compareSaintsChronologically — foundational ordering", () => {
  const fig = (title: string, payload: Record<string, unknown>) => ({ title, payload });

  it("leads with Mary, Joseph, John the Baptist, Peter, Apostles, Matthias, Paul", () => {
    const list = [
      fig("Thérèse", { deathDate: "1897" }),
      fig("Paul", { slug: "paul" }),
      fig("Andrew", { slug: "andrew", saintType: "apostle" }),
      fig("Peter", { slug: "peter", saintType: "apostle" }),
      fig("Mary", { slug: "mary" }),
      fig("Matthias", { slug: "matthias" }),
      fig("Joseph", { slug: "joseph" }),
      fig("John the Baptist", { slug: "john-the-baptist" }),
      fig("Augustine", { deathDate: "430" }),
    ];
    const ordered = [...list].sort(compareSaintsChronologically).map((s) => s.title);
    expect(ordered).toEqual([
      "Mary",
      "Joseph",
      "John the Baptist",
      "Peter",
      "Andrew",
      "Matthias",
      "Paul",
      "Augustine",
      "Thérèse",
    ]);
  });

  it("honours an explicit worker orderRank", () => {
    expect(saintOrderRank({ orderRank: 0 })).toBe(0);
    expect(saintOrderRank({ slug: "peter" })).toBe(3);
    expect(saintOrderRank({ saintType: "apostle" })).toBe(10);
    expect(saintOrderRank({ deathDate: "1897" })).toBeNull();
  });
});

describe("saintTitleLabel — only the permitted set", () => {
  it("labels Apostles and Doctors of the Church", () => {
    expect(saintTitleLabel({ saintType: "apostle" })).toBe("Apostle and Disciple of Jesus");
    expect(saintTitleLabel({ saintType: "doctor_of_the_church" })).toBe("Doctor of the Church");
  });

  it("shows no label for Martyr, Virgin, Bishop, and the like", () => {
    expect(saintTitleLabel({ saintType: "martyr" })).toBeUndefined();
    expect(saintTitleLabel({ saintType: "virgin" })).toBeUndefined();
    expect(saintTitleLabel({ saintType: "bishop" })).toBeUndefined();
    expect(saintTitleLabel({ saintType: "other" })).toBeUndefined();
    expect(saintTitleLabel({})).toBeUndefined();
  });

  it("uses an explicit worker titleLabel verbatim", () => {
    expect(saintTitleLabel({ saintType: "virgin", titleLabel: "Mother of God" })).toBe(
      "Mother of God",
    );
    expect(
      saintTitleLabel({
        saintType: "evangelist",
        titleLabel: "Apostle of Jesus and Disciple of Peter",
      }),
    ).toBe("Apostle of Jesus and Disciple of Peter");
  });

  it("renders a dated papal title, or none when dates are missing", () => {
    expect(saintTitleLabel({ saintType: "pope", papacyStart: "440", papacyEnd: "461" })).toBe(
      "Pope from 440 to 461",
    );
    expect(saintTitleLabel({ saintType: "pope" })).toBeUndefined();
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
    expect(saintEyebrow({ saintType: "apostle" })).toBe("Apostle and Disciple of Jesus");
    expect(saintEyebrow({ feastDay: "12-25" })).toBe("Feast December 25");
    expect(saintEyebrow({})).toBeUndefined();
  });
});

describe("saintDetailEyebrow (the saint's own page)", () => {
  it("uses the permitted title label, without the feast (it has its own line)", () => {
    expect(saintDetailEyebrow({ saintType: "doctor_of_the_church", feastDay: "07-25" })).toBe(
      "Doctor of the Church",
    );
  });

  it("never introduces a beatus or a venerable as a saint", () => {
    expect(saintDetailEyebrow({ saintType: "founder", canonizationStatus: "beatified" })).toBe(
      "Blessed",
    );
    expect(saintDetailEyebrow({ canonizationStatus: "venerable" })).toBe("Venerable");
    expect(saintDetailEyebrow({ canonizationStatus: "servant_of_god" })).toBe("Servant of God");
    expect(saintDetailEyebrow({ canonizationStatus: "canonized" })).toBe("Saint");
    expect(saintDetailEyebrow({})).toBeUndefined();
  });
});

describe("saintCardDetails (shared by the /saints card and the saint's page)", () => {
  it("reads patronages in order and the feast from the indexed month and day", () => {
    expect(
      saintCardDetails({
        patronages: [" Noyon ", "invoked against drought", 7],
        feastDay: "04-11",
        feastMonth: 4,
        feastDayOfMonth: 11,
      }),
    ).toEqual({ patronages: ["Noyon", "invoked against drought"], feast: "April 11" });
  });

  it("falls back to the legacy single patronage and to a movable feast's prose", () => {
    expect(
      saintCardDetails({ patronage: "Lost things", feastDay: "The Tuesday after Pentecost" }),
    ).toEqual({ patronages: ["Lost things"], feast: "The Tuesday after Pentecost" });
    expect(saintCardDetails({})).toEqual({ patronages: [], feast: null });
  });
});

describe("saintLifeDates", () => {
  const lived = (birthDate?: string, deathDate?: string) =>
    saintLifeDates({ birthDate, deathDate });

  it("gives the years lived, from every date shape the catalogue stores", () => {
    expect(lived("1910-08-19", "1946-07-28")).toBe("1910 – 1946");
    expect(lived("640", "670")).toBe("640 – 670");
    expect(lived("28 June 1557", "1595-10-19")).toBe("1557 – 1595");
    expect(lived("April 16, 1127", "10 January 1209 (aged 59)")).toBe("1127 – 1209");
    expect(lived("304-12-05", "AD&nbsp;370")).toBe("304 – 370");
    expect(lived("lk=no 360", "29th of September, 1637")).toBe("360 – 1637");
  });

  it("marks what the record itself marks as approximate, and never sharpens it", () => {
    expect(lived("c. 1715–1765", "17 July 1794")).toBe("c. 1715 – 1794");
    expect(lived("~250 AD", "302 or 303")).toBe("c. 250 – c. 302");
    expect(lived("173?", undefined)).toBe("Born c. 173");
    expect(lived(undefined, "3 December 649 or 650")).toBe("Died c. 649");
    expect(lived("unknown, 660", "580, traditionally 21 September")).toBeNull();
    expect(lived("c. 497", "580, traditionally 21 September")).toBe("c. 497 – 580");
    expect(lived("unknown, 660", undefined)).toBe("Born c. 660");
    expect(lived("Approximately 800 BCE", undefined)).toBe("Born c. 800 BC");
    expect(lived(undefined, "4th century")).toBe("Died 4th century");
    expect(lived(undefined, "after 10 March 673")).toBe("Died after 673");
  });

  it("gives one end when only one is recorded, and nothing when neither is", () => {
    expect(lived(undefined, "250 AD")).toBe("Died 250");
    expect(lived("1962", undefined)).toBe("Born 1962");
    expect(lived(undefined, undefined)).toBeNull();
    expect(lived("", "  ")).toBeNull();
  });

  it("refuses a record that names two people or contradicts itself", () => {
    expect(lived(undefined, "550 (Severinus); 543 (Victorinus)")).toBeNull();
    expect(lived("1946", "1910")).toBeNull();
    expect(lived("100 BC", "44 BC")).toBe("100 BC – 44 BC");
  });
});
