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
    const flow = Array.from(container.querySelectorAll("h1, header p, article > section p")).map(
      (el) => el.textContent ?? "",
    );
    expect(flow).toEqual([
      "Saint Godeberta",
      "Patron of Noyon, invoked against drought",
      "Feast day: April 11",
      "640 – 670",
      "Godeberta was a saint and abbess, born in Amiens.",
    ]);
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
    expect(screen.getByText("Feast day: February 7")).toBeInTheDocument();
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
  it("pope: the papacy line, the birth name, the life — no repeated summary", async () => {
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
    render(await PopeDetailPage(params("pope-john")));
    expect(screen.getByText("Pope from 1958 to 1963")).toBeInTheDocument();
    expect(screen.getByText("Born Angelo Giuseppe Roncalli")).toBeInTheDocument();
    expect(screen.getByText(/head of the Catholic Church/)).toBeInTheDocument();
    expect(sections()).toEqual([]);
    expectAbsent("who reigned as Roman Pontiff", "Papacy began", "pope_biography");
  });

  it("doctor: the subtitle and the life — no feast month or ecclesial role rows", async () => {
    put(
      "DOCTOR",
      "doctor-albert-the-great",
      "Saint Albert the Great",
      {
        background: "Dominican bishop and teacher of Saint Thomas Aquinas.",
        summary: "Saint Albert the Great, Universal Doctor, declared a Doctor of the Church.",
        doctorTitle: "Universal Doctor",
        feastDay: "11-15",
        feastMonth: 11,
        feastDayOfMonth: 15,
        ecclesialRole: "bishop",
      },
      "Bishop · Doctor of the Church — Universal Doctor · Feast November 15",
    );
    render(await DoctorDetailPage(params("doctor-albert-the-great")));
    expect(screen.getByText(/Universal Doctor · Feast November 15/)).toBeInTheDocument();
    expect(sections()).toEqual([]);
    expectAbsent("declared a Doctor of the Church.", "Feast month", "Ecclesial role");
  });

  it("rite: history, liturgy, region and faithful — no family, entry kind or second summary", async () => {
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
    render(await RiteDetailPage(params("rite-alexandrian")));
    expect(sections()).toEqual(["History", "Background", "Region", "Faithful"]);
    expect(screen.getAllByText(/liturgical family of Egypt/)).toHaveLength(1);
    expectAbsent("liturgical_rite", "Entry kind", "Family");
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
    render(await SacramentDetailPage(params("anointing-of-the-sick")));
    expect(sections()).toEqual(["What the Church teaches", "Minister"]);
    expect(screen.getAllByText(/whole Church commends/)).toHaveLength(1);
    expectAbsent("CCC 1499", "Catechism references", "anointing_of_the_sick");
  });

  it("church document: subtitle, summary, excerpt, themes and the full text — no slugs or 'source'", async () => {
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
    render(await LiturgyHistoryDetailPage(params("ad-caeli-reginam")));
    expect(sections()).toEqual(["Excerpt", "Key themes"]);
    expect(screen.getByRole("link", { name: /Read the full document/ })).toHaveAttribute(
      "href",
      "https://www.vatican.va/ad-caeli-reginam.html",
    );
    expectAbsent("quas-primas", "Official source", "Document type", "Issuing authority");
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
    render(await LiturgyHistoryDetailPage(params("holy-saturday")));
    expect(sections()).toEqual(["Readings"]);
    expect(screen.getByText("The Church waits at the Lord's tomb.")).toBeInTheDocument();
    expectAbsent("n/a", "Kind", "triduum", "liturgical_season", "Movable");
  });

  it("Marian title: feast once, content sections — no aliases, region rows or subtype", async () => {
    put(
      "MARIAN_TITLE",
      "immaculate-conception",
      "The Immaculate Conception",
      {
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
      { origin: "In 1917 the Blessed Virgin appeared at Fátima.", feastDay: "05-13" },
      "Title of the Blessed Virgin Mary · Feast May 13",
    );
    render(await OurLadyDetailPage(params("immaculate-conception")));
    // The dogma's subtitle has no feast, so the page gives it its own line.
    expect(screen.getByText("Feast day: December 8")).toBeInTheDocument();
    expect(sections()).toEqual(["Origin", "Why it matters"]);
    expectAbsent("Immaculata", "Universal Church", "Content subtype");
    expect(screen.getAllByText("Marian dogma · defined 1854")).toHaveLength(1);
    cleanup();

    render(await OurLadyDetailPage(params("our-lady-of-fatima")));
    expect(screen.queryByText("Feast day: May 13")).not.toBeInTheDocument();
    expect(screen.getAllByText(/May 13/)).toHaveLength(1);
  });

  it("apparition: the subtitle carries place, status and year — no 'Official source'", async () => {
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
    expect(screen.getByText("Feast day: February 11")).toBeInTheDocument();
    expect(sections()).toEqual(["Background", "Visionaries"]);
    expectAbsent("Official source", "vatican.va", "Bishop of Tarbes", "Approved status");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
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
    expect(screen.getByText("Begins: March 10, concluding March 18")).toBeInTheDocument();
    expect(sections()).toEqual(["Days"]);
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
    expect(sections()).toEqual(["How to practice"]);
    expectAbsent("Devotion to Christ", "Margaret Mary (saint page)", "christological");
  });
});
