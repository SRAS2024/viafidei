/**
 * The facts area of a reading page: what each record can honestly say, one label
 * at a time. A fact the record cannot state plainly is left out, because a
 * wrong-looking fact is worse than a missing one on a site whose point is Catholic
 * accuracy. The bad shapes below are the ones the live and seeded records hold.
 */
import { describe, expect, it } from "vitest";

import {
  doctorDeclared,
  doctorEyebrow,
  doctorFactItems,
  doctorLifeEnds,
} from "@/app/doctors/[slug]/facts";
import {
  documentFactItems,
  documentIssuer,
  documentKind,
  documentLinkLabel,
  excerptIsReadable,
  liturgicalLine,
} from "@/app/liturgy-history/[slug]/facts";
import {
  apparitionFactItems,
  apparitionPlace,
  apparitionStatus,
  marianEyebrow,
  marianFactItems,
} from "@/app/our-lady/[slug]/facts";
import { popeBirthName, popeFactItems, popePontificate } from "@/app/popes/[slug]/facts";
import { riteFactItems, riteSummaryIsFiller } from "@/app/rites/[slug]/facts";
import { saintCanonized, saintFactItems, saintLifeEnds } from "@/app/saints/[slug]/facts";
import { saintCardDetailLines, saintPatronage } from "@/lib/content-shared/saints";
import { createTranslator } from "@/lib/i18n/translator";

const t = createTranslator("en");
const read = (items: Array<{ label: string; value: unknown }>) =>
  items.map((item) => `${item.label}: ${item.value}`);

describe("a saint's patronage on a card", () => {
  const lines = (patronages: string[]) =>
    saintCardDetailLines({ patronages, feast: null } as never, t);

  it("reads as one phrase, with nothing said twice", () => {
    expect(lines(["Patron saint of Fish"])).toEqual(["Patron of Fish"]);
    expect(lines(["workers", "fathers"])).toEqual(["Patron of workers, fathers"]);
    expect(lines(["The homeless"])).toEqual(["Patron of the homeless"]);
  });

  it("says Patron against, not Patron of against", () => {
    expect(lines(["against rabies"])).toEqual(["Patron against rabies"]);
  });

  it("leaves out a note that none is recorded", () => {
    expect(lines(["His specific patronages are not recorded"])).toEqual([]);
  });

  it("labels the facts area the same way", () => {
    const [fact] = saintFactItems({ patronages: ["against rabies"] }, t);
    expect(fact).toEqual({ label: "Patron", value: "against rabies" });
  });
});

describe("a saint's canonization", () => {
  const canonized = (date?: string, by?: string, extra: Record<string, unknown> = {}) =>
    saintCanonized({
      canonizationStatus: "canonized",
      canonizationDate: date,
      canonizedBy: by,
      ...extra,
    });

  it("reads a date and a pope, whichever way the record wrote the date", () => {
    expect(canonized("25 October 1970", "Pope Paul VI")).toBe("25 October 1970, by Pope Paul VI");
    expect(canonized("May 16, 1988", "Pope John Paul II")).toBe(
      "16 May 1988, by Pope John Paul II",
    );
    expect(canonized("October 15, 2006,", "Pope Benedict XVI")).toBe(
      "15 October 2006, by Pope Benedict XVI",
    );
    expect(canonized("1078", "Pope Gregory VII")).toBe("1078, by Pope Gregory VII");
    expect(canonized("June 1347", "Pope Clement VI")).toBe("June 1347, by Pope Clement VI");
    expect(canonized("ca. 1170", "Pope Alexander III")).toBe("c. 1170, by Pope Alexander III");
  });

  it("finds the pope folded into the date, and names him as a pope", () => {
    expect(canonized("25 October 1970 by Pope Paul VI")).toBe("25 October 1970, by Pope Paul VI");
    expect(canonized("21 November 1999, Italy by Pope John Paul II")).toBe(
      "21 November 1999, by Pope John Paul II",
    );
    expect(canonized("25 October 1970", "Paul VI")).toBe("25 October 1970, by Pope Paul VI");
    expect(canonized("19 June 1988", "Pope John-Paul II")).toBe(
      "19 June 1988, by Pope John Paul II",
    );
    expect(canonized("1123", "Pope Callixtus II (officially recognised)")).toBe(
      "1123, by Pope Callixtus II",
    );
    expect(canonized("1 October 2000", "Pope John Paul&nbsp;II")).toBe(
      "1 October 2000, by Pope John Paul II",
    );
  });

  it("names the pope alone when that is all the record has", () => {
    expect(canonized(undefined, "Pope Pius XII")).toBe("by Pope Pius XII");
  });

  it("keeps the date when a note beside it adds nothing to the fact", () => {
    expect(canonized("3 April 2014 (equivalent canonization)", "Pope Francis")).toBe(
      "3 April 2014, by Pope Francis",
    );
    expect(canonized("28 August 1221 (pre-Congregation)")).toBe("28 August 1221");
  });

  it("says nothing of a saint the record does not call canonized", () => {
    expect(
      saintCanonized({
        canonizationStatus: "beatified",
        canonizationDate: "19 October 2025",
        canonizedBy: "Pope Leo XIV",
      }),
    ).toBeNull();
  });

  it("is not a confirmed cult", () => {
    expect(canonized("1484 (cultus confirmed)", "Innocent VIII")).toBeNull();
    expect(canonized("Cultus confirmed in 1893", "Pope Leo XIII")).toBeNull();
    expect(canonized("cult was confirmed on August 26, 1727", "Pope Benedict XIII")).toBeNull();
    expect(canonized("1517", "Cultus confirmed by Pope Leo X")).toBeNull();
  });

  it("is not an Orthodox or local act", () => {
    expect(canonized("13 October 1994", "Russian Orthodox Church")).toBeNull();
    expect(canonized("20 October 2019", "Bartholomew I of Constantinople")).toBeNull();
    expect(canonized("1130", "Paio Mendes, Archbishop of Braga")).toBeNull();
    expect(canonized("1987", "Ignatius Zakka I Iwas")).toBeNull();
    expect(canonized(undefined, "Eastern Orthodox Church Roman Catholic Church")).toBeNull();
  });

  it("needs a pope from 1234, when canonizing became the pope's alone", () => {
    expect(canonized("1986")).toBeNull();
    expect(canonized("1029")).toBe("1029");
  });

  it("drops a date from before canonizations were recorded, or before the saint died", () => {
    expect(canonized("304")).toBeNull();
    expect(canonized("860", "Pope Nicholas I")).toBeNull();
    expect(canonized("1100", "Pope Paschal II", { deathDate: "1140" })).toBeNull();
  });

  it("will not guess at what it cannot read", () => {
    expect(canonized("1553 and 1621")).toBeNull();
    expect(canonized("after 968")).toBeNull();
    expect(canonized("3 were canonized by Pope Paul VI on 25 October 1970")).toBeNull();
    expect(canonized("officially inscribed in the canon of saints in 1753.")).toBeNull();
    expect(canonized(undefined, "Pre-Congregation")).toBeNull();
    expect(canonized(undefined, "q")).toBeNull();
    expect(canonized()).toBeNull();
  });
});

describe("a saint's patronage", () => {
  it("reads as a phrase to follow its label", () => {
    expect(saintPatronage(["the universal Church", "workers"])).toBe(
      "the universal Church, workers",
    );
  });

  it("does not repeat the label, or end like a sentence", () => {
    expect(saintPatronage(["Patron saint of Lough Derg"])).toBe("Lough Derg");
    expect(saintPatronage(["Patron of Monteprandone", "co-patron of Naples"])).toBe(
      "Monteprandone, co-patron of Naples",
    );
    expect(saintPatronage(["Hatters", "cloth makers."])).toBe("Hatters, cloth makers");
  });

  it("keeps a saint's name with its St.", () => {
    expect(saintPatronage(["canonists", "St. Robert's School"])).toBe(
      "canonists, St.\u00a0Robert's School",
    );
  });

  it("is not a note that there is none", () => {
    expect(saintPatronage(["His specific patronages are not recorded"])).toBeNull();
    expect(saintPatronage([])).toBeNull();
  });
});

describe("a saint's facts", () => {
  it("come in the owner's order, with one label each", () => {
    expect(
      read(
        saintFactItems(
          {
            canonizationStatus: "canonized",
            feastDay: "09-17",
            feastMonth: 9,
            feastDayOfMonth: 17,
            patronages: ["canonists", "catechists"],
            birthDate: "1542-10-04",
            deathDate: "1621-09-17",
            canonizationDate: "29 June 1930",
            canonizedBy: "Pius XI",
          },
          t,
        ),
      ),
    ).toEqual([
      "Patron of: canonists, catechists",
      "Feast day: September 17",
      "Born: 1542",
      "Died: 1621",
      "Canonized: 29 June 1930, by Pope Pius XI",
    ]);
  });

  it("leave out what the record lacks", () => {
    expect(read(saintFactItems({ feastDay: "08-26", patronages: [] }, t))).toEqual([
      "Feast day: August 26",
    ]);
    expect(saintFactItems({}, t)).toEqual([]);
  });

  it("keep the hedges a record gives its dates", () => {
    expect(saintLifeEnds({ birthDate: "c. 830/833", deathDate: "16 July 866" })).toEqual({
      born: "c. 830",
      died: "866",
    });
    expect(saintLifeEnds({ deathDate: "after 465" })).toEqual({ born: null, died: "after 465" });
  });

  it("print neither date when the two contradict each other", () => {
    expect(saintLifeEnds({ birthDate: "1900", deathDate: "1800" })).toEqual({
      born: null,
      died: null,
    });
  });
});

describe("a pope's facts", () => {
  it("give the reign as a range", () => {
    expect(popePontificate({ papacyStart: "1978", papacyEnd: "2005" })).toBe("1978 – 2005");
    expect(popePontificate({ papacyStart: "c. 99", papacyEnd: "c. 107" })).toBe("c. 99 – c. 107");
  });

  it("give one year for a reign that began and ended in it", () => {
    expect(popePontificate({ papacyStart: "336", papacyEnd: "336" })).toBe("336");
  });

  it("say Since only of a reign that can still be going on", () => {
    expect(popePontificate({ papacyStart: "2025" }, 2026)).toBe("Since 2025");
    expect(popePontificate({ papacyStart: "2025", papacyEnd: "present" }, 2026)).toBe("Since 2025");
    expect(popePontificate({ papacyStart: "530" }, 2026)).toBe("530");
    expect(popePontificate({}, 2026)).toBeNull();
  });

  it("leave out a birth name the papal name already says", () => {
    expect(popeBirthName("Pope Saint Gregory the Great", "Gregory")).toBeNull();
    expect(popeBirthName("Pope Saint Peter", "Simon bar Jonah")).toBe("Simon bar Jonah");
    expect(popeBirthName("Pope Leo XIV", undefined)).toBeNull();
  });

  it("read as one list", () => {
    expect(
      read(
        popeFactItems("Pope Saint Peter", {
          papacyStart: "30",
          papacyEnd: "64",
          birthName: "Simon bar Jonah",
        }),
      ),
    ).toEqual(["Pontificate: 30 – 64", "Birth name: Simon bar Jonah"]);
  });
});

describe("a Doctor's facts", () => {
  const declared = (background: string) => doctorDeclared({ background });

  it("read the declaration from every way the biographies word it", () => {
    expect(declared("Declared a Doctor of the Church by Pope Pius XI in 1931.")).toBe(
      "1931, by Pope Pius XI",
    );
    expect(declared("Named a Doctor of the Church by Pope Pius V in 1568.")).toBe(
      "1568, by Pope Pius V",
    );
    expect(
      declared(
        "One of the four original Latin Doctors of the Church, confirmed by Pope Boniface VIII in 1298.",
      ),
    ).toBe("1298, by Pope Boniface VIII");
    expect(
      declared("Declared a Doctor of the Church — the Doctor of Unity — by Pope Francis in 2022."),
    ).toBe("2022, by Pope Francis");
    expect(
      declared("The first woman declared a Doctor of the Church, by Pope Paul VI in 1970."),
    ).toBe("1970, by Pope Paul VI");
    expect(
      declared(
        "Canonized in 2019, he was declared a Doctor of the Church by Pope Leo XIV on 1 November 2025 and named co-patron.",
      ),
    ).toBe("1 November 2025, by Pope Leo XIV");
    expect(declared("Declared a Doctor of the Church by Pope Saint Pius V in 1567.")).toBe(
      "1567, by Pope Saint Pius V",
    );
    expect(
      declared(
        "Declared a Doctor of the Church by Pope John Paul II in 1997, the youngest Doctor.",
      ),
    ).toBe("1997, by Pope John Paul II");
  });

  it("fall back on a recorded year, and otherwise say nothing", () => {
    expect(doctorDeclared({ background: "A great teacher.", declaredDoctorYear: 1931 })).toBe(
      "1931",
    );
    expect(doctorDeclared({ background: "A great teacher." })).toBeNull();
  });

  it("do not take another pope's act for the declaration", () => {
    expect(declared("He was made a cardinal by Pope Leo XIII in 1879.")).toBeNull();
  });

  it("read the dates at the head of the biography, and nowhere else", () => {
    expect(doctorLifeEnds({ background: "Saint Augustine (354-430), bishop of Hippo." })).toEqual({
      born: "354",
      died: "430",
    });
    expect(
      doctorLifeEnds({ background: "Saint Albert (c. 1200-1280), Dominican bishop." }),
    ).toEqual({
      born: "c. 1200",
      died: "1280",
    });
    expect(doctorLifeEnds({ background: "He led the Council of Ephesus (431-431)." })).toEqual({
      born: null,
      died: null,
    });
    expect(
      doctorLifeEnds({ background: "A preacher. He fought at the council (1414-1418)." }),
    ).toEqual({ born: null, died: null });
  });

  it("prefer dates of the record's own", () => {
    expect(
      doctorLifeEnds({ birthDate: "1225", deathDate: "1274", background: "Aquinas (1224-1275)." }),
    ).toEqual({ born: "1225", died: "1274" });
  });

  it("carry the role in the label over the name, not in a field of its own", () => {
    expect(doctorEyebrow({ ecclesialRole: "bishop" })).toBe("Bishop · Doctor of the Church");
    expect(doctorEyebrow({ ecclesialRole: "religious" })).toBe("Religious · Doctor of the Church");
    expect(doctorEyebrow({})).toBe("Doctor of the Church");
  });

  it("leave out a title that only repeats that label", () => {
    expect(
      read(doctorFactItems({ doctorTitle: "Doctor of the Church", feastDay: "December 7" })),
    ).toEqual(["Feast day: December 7"]);
    expect(read(doctorFactItems({ doctorTitle: "Doctor of Grace", feastDay: "08-28" }))).toEqual([
      "Title: Doctor of Grace",
      "Feast day: August 28",
    ]);
  });
});

describe("a rite's facts", () => {
  it("split the line the worker composes", () => {
    expect(
      read(
        riteFactItems({
          family: "byzantine",
          entryKind: "church_sui_iuris",
          region: "Hungary",
          faithfulEstimate: "Around a quarter of a million faithful",
        }),
      ),
    ).toEqual([
      "Type: Church sui iuris",
      "Tradition: Byzantine",
      "Region: Hungary",
      "Faithful: Around a quarter of a million faithful",
    ]);
    expect(read(riteFactItems({ riteKey: "ambrosian" }))).toEqual([
      "Type: Latin liturgical use",
      "Place: Milan",
    ]);
    expect(read(riteFactItems({ riteKey: "roman" }))).toEqual(["Type: Latin liturgical rite"]);
    expect(read(riteFactItems({ family: "west_syriac", entryKind: "liturgical_rite" }))).toEqual([
      "Tradition: West Syriac (Antiochene)",
    ]);
  });

  it("have nothing to say of a rite whose family is not recorded", () => {
    expect(riteFactItems({})).toEqual([]);
  });

  it("know a summary that only restates the title", () => {
    expect(
      riteSummaryIsFiller({
        summary: "Coptic Rite, one of the liturgical traditions of the Catholic Church.",
      }),
    ).toBe(true);
    expect(riteSummaryIsFiller({ summary: "The liturgical family of Egypt." })).toBe(false);
    expect(riteSummaryIsFiller({})).toBe(false);
  });
});

describe("a Church document's facts", () => {
  it("name what kind of document it is, in the worker's words", () => {
    expect(documentKind({ documentType: "encyclical" })).toBe("Encyclical");
    expect(documentKind({ documentType: "papal_bull" })).toBe("Papal Bull");
    expect(documentKind({ documentType: "catechism_section" })).toBe(
      "Catechism of the Catholic Church",
    );
    expect(
      documentKind({ documentType: "council_document", contentSubtype: "council_decree" }),
    ).toBe("Decree of an Ecumenical Council");
    expect(documentKind({ documentType: "council_document" })).toBe("Ecumenical Council");
  });

  it("do not print 'Catholic Church' as the one who issued it", () => {
    expect(documentIssuer({ issuingAuthority: "Catholic Church" })).toBeNull();
    expect(documentIssuer({ issuingAuthority: "Pope Francis" })).toBe("Pope Francis");
    expect(documentIssuer({ issuingAuthority: "Pope Pius XII" })).toBe("Pope Pius XII");
    expect(documentIssuer({ issuingAuthority: "Pius XII" })).toBe("Pope Pius XII");
    expect(documentIssuer({ issuingAuthority: "John Paul II" })).toBe("Pope John Paul II");
    expect(documentIssuer({ issuingAuthority: "Second Vatican Council" })).toBe(
      "Second Vatican Council",
    );
    expect(documentIssuer({ pope: "Pius XI" })).toBe("Pope Pius XI");
  });

  it("assert no more of a date than the record knows", () => {
    // A council's "-01-01" is a placeholder.
    expect(
      read(documentFactItems({ documentType: "council_document", issuedDate: "0325-01-01" })),
    ).toEqual(["Date: 325", "Type: Ecumenical Council"]);
    // Indulgentiarum Doctrina really is dated 1 January 1967.
    expect(
      read(
        documentFactItems({
          documentType: "apostolic_constitution",
          issuedDate: "1967-01-01",
          issuingAuthority: "Pope Saint Paul VI",
        }),
      ),
    ).toEqual([
      "Date: 1 January 1967",
      "Type: Apostolic Constitution",
      "Issued by: Pope Saint Paul VI",
    ]);
    expect(read(documentFactItems({ documentType: "encyclical" }))).toEqual(["Type: Encyclical"]);
  });

  it("name the way out for where it goes", () => {
    expect(documentLinkLabel("https://www.vatican.va/x.html")).toBe("Read the full document");
    expect(documentLinkLabel("https://en.wikipedia.org/wiki/Council_of_Ephesus")).toBe(
      "Read more on Wikipedia",
    );
  });

  it("keep an excerpt a reader of this page can read", () => {
    expect(
      excerptIsReadable(
        "The pilgrim Church is missionary by her very nature, since it is from the mission of the Son.",
      ),
    ).toBe(true);
    expect(excerptIsReadable("A short quotation in few words.")).toBe(true);
  });

  it("leave out what the ingest kept by mistake", () => {
    expect(
      excerptIsReadable(
        "1. Deus munificent ssimo, que tudo pode, e cujos planos de provid ncia s o cheios de sabedoria.",
      ),
    ).toBe(false);
    expect(
      excerptIsReadable(
        "DILECTIS FILIIS NOSTRIS FRANCISCO MARIAE S. R. E. PRESB. CARD. RICHARD ARCHIEPISCOPO PARISIENSI",
      ),
    ).toBe(false);
    expect(
      excerptIsReadable(
        "La grande e sublime missione che, sul punto di ritornare al Padre, il Nostro Signore affidò ai suoi discepoli.",
      ),
    ).toBe(false);
    expect(excerptIsReadable("&#x6559;&#x5b97;")).toBe(false);
    expect(excerptIsReadable(undefined)).toBe(false);
  });
});

describe("a liturgical entry's line", () => {
  it("splits a celebration into rank, date and season", () => {
    const { kind, facts } = liturgicalLine({
      kind: "memorial",
      feastDate: "10-07",
      season: "ordinary_time",
    });
    expect(kind).toBe("");
    expect(read(facts)).toEqual(["Rank: Memorial", "Date: October 7", "Season: Ordinary Time"]);
  });

  it("says a movable feast is movable", () => {
    const { facts } = liturgicalLine({ kind: "solemnity", movableFeast: true, season: "easter" });
    expect(read(facts)).toEqual(["Rank: Solemnity", "Date: Movable", "Season: Easter season"]);
  });

  it("gives anything else only its kind", () => {
    expect(liturgicalLine({ kind: "mass_structure" })).toEqual({
      kind: "Order of Mass",
      facts: [],
    });
    expect(liturgicalLine({ kind: "liturgical_season", slug: "season-lent" })).toEqual({
      kind: "Season of the liturgical year",
      facts: [],
    });
  });

  it("does not call a day a season, whatever the record files it under", () => {
    expect(liturgicalLine({ kind: "liturgical_season", slug: "divine-mercy-sunday" })).toEqual({
      kind: "",
      facts: [],
    });
  });
});

describe("an apparition's facts", () => {
  it("give the Church's word in the worker's wording", () => {
    expect(apparitionStatus({ approvedStatus: "approved" })).toBe(
      "Church-approved Marian apparition",
    );
    expect(apparitionStatus({ approvedStatus: "nihil_obstat" })).toBe(
      "Marian apparition granted nihil obstat",
    );
    expect(apparitionStatus({ approvedStatus: "private_revelation" })).toBe("Private revelation");
    expect(apparitionStatus({ approvedStatus: "approved", subject: "angel" })).toBe(
      "Church-approved apparition of an angel",
    );
  });

  it("join what the record has of the place", () => {
    expect(apparitionPlace({ location: "Cova da Iria", country: "Portugal" })).toBe(
      "Cova da Iria, Portugal",
    );
    expect(apparitionPlace({ country: "Portugal" })).toBe("Portugal");
    expect(apparitionPlace({})).toBeNull();
  });

  it("leave out a year or feast the record lacks", () => {
    expect(
      read(
        apparitionFactItems({ approvedStatus: "approved", country: "India", feastDay: "09-08" }),
      ),
    ).toEqual([
      "Status: Church-approved Marian apparition",
      "Place: India",
      "Feast day: September 8",
    ]);
  });
});

describe("a Marian title's facts", () => {
  it("say what kind of title it is, over the name", () => {
    expect(marianEyebrow({ slug: "our-lady-of-fatima" })).toBe("Title of the Blessed Virgin Mary");
    expect(marianEyebrow({ slug: "immaculate-conception" })).toBe("Marian dogma");
    expect(marianEyebrow({ slug: "x", dogmaDefinedYear: 1950 })).toBe("Marian dogma");
  });

  it("give a dogma's year, and a title's region", () => {
    expect(
      read(
        marianFactItems({
          slug: "immaculate-conception",
          feastDay: "12-08",
          region: "Universal Church",
        }),
      ),
    ).toEqual(["Feast day: December 8", "Defined: 1854"]);
    expect(
      read(marianFactItems({ slug: "our-lady-of-lujan", feastDay: "05-08", region: "Argentina" })),
    ).toEqual(["Feast day: May 8", "Region: Argentina"]);
    expect(marianFactItems({ slug: "our-lady-of-the-atonement" })).toEqual([]);
  });
});
