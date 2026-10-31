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

  it("adds nothing the name already says", () => {
    const canonized = { canonizationStatus: "canonized" };
    expect(saintDetailEyebrow(canonized, "Saint Godeberta")).toBeUndefined();
    expect(saintDetailEyebrow(canonized, "St. Agnes of Rome")).toBeUndefined();
    expect(saintDetailEyebrow(canonized, "Pope Saint Gregory the Great")).toBeUndefined();
    expect(saintDetailEyebrow(canonized, "Saints Cyril and Methodius")).toBeUndefined();
    expect(saintDetailEyebrow(canonized, "Juan Diego Cuauhtlatoatzin")).toBe("Saint");
    const beatified = { canonizationStatus: "beatified" };
    expect(saintDetailEyebrow(beatified, "Blessed Carlo Acutis")).toBeUndefined();
    expect(saintDetailEyebrow(beatified, "Bl. Miguel Pro")).toBeUndefined();
    // A beatus named without the title is still introduced as Blessed.
    expect(saintDetailEyebrow(beatified, "Anna Maria Adorni")).toBe("Blessed");
    expect(saintDetailEyebrow({ canonizationStatus: "venerable" }, "Venerable Fulton Sheen")).toBe(
      undefined,
    );
    // A real title is never dropped because of the name.
    expect(saintDetailEyebrow({ saintType: "doctor_of_the_church" }, "Saint Teresa of Ávila")).toBe(
      "Doctor of the Church",
    );
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
    expect(lived("c. 500–520", "592")).toBe("c. 500 – 592");
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
    expect(lived("Francisco: 1908-06-11 Jacinta: 1910-03-05", undefined)).toBeNull();
    expect(lived("826 or 827 and 815", "869-02-14 and 885-04-06 (41 or 42 and 70)")).toBeNull();
    expect(lived("1946", "1910")).toBeNull();
    expect(lived("100 BC", "44 BC")).toBe("100 BC – 44 BC");
  });

  // The rows the review found turned into confident single dates.
  it("never turns a group's range or a disputed date into one year", () => {
    // saint-vietnamese-martyrs and saint-120-martyrs-of-china: the group's span.
    expect(lived(undefined, "1745–1862")).toBeNull();
    expect(lived(undefined, "1648–1930")).toBeNull();
    // saint-alban, and a date the record itself calls disputed.
    expect(lived(undefined, "disputed: 209, 251 or 304")).toBeNull();
    expect(lived("17 November, 810", "28 September, 865 (disputed)")).toBe("Born 810");
    // Saint Marie-Geneviève Meunier of the Martyrs of Compiègne: born "c. 1715–1765".
    expect(lived("c. 1715–1765", "17 July 1794")).toBe("Died 1794");
    // Alternatives too far apart to be "c." the first.
    expect(lived(undefined, "650 or 1015 AD")).toBeNull();
    expect(lived(undefined, "Between 331 and 362")).toBeNull();
    // Close alternatives still read as approximately the first.
    expect(lived("1209/1210 or 1215", "19 May 1296 (aged 80–87)")).toBe("c. 1209 – 1296");
    expect(lived("1293–4", "1381-12-02")).toBe("c. 1293 – 1381");
    expect(lived("c. 450", "After 517 and before 519")).toBe("c. 450 – c. 517");
  });

  it("keeps a decade as written and honours every hedge the record makes", () => {
    // saint-grimbald and saint-andrew-the-scot.
    expect(lived("820s", "8 July 901")).toBe("820s – 901");
    expect(lived("800s", "c. 877")).toBe("800s – c. 877");
    expect(lived("Unknown, but most likely in the 620s", "2 March 672")).toBe("620s – 672");
    // saint-gregorio-celli: the hedge is in brackets; "(possibly aged 118)" is about his age.
    expect(lived("1225 (purportedly)", "11 May 1343 (possibly aged 118)")).toBe("c. 1225 – 1343");
    // saint-maximus-of-turin.
    expect(lived("About 380", "Shortly after 465 AD")).toBe("c. 380 – after 465");
    expect(lived("prior to 819", "859-03-11")).toBe("before 819 – 859");
    expect(lived(undefined, "probably 13 January 731")).toBe("Died c. 731");
    expect(lived(undefined, "19 February probably of 685")).toBe("Died c. 685");
    expect(lived("perhaps 20 November 1174", "1240-11-16")).toBe("c. 1174 – 1240");
    expect(lived("980 (973 by some sources)", undefined)).toBe("Born c. 980");
    expect(lived("100 AD. ca.", "143 AD. ca.")).toBe("c. 100 – c. 143");
    // A day written as alternatives leaves a recorded year exact.
    expect(lived(undefined, "Between 9 and 11 March 732")).toBe("Died 732");
  });

  it("reads a year written after a name instead of hedging it", () => {
    expect(lived("James Alfred Miller 1944-09-21", "1982-02-13")).toBe("1944 – 1982");
  });
});
