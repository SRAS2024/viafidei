/**
 * @vitest-environment jsdom
 */
/**
 * Every content page shows its title and the information that matters — no
 * sources, no "Title:" / "Name:" labels, no internal metadata (the owner's
 * formatting pass).
 *
 * Each payload below is shaped like the live rows the pages were printing
 * junk from: "Feast month: 11", "Wikidata qid: Q2123866", "Content subtype:
 * pope_biography", "Structure: nine_days", "Rank: n/a", a summary printed
 * twice, related documents as raw slugs, Catechism references and "Official
 * source" links.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PublishedItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

const published = new Map<string, PublishedItem>();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: () => {
    throw new Error("redirect");
  },
}));

vi.mock("@/components/profile", () => ({
  SaveContentButton: () => null,
}));

vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en") }),
}));

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return {
    ...actual,
    getPublishedBySlug: async (contentType: string, slug: string) =>
      published.get(`${contentType}:${slug}`) ?? null,
    getAnyPublishedBySlug: async (slug: string, types: string[]) =>
      types.map((t) => published.get(`${t}:${slug}`)).find(Boolean) ?? null,
    listPublished: async (contentType: string) =>
      [...published.values()].filter((item) => item.contentType === contentType),
    listPublishedBySlugs: async (contentType: string, slugs: string[]) =>
      slugs
        .map((slug) => published.get(`${contentType}:${slug}`))
        .filter((item): item is PublishedItem => item != null),
    buildPublishedMetadata: () => ({}),
  };
});

import SaintDetailPage from "@/app/saints/[slug]/page";
import PopeDetailPage from "@/app/popes/[slug]/page";
import DoctorDetailPage from "@/app/doctors/[slug]/page";
import RiteDetailPage from "@/app/rites/[slug]/page";
import SacramentDetailPage from "@/app/sacraments/[slug]/page";
import LiturgyHistoryDetailPage from "@/app/liturgy-history/[slug]/page";
import OurLadyDetailPage from "@/app/our-lady/[slug]/page";
import NovenaDetailPage from "@/app/novenas/[slug]/page";
import DevotionDetailPage from "@/app/devotions/[slug]/page";

function put(
  contentType: string,
  slug: string,
  title: string,
  payload: Record<string, unknown>,
  subtitle = "",
) {
  published.set(`${contentType}:${slug}`, {
    id: slug,
    contentType,
    slug,
    title,
    subtitle,
    authorityLevel: "VATICAN",
    version: 1,
    payload,
  } as unknown as PublishedItem);
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const pageText = () => document.body.textContent ?? "";
/** The h2 section headings, in order. */
const sections = () =>
  screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
const expectAbsent = (...needles: string[]) => {
  const text = pageText();
  for (const needle of needles) expect(text, needle).not.toContain(needle);
};
/** The facts area, label by label, in the order a reader meets them. */
const facts = () =>
  Array.from(document.querySelectorAll(".vf-facts dt")).map(
    (dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`,
  );

beforeEach(() => published.clear());
afterEach(() => cleanup());

describe("/saints/[slug]", () => {
  beforeEach(() => {
    put(
      "SAINT",
      "saint-godeberta",
      "Saint Godeberta",
      {
        saintType: "religious",
        canonizationStatus: "canonized",
        feastDay: "04-11",
        feastMonth: 4,
        feastDayOfMonth: 11,
        patronages: ["Noyon", "invoked against drought"],
        birthDate: "640",
        deathDate: "670",
        biography: "Godeberta was a saint and abbess, born in Amiens.",
        summary: "Saint Godeberta, abbess of Noyon.",
        wikidataQid: "Q2123866",
        contentSubtype: "saint_biography",
        canonicalName: "Godeberta",
        citations: ["https://en.wikipedia.org/wiki/Godeberta"],
        relatedPrayers: [],
      },
      "Religious, patron of Noyon · Feast April 11",
    );
  });

  it("reads name, patronage, feast day, dates lived, then the biography — in that order", async () => {
    const { container } = render(await SaintDetailPage(params("saint-godeberta")));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Saint Godeberta");
    // No "Saint" eyebrow over "Saint Godeberta": it only repeated the name.
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
    const flow = Array.from(container.querySelectorAll("h1, dt, dd, article > section p")).map(
      (el) => el.textContent ?? "",
    );
    expect(flow).toEqual([
      "Saint Godeberta",
      "Patron of",
      "Noyon, invoked against drought",
      "Feast day",
      "April 11",
      "Born",
      "640",
      "Died",
      "670",
      "Godeberta was a saint and abbess, born in Amiens.",
    ]);
  });

  it("gives the canonization its own fact, when the record states one", async () => {
    put("SAINT", "saint-john-jones", "Saint John Jones", {
      canonizationStatus: "canonized",
      feastDay: "07-12",
      deathDate: "1598",
      canonizationDate: "25 October 1970",
      canonizedBy: "Pope Paul VI",
      biography: "A Franciscan martyr of the English Reformation.",
    });
    render(await SaintDetailPage(params("saint-john-jones")));
    expect(facts()).toEqual([
      "Feast day: July 12",
      "Died: 1598",
      "Canonized: 25 October 1970, by Pope Paul VI",
    ]);
  });

  it("leaves the facts area out altogether when the record holds none", async () => {
    put("SAINT", "saint-unknown", "Saint Unknown", {
      canonizationStatus: "canonized",
      biography: "Little is recorded.",
    });
    const { container } = render(await SaintDetailPage(params("saint-unknown")));
    expect(container.querySelector(".vf-facts")).toBeNull();
    expect(screen.getByText("Little is recorded.")).toBeInTheDocument();
  });

  it("shows no labels, subtitle, summary, record rows or sources", async () => {
    render(await SaintDetailPage(params("saint-godeberta")));
    expect(sections()).toEqual([]);
    expectAbsent(
      "Biography",
      "Religious, patron of Noyon",
      "abbess of Noyon.",
      "Canonization",
      "Feast month",
      "Q2123866",
      "saint_biography",
      "Birth date",
      "wikipedia",
    );
  });

  it("introduces a beatus as Blessed, and leaves out a fact the record lacks", async () => {
    put("SAINT", "blessed-x", "Anna Maria Adorni", {
      canonizationStatus: "beatified",
      feastDay: "02-07",
      patronages: [],
      biography: "An Italian religious sister.",
    });
    const { container } = render(await SaintDetailPage(params("blessed-x")));
    expect(container.querySelector("header .vf-eyebrow")).toHaveTextContent("Blessed");
    expectAbsent("Patron of", "Born", "Died");
    expect(facts()).toEqual(["Feast day: February 7"]);
    cleanup();

    // Named "Blessed …" already: no eyebrow repeating it.
    put("SAINT", "blessed-y", "Blessed Anna Maria Adorni", { canonizationStatus: "beatified" });
    const named = render(await SaintDetailPage(params("blessed-y")));
    expect(named.container.querySelector(".vf-eyebrow")).toBeNull();
  });

  it("shows a composed biography without its closing pointer to Wikipedia and Wikidata", async () => {
    const life =
      "Peter Jeong San-pil (1750–1799) was a Korean martyr, catholic blessed. The Catholic " +
      "Church venerates Peter Jeong San-pil as a Blessed (beatified); the feast day is May 31.";
    put("SAINT", "saint-peter-jeong-san-pil", "Blessed Peter Jeong San-pil", {
      canonizationStatus: "beatified",
      feastDay: "05-31",
      birthDate: "1750",
      deathDate: "1799",
      biography: `${life} A fuller biography is recorded in the Polish-language Wikipedia article and on Wikidata.`,
      provenance: { biography: "structured-facts" },
    });
    render(await SaintDetailPage(params("saint-peter-jeong-san-pil")));
    expect(screen.getByText(life)).toBeInTheDocument();
    expectAbsent("fuller biography", "Wikipedia", "Wikidata");
  });

  it("keeps a real title over the name", async () => {
    put("SAINT", "saint-teresa", "Saint Teresa of Ávila", {
      saintType: "doctor_of_the_church",
      canonizationStatus: "canonized",
      biography: "Carmelite reformer.",
    });
    const { container } = render(await SaintDetailPage(params("saint-teresa")));
    expect(container.querySelector("header .vf-eyebrow")).toHaveTextContent("Doctor of the Church");
  });
});

describe("the other content types keep their content and drop the filler", () => {
  it("pope: the pontificate, the birth name, the life — no repeated summary or subtitle", async () => {
    put(
      "POPE",
      "pope-john",
      "Pope John",
      {
        background: "Pope John XXIII was head of the Catholic Church from 1958 until 1963.",
        summary: "Pope John, who reigned as Roman Pontiff from 1958–1963.",
        papacyStart: "1958",
        papacyEnd: "1963",
        birthName: "Angelo Giuseppe Roncalli",
        contentSubtype: "pope_biography",
      },
      "Pope from 1958 to 1963",
    );
    const { container } = render(await PopeDetailPage(params("pope-john")));
    expect(facts()).toEqual(["Pontificate: 1958 – 1963", "Birth name: Angelo Giuseppe Roncalli"]);
    expect(screen.getByText(/head of the Catholic Church/)).toBeInTheDocument();
    expect(sections()).toEqual([]);
    // "Pope" over "Pope John" only repeated the name.
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
    expectAbsent(
      "Pope from 1958",
      "who reigned as Roman Pontiff",
      "Papacy began",
      "pope_biography",
    );
  });

  it("pope: no birth name when it is the papal name itself", async () => {
    put(
      "POPE",
      "pope-saint-gregory-the-great",
      "Pope Saint Gregory the Great",
      {
        background: "Gregory I reformed the liturgy and sent Augustine to England.",
        papacyStart: "590",
        papacyEnd: "604",
        birthName: "Gregory",
      },
      "Pope from 590 to 604",
    );
    render(await PopeDetailPage(params("pope-saint-gregory-the-great")));
    expect(screen.getByText(/reformed the liturgy/)).toBeInTheDocument();
    expect(facts()).toEqual(["Pontificate: 590 – 604"]);
  });

  it("doctor: title, feast, dates and declaration — no subtitle, feast month or role rows", async () => {
    put(
      "DOCTOR",
      "doctor-albert-the-great",
      "Saint Albert the Great",
      {
        background:
          "Saint Albert the Great (c. 1200-1280), Dominican bishop and teacher of Saint Thomas " +
          "Aquinas. Declared a Doctor of the Church by Pope Pius XI in 1931.",
        summary: "Saint Albert the Great, Universal Doctor, declared a Doctor of the Church.",
        doctorTitle: "Universal Doctor",
        feastDay: "11-15",
        feastMonth: 11,
        feastDayOfMonth: 15,
        ecclesialRole: "bishop",
      },
      "Bishop · Doctor of the Church — Universal Doctor · Feast November 15",
    );
    const { container } = render(await DoctorDetailPage(params("doctor-albert-the-great")));
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent(
      "Bishop · Doctor of the Church",
    );
    expect(facts()).toEqual([
      "Title: Universal Doctor",
      "Feast day: November 15",
      "Born: c. 1200",
      "Died: 1280",
      "Declared Doctor: 1931, by Pope Pius XI",
    ]);
    expect(sections()).toEqual([]);
    expectAbsent(
      "Feast November 15",
      "Feast month",
      "Ecclesial role",
      "declared a Doctor of the Church.",
    );
  });

  it("rite: history and liturgy under the facts — no family, entry kind or second summary", async () => {
    put(
      "RITE",
      "rite-alexandrian",
      "Alexandrian Rite",
      {
        summary: "The liturgical family of Egypt and the Horn of Africa.",
        history: "The Alexandrian tradition grew from the Church of Alexandria.",
        background: "Celebrated according to the anaphoras of Saint Basil.",
        family: "alexandrian",
        entryKind: "liturgical_rite",
        region: "Egypt, Ethiopia and Eritrea",
        faithfulEstimate: "Roughly four hundred thousand Catholics",
        riteKey: "alexandrian",
      },
      "Alexandrian tradition",
    );
    const { container } = render(await RiteDetailPage(params("rite-alexandrian")));
    expect(facts()).toEqual([
      "Tradition: Alexandrian",
      "Region: Egypt, Ethiopia and Eritrea",
      "Faithful: Roughly four hundred thousand Catholics",
    ]);
    expect(sections()).toEqual(["History", "Background"]);
    expect(screen.getAllByText(/liturgical family of Egypt/)).toHaveLength(1);
    // "Rite" over "Alexandrian Rite" only repeated the name.
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
    expectAbsent("liturgical_rite", "Entry kind", "Family");
  });

  it("rite: a summary that only restates the title does not open the page", async () => {
    put("RITE", "rite-roman", "Roman (Latin) Rite", {
      summary: "Roman (Latin) Rite, one of the liturgical traditions of the Catholic Church.",
      history: "The Roman Rite developed in the city of Rome.",
      riteKey: "roman",
    });
    render(await RiteDetailPage(params("rite-roman")));
    expect(facts()).toEqual(["Type: Latin liturgical rite"]);
    expectAbsent("one of the liturgical traditions");
  });

  it("sacrament: the teaching sections, without Catechism references or a doubled lede", async () => {
    put(
      "SACRAMENT",
      "anointing-of-the-sick",
      "The Anointing of the Sick",
      {
        summary: "By the sacred anointing the whole Church commends those who are ill.",
        theologicalOverview:
          "By the sacred anointing the whole Church commends those who are ill. It is a sacrament.",
        minister: "Priests alone.",
        catechismReferences: ["CCC 1499-1532"],
        sacramentKey: "anointing_of_the_sick",
        relatedRites: [],
      },
      "Sacrament of Healing",
    );
    const { container } = render(await SacramentDetailPage(params("anointing-of-the-sick")));
    expect(sections()).toEqual(["What the Church teaches", "Minister"]);
    expect(screen.getAllByText(/whole Church commends/)).toHaveLength(1);
    // The group is the label over the name, said once.
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent("Sacrament of Healing");
    expect(screen.getAllByText("Sacrament of Healing")).toHaveLength(1);
    expectAbsent("CCC 1499", "Catechism references", "anointing_of_the_sick");
  });

  it("sacrament: matter and form are two labelled rows, matter first as the heading says", async () => {
    put(
      "SACRAMENT",
      "baptism",
      "Baptism",
      {
        // Postgres returns a payload's keys shortest first, so "form" arrives first.
        matterAndForm: {
          form: "I baptize you in the name of the Father.",
          matter: "Natural water.",
        },
        sacramentKey: "baptism",
      },
      "Sacrament of Christian Initiation",
    );
    const { container } = render(await SacramentDetailPage(params("baptism")));
    expect(sections()).toEqual(["Matter and form"]);
    const rows = Array.from(container.querySelectorAll(".vf-pairs > div")).map((row) => [
      row.querySelector("dt")?.textContent,
      row.querySelector("dd")?.textContent,
    ]);
    expect(rows).toEqual([
      ["Matter", "Natural water."],
      ["Form", "I baptize you in the name of the Father."],
    ]);
  });

  it("church document: facts, summary, excerpt, themes and the full text — no slugs or 'source'", async () => {
    put(
      "CHURCH_DOCUMENT",
      "ad-caeli-reginam",
      "Ad Caeli Reginam",
      {
        summary: "The encyclical on the Queenship of the Blessed Virgin Mary.",
        bodyExcerpt: "We decree and establish the feast of Mary's Queenship.",
        keyThemes: ["Mary's queenship", "The divine motherhood"],
        documentType: "encyclical",
        issuingAuthority: "Pope Pius XII",
        issuedDate: "1954-10-11",
        relatedDocuments: ["quas-primas", "redemptoris-mater"],
        canonicalUrl: "https://www.vatican.va/ad-caeli-reginam.html",
        contentSubtype: "encyclical",
      },
      "Encyclical of Pope Pius XII (1954)",
    );
    const { container } = render(await LiturgyHistoryDetailPage(params("ad-caeli-reginam")));
    expect(facts()).toEqual([
      "Date: 11 October 1954",
      "Type: Encyclical",
      "Issued by: Pope Pius XII",
    ]);
    expect(sections()).toEqual(["Excerpt", "Key themes"]);
    const fullText = screen.getByRole("link", {
      name: "Read the full document (opens in a new tab)",
    });
    expect(fullText).toHaveAttribute("href", "https://www.vatican.va/ad-caeli-reginam.html");
    expect(fullText).toHaveClass("vf-btn", "vf-btn-ghost");
    expect(container.querySelectorAll(".vf-btn-primary")).toHaveLength(0);
    expectAbsent(
      "Encyclical of Pope Pius XII",
      "quas-primas",
      "Official source",
      "Document type",
      "Issuing authority",
    );
  });

  it("church document: a council's placeholder date reads as its year, and its article as an article", async () => {
    put("CHURCH_DOCUMENT", "council-of-ephesus", "Council of Ephesus", {
      summary: "The third ecumenical council.",
      keyThemes: ["Theotokos"],
      documentType: "council_document",
      issuingAuthority: "Catholic Church",
      issuedDate: "0431-01-01",
      canonicalUrl: "https://en.wikipedia.org/wiki/Council_of_Ephesus",
    });
    render(await LiturgyHistoryDetailPage(params("council-of-ephesus")));
    expect(facts()).toEqual(["Date: 431", "Type: Ecumenical Council"]);
    expect(
      screen.getByRole("link", { name: "Read more on Wikipedia (opens in a new tab)" }),
    ).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Council_of_Ephesus");
    expectAbsent("Read the full document", "Catholic Church", "January");
  });

  it("church document: an excerpt the ingest kept in another language or as raw codes is left out", async () => {
    put("CHURCH_DOCUMENT", "munificentissimus-deus", "Munificentissimus Deus", {
      summary: "The definition of the Assumption.",
      keyThemes: ["The Assumption"],
      bodyExcerpt:
        "1. Deus munificent ssimo, que tudo pode, e cujos planos de provid ncia s o cheios de " +
        "sabedoria e de amor, nos seus imperscrut veis des gnios.",
      documentType: "apostolic_constitution",
      issuedDate: "1950-11-01",
    });
    render(await LiturgyHistoryDetailPage(params("munificentissimus-deus")));
    expect(sections()).toEqual(["Key themes"]);
    expectAbsent("Deus munificent");
  });

  it("liturgical entry: the text unlabelled and its readings — no 'Rank: n/a'", async () => {
    put(
      "LITURGICAL",
      "holy-saturday",
      "Holy Saturday and the Easter Vigil",
      {
        body: "The Church waits at the Lord's tomb.",
        kind: "liturgical_season",
        rank: "n/a",
        season: "triduum",
        movableFeast: true,
        associatedReadings: ["Exodus 14:15—15:1", "Romans 6:3-11"],
        associatedSaintSlugs: [],
        contentSubtype: "liturgical_season",
      },
      "Season of the liturgical year",
    );
    const { container } = render(await LiturgyHistoryDetailPage(params("holy-saturday")));
    expect(sections()).toEqual(["Readings"]);
    expect(screen.getByText("The Church waits at the Lord's tomb.")).toBeInTheDocument();
    // A day is not a season, whatever the record files it under.
    expect(container.querySelector(".vf-eyebrow")).toHaveTextContent("Liturgy");
    expectAbsent("n/a", "Kind", "triduum", "liturgical_season", "Movable", "Season of");
  });

  it("liturgical entry: rank, date and season as facts, and the day's saint as a real link", async () => {
    put("SAINT", "saint-james-the-greater", "Saint James the Greater", {});
    put(
      "LITURGICAL",
      "feast-saint-james",
      "Feast of Saint James, Apostle",
      {
        body: "James was the first of the apostles to be martyred.",
        kind: "feast",
        feastDate: "07-25",
        season: "ordinary_time",
        movableFeast: false,
        associatedReadings: [],
        associatedSaintSlugs: ["saint-james-the-greater", "not-published"],
      },
      "Feast · July 25 · Ordinary Time",
    );
    render(await LiturgyHistoryDetailPage(params("feast-saint-james")));
    expect(facts()).toEqual([
      "Rank: Feast",
      "Date: July 25",
      "Season: Ordinary Time",
      "Saint of this day: Saint James the Greater",
    ]);
    const saint = screen.getByRole("link", { name: "Saint James the Greater" });
    expect(saint).toHaveClass("vf-link");
    expect(sections()).toEqual([]);
    expectAbsent("not-published", "Feast · July 25");
  });

  it("Marian title: feast once, content sections — no aliases or subtype", async () => {
    put(
      "MARIAN_TITLE",
      "immaculate-conception",
      "The Immaculate Conception",
      {
        slug: "immaculate-conception",
        origin: "Defined by Pope Pius IX in 1854.",
        theologicalSignificance: "Mary was preserved from original sin.",
        feastDay: "12-08",
        region: "Universal Church",
        aliases: ["Immaculata"],
        contentSubtype: "dogma",
        associatedPrayers: [],
      },
      "Marian dogma · defined 1854",
    );
    put(
      "MARIAN_TITLE",
      "our-lady-of-fatima",
      "Our Lady of Fatima",
      {
        slug: "our-lady-of-fatima",
        origin: "In 1917 the Blessed Virgin appeared at Fátima.",
        feastDay: "05-13",
        region: "Portugal",
      },
      "Title of the Blessed Virgin Mary · Feast May 13",
    );
    const dogma = render(await OurLadyDetailPage(params("immaculate-conception")));
    expect(dogma.container.querySelector(".vf-eyebrow")).toHaveTextContent("Marian dogma");
    expect(facts()).toEqual(["Feast day: December 8", "Defined: 1854"]);
    expect(sections()).toEqual(["Origin", "Why it matters"]);
    expectAbsent("Immaculata", "Universal Church", "Content subtype", "Marian dogma · defined");
    cleanup();

    const title = render(await OurLadyDetailPage(params("our-lady-of-fatima")));
    expect(title.container.querySelector(".vf-eyebrow")).toHaveTextContent(
      "Title of the Blessed Virgin Mary",
    );
    expect(facts()).toEqual(["Feast day: May 13", "Region: Portugal"]);
    expect(screen.getAllByText(/May 13/)).toHaveLength(1);
  });

  it("Marian title: its apparition is a real link among the facts", async () => {
    put("APPARITION", "apparition-of-lourdes", "Apparition of Our Lady of Lourdes", {});
    put("MARIAN_TITLE", "our-lady-of-lourdes", "Our Lady of Lourdes", {
      origin: "At Lourdes in 1858.",
      associatedApparitionSlug: "apparition-of-lourdes",
    });
    render(await OurLadyDetailPage(params("our-lady-of-lourdes")));
    expect(facts()).toEqual(["Apparition: Apparition of Our Lady of Lourdes"]);
    expect(screen.getByRole("link", { name: /Apparition of Our Lady of Lourdes/ })).toHaveClass(
      "vf-link",
    );
  });

  it("apparition: status, place, year, feast and visionaries are facts — no 'Official source'", async () => {
    put(
      "APPARITION",
      "lourdes",
      "Our Lady of Lourdes",
      {
        background: "Eighteen apparitions to Bernadette Soubirous.",
        visionaries: ["Bernadette Soubirous"],
        location: "Lourdes",
        country: "France",
        approvedStatus: "approved",
        yearOfApparition: 1858,
        decisionAuthority: "Bishop of Tarbes",
        feastDay: "02-11",
        officialDocumentUrl: "https://www.vatican.va/lourdes.html",
      },
      "Church-approved Marian apparition · Lourdes, France, 1858",
    );
    render(await OurLadyDetailPage(params("lourdes")));
    expect(facts()).toEqual([
      "Status: Church-approved Marian apparition",
      "Place: Lourdes, France",
      "Year: 1858",
      "Feast day: February 11",
      "Visionaries: Bernadette Soubirous",
    ]);
    expect(sections()).toEqual(["Background"]);
    expectAbsent(
      "Official source",
      "vatican.va",
      "Bishop of Tarbes",
      "Approved status",
      "France, 1858",
    );
    // A title that resolves to nothing leaves no fact, and nothing here is a link.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("apparition: names are plain lines, and only a real link looks like one", async () => {
    put("MARIAN_TITLE", "our-lady-of-fatima", "Our Lady of Fátima", {});
    put("APPARITION", "fatima", "Apparition of Our Lady of Fatima", {
      summary: "From May through October 1917.",
      background: "Approved by the Bishop of Leiria in 1930.",
      visionaries: ["Saint Lucia dos Santos", "Saint Francisco Marto", "Saint Jacinta Marto"],
      approvedStatus: "approved",
      associatedMarianTitleSlug: "our-lady-of-fatima",
    });
    const { container } = render(await OurLadyDetailPage(params("fatima")));
    const names = container.querySelector(".vf-facts ul.vf-plain-list");
    expect(names).toHaveAttribute("role", "list");
    expect(names?.querySelectorAll("a, button")).toHaveLength(0);
    expect(Array.from(names?.querySelectorAll("li") ?? []).map((li) => li.textContent)).toEqual([
      "Saint Lucia dos Santos",
      "Saint Francisco Marto",
      "Saint Jacinta Marto",
    ]);
    const title = screen.getByRole("link", { name: "Our Lady of Fátima" });
    expect(title).toHaveClass("vf-link");
    expect(title).toHaveAttribute("href", "/our-lady/our-lady-of-fatima");
    expect(facts()).toContain("Under the title: Our Lady of Fátima");
    // "Apparition" over "Apparition of Our Lady of Fatima" only repeated the name.
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
    // The facts come first, then the actions, and the summary runs on into the sections.
    const order = Array.from(container.querySelectorAll(".vf-facts, .vf-detail-actions, .vf-lede"));
    expect(order.map((el) => el.className.split(" ")[0])).toEqual([
      "vf-facts",
      "vf-detail-actions",
      "vf-lede",
    ]);
  });

  it("novena: when to begin, the introduction, the days — no 'Structure: nine_days'", async () => {
    put(
      "NOVENA",
      "novena-saint-joseph",
      "Novena to Saint Joseph",
      {
        summary: "Nine days of prayer before the Solemnity of Saint Joseph.",
        background: "Prayed before his solemnity since the seventeenth century.",
        typicalStartDate: "March 10, concluding March 18",
        intentionTheme: "the protection of families",
        structure: "nine_days",
        durationDays: 9,
        days: [{ day: 1, title: "Joseph the just man", prayerText: "O good Saint Joseph..." }],
        associatedSaintSlug: "saint-joseph",
      },
      "Nine-day novena to Saint Joseph · begins March 10, concluding March 18",
    );
    render(await NovenaDetailPage(params("novena-saint-joseph")));
    // When it is kept sits with the title as facts; the practical days come
    // straight after the summary, and the history after them.
    const facts = document.querySelector("dl.vf-facts")!;
    expect([...facts.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual([
      "Begins",
      "Ends",
    ]);
    expect([...facts.querySelectorAll("dd")].map((dd) => dd.textContent)).toEqual([
      "March 10",
      "March 18",
    ]);
    expect(sections()).toEqual(["Days", "Background"]);
    expectAbsent("nine_days", "Structure", "Intention", "Duration", "Nine-day novena to Saint");
  });

  it("devotion: the duration line instead of the subtitle, no related-saint row", async () => {
    put(
      "DEVOTION",
      "first-fridays",
      "The Nine First Fridays",
      {
        summary: "Communion of reparation on nine consecutive first Fridays.",
        background: "Asked of Saint Margaret Mary Alacoque.",
        practiceInstructions: "Receive Holy Communion on the first Friday of nine months.",
        durationMinutes: 60,
        devotionType: "christological",
        subtype: "reparation",
        contentSubtype: "devotion",
        relatedSaints: ["saint-margaret-mary"],
        relatedPrayers: [],
      },
      "Devotion to Christ · 60 min",
    );
    put("SAINT", "saint-margaret-mary", "Margaret Mary (saint page)", {});
    render(await DevotionDetailPage(params("first-fridays")));
    expect(screen.getByText("About 1 hour")).toBeInTheDocument();
    // How to pray it first, the history after it.
    expect(sections()).toEqual(["How to practice", "Background"]);
    expectAbsent("Devotion to Christ", "Margaret Mary (saint page)", "christological");
  });

  it("devotion: a description stored in both fields is shown once, with no how-to heading", async () => {
    const text = "The First Saturdays Devotion is a Catholic devotion requested at Fatima.";
    put("DEVOTION", "first-saturday-devotions", "First Saturdays", {
      summary: text,
      background: text,
      practiceInstructions: text,
      relatedPrayers: [],
    });
    render(await DevotionDetailPage(params("first-saturday-devotions")));
    expect(sections()).toEqual([]);
    expect(screen.getAllByText(text)).toHaveLength(1);
  });

  it("devotion: the words it prays under their own heading, not a second 'How to practice'", async () => {
    // The live Green Scapular: its instructions, then the words on the scapular.
    put("DEVOTION", "green-scapular", "The Green Scapular", {
      summary: "A sacramental for conversion.",
      practiceInstructions:
        "Have the green scapular blessed by a priest. Each day pray the words that appear on it.",
      practiceText: "Immaculate Heart of Mary, pray for us now and at the hour of our death.",
      relatedPrayers: [],
    });
    render(await DevotionDetailPage(params("green-scapular")));
    expect(sections()).toEqual(["How to practice", "Prayer"]);
    expect(
      screen.getByText("Immaculate Heart of Mary, pray for us now and at the hour of our death."),
    ).toBeInTheDocument();
  });
});
