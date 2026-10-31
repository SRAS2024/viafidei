/**
 * @vitest-environment jsdom
 */
/**
 * The content pages in the reader's language (src/lib/translation) on top of
 * the owner's page layout (wp/site-polish, wp/saint-turbo). A page shows what
 * it shows an English reader, in the same order and with the same things left
 * out; only the text changes. Saints' names and Latin stay as written, a
 * prayer translated for the reader is marked up as the reader's language, a
 * church name in another script is transliterated in memory, and a redirect
 * asks the translation cache nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { PublishedItem } from "@/lib/data/published";
import type { Locale } from "@/lib/i18n/locales";
import { planItem, unitHash } from "@/lib/translation/segments";
import { resetTranslationStoreState, setTranslationDb, type Db } from "@/lib/translation/store";

const published = new Map<string, PublishedItem>();
let locale: Locale = "es";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: () => {
    throw new Error("redirect");
  },
}));

// The reader's language arrives as in production: the `vf_locale` cookie.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "vf_locale" ? { name, value: locale } : undefined),
  }),
  headers: async () => new Headers(),
}));

vi.mock("@/components/profile", () => ({
  SaveContentButton: () => null,
}));

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return {
    ...actual,
    getPublishedBySlug: async (contentType: string, slug: string) =>
      published.get(`${contentType}:${slug}`) ?? null,
    listPublished: async (contentType: string) =>
      [...published.values()].filter((item) => item.contentType === contentType),
    listPublishedBySlugs: async (contentType: string, slugs: string[]) =>
      slugs
        .map((slug) => published.get(`${contentType}:${slug}`))
        .filter((item): item is PublishedItem => item != null),
    buildPublishedMetadata: () => ({}),
  };
});

import DevotionDetailPage from "@/app/devotions/[slug]/page";
import ParishDetailPage from "@/app/parishes/[slug]/page";
import PrayerDetailPage from "@/app/prayers/[slug]/page";
import SaintDetailPage from "@/app/saints/[slug]/page";
import SpiritualLifeDetailPage from "@/app/spiritual-life/[slug]/page";

function put(
  contentType: string,
  slug: string,
  title: string,
  payload: Record<string, unknown>,
  subtitle = "",
): PublishedItem {
  const item = {
    id: slug,
    contentType,
    slug,
    title,
    subtitle,
    authorityLevel: "VATICAN",
    version: 1,
    payload,
  } as unknown as PublishedItem;
  published.set(`${contentType}:${slug}`, item);
  return item;
}

/** The Spanish rows of the translation cache, by the English unit each translates. */
function spanishCache(rows: Array<[PublishedItem, string, string]>) {
  const byHash = new Map<string, string>();
  for (const [item, source, text] of rows) {
    const unit = planItem(item).units.find((u) => u.source === source);
    if (!unit) throw new Error(`no unit "${source}" in ${item.slug}`);
    byHash.set(unitHash("es", unit), text);
  }
  const db = {
    $queryRaw: vi.fn(async (sql: { values: unknown[] }) => {
      const [lang, hashes] = sql.values as [string, string[]];
      if (lang !== "es") return [];
      return hashes
        .filter((h) => byHash.has(h))
        .map((h) => ({ sourceHash: h, text: byHash.get(h)! }));
    }),
    $executeRaw: vi.fn(async () => 1),
  };
  setTranslationDb(db as unknown as Db);
  return db;
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const pageText = () => document.body.textContent ?? "";
const expectAbsent = (...needles: string[]) => {
  const text = pageText();
  for (const needle of needles) expect(text, needle).not.toContain(needle);
};
/** The lines under the title, in order. */
const headerLines = () =>
  [...document.querySelectorAll("header p")].map((p) => p.textContent ?? "");

beforeEach(() => {
  published.clear();
  resetTranslationStoreState();
  locale = "es";
});
afterEach(() => {
  cleanup();
  setTranslationDb(null);
});

describe("a saint's page in Spanish", () => {
  it("keeps the owner's lines and order, and never shows a composed biography's source pointer", async () => {
    const isidore = put(
      "SAINT",
      "saint-isidore-the-farmer",
      "Saint Isidore the Farmer",
      {
        canonizationStatus: "canonized",
        feastDay: "05-15",
        feastMonth: 5,
        feastDayOfMonth: 15,
        patronages: ["farmers"],
        birthDate: "1070",
        deathDate: "1130",
        biography:
          "Isidore was a farmer near Madrid. A fuller biography is recorded in the " +
          "Spanish-language Wikipedia article and on Wikidata.",
        summary: "Saint Isidore, farmer of Madrid.",
        provenance: { biography: "structured-facts" },
        wikidataQid: "Q311179",
      },
      "Farmer · Feast May 15",
    );
    spanishCache([
      [isidore, "Isidore was a farmer near Madrid.", "Isidore fue un labrador cerca de Madrid."],
      [
        isidore,
        "A fuller biography is recorded in the Spanish-language Wikipedia article and on Wikidata.",
        "Una biografía más completa figura en Wikipedia en español y en Wikidata.",
      ],
      [isidore, "Farmer · Feast May 15", "Labrador · Fiesta el 15 de mayo"],
      [isidore, "farmers", "agricultores"],
      [isidore, "Saint Isidore, farmer of Madrid.", "San Isidro, labrador de Madrid."],
    ]);
    render(await SaintDetailPage(params("saint-isidore-the-farmer")));

    // The name is never machine-translated, and nothing sits above it.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Saint Isidore the Farmer");
    expect(document.querySelector(".vf-eyebrow")).toBeNull();
    // The card's own lines from the stored record, then the dates lived.
    expect(headerLines()).toEqual(["Patron of farmers", "Feast day: May 15", "1070 – 1130"]);
    // The biography in Spanish, the saint's name kept as written.
    expect(pageText()).toContain("Isidore fue un labrador cerca de Madrid.");
    // No source pointer in either language, no subtitle, no summary.
    expectAbsent(
      "Wikidata",
      "Wikipedia",
      "Labrador · Fiesta",
      "San Isidro, labrador",
      "agricultores",
    );
  });

  it("credits Wikipedia under a translated biography, from the stored record", async () => {
    const burjan = put("SAINT", "blessed-hildegard-burjan", "Blessed Hildegard Burjan", {
      canonizationStatus: "beatified",
      biography: "Hildegard Burjan founded the Sisters of Social Service.",
      provenance: {
        article: "https://en.wikipedia.org/wiki/Hildegard_Burjan",
        biography: "wikipedia",
      },
    });
    spanishCache([
      [
        burjan,
        "Hildegard Burjan founded the Sisters of Social Service.",
        "Hildegard Burjan fundó las Hermanas del Servicio Social.",
      ],
    ]);
    render(await SaintDetailPage(params("blessed-hildegard-burjan")));
    expect(pageText()).toContain("Hildegard Burjan fundó las Hermanas del Servicio Social.");
    const credit = screen.getByRole("link", { name: "Wikipedia (Hildegard Burjan)" });
    expect(credit.getAttribute("href")).toBe("https://en.wikipedia.org/wiki/Hildegard_Burjan");
    expect(pageText()).toContain("CC BY-SA 4.0");
  });
});

describe("a devotion's prayers in Spanish", () => {
  it("are chosen and ordered from the English, and shown in Spanish", async () => {
    const ourFather = put("PRAYER", "our-father", "Our Father", {
      language: "en",
      body: "Our Father, who art in heaven, hallowed be thy name.",
      latin: "Pater noster, qui es in caelis, sanctificetur nomen tuum.",
    });
    const holyHour = put(
      "DEVOTION",
      "the-holy-hour",
      "The Holy Hour",
      {
        background: "Keep one hour of prayer in the night.",
        practiceInstructions: "Kneel and pray one Our Father.",
        indulgences: { claimed: true, citation: "Enchiridion Indulgentiarum, 4th ed." },
      },
      "Eucharistic devotion",
    );
    spanishCache([
      [holyHour, "The Holy Hour", "La Hora Santa"],
      [holyHour, "Eucharistic devotion", "Devoción eucarística"],
      [
        holyHour,
        "Keep one hour of prayer in the night.",
        "Guarde una hora de oración en la noche.",
      ],
      [holyHour, "Kneel and pray one Our Father.", "Arrodíllese y rece un Padre Nuestro."],
      [ourFather, "Our Father", "Padre Nuestro"],
      [
        ourFather,
        "Our Father, who art in heaven, hallowed be thy name.",
        "Padre nuestro, que estás en el cielo, santificado sea tu nombre.",
      ],
    ]);
    render(await DevotionDetailPage(params("the-holy-hour")));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("La Hora Santa");
    expect(pageText()).toContain("Guarde una hora de oración en la noche.");
    // The owner's sections and nothing more: no subtitle, no indulgence source.
    expectAbsent("Devoción eucarística", "Eucharistic devotion", "Citation", "Enchiridion");

    // The instruction names the prayer in Spanish, and the name opens it in place.
    const article = screen.getByRole("article");
    fireEvent.click(within(article).getByRole("button", { name: /Padre Nuestro/ }));
    const inline = within(article).getByText(
      "Padre nuestro, que estás en el cielo, santificado sea tu nombre.",
    );
    expect(inline.getAttribute("lang")).toBe("es");

    // The list below: the English instructions name it, so it is numbered.
    const list = screen
      .getByRole("heading", { name: "Prayers of this devotion" })
      .closest("section")!;
    expect(within(list).getByText("Prayer 1")).toBeTruthy();
    expect(within(list).getByRole("button", { name: "Latin" })).toBeTruthy();
    fireEvent.click(within(list).getByRole("button", { name: /Padre Nuestro/ }));
    expect(
      within(list)
        .getByText("Padre nuestro, que estás en el cielo, santificado sea tu nombre.")
        .getAttribute("lang"),
    ).toBe("es");
  });
});

describe("a prayer's page in Spanish", () => {
  it("is the title and the prayer, marked up as Spanish, with the Latin chip", async () => {
    const hailMary = put(
      "PRAYER",
      "hail-mary",
      "Hail Mary",
      {
        language: "en",
        body: "Hail Mary, full of grace.",
        latin: "Ave Maria, gratia plena.",
        summary: "The angelic salutation.",
        officialPrayer: "Hail Mary, full of grace, the Lord is with thee.",
        occasions: ["daily"],
        category: "marian",
        citations: ["https://www.vatican.va/archive/ENG0015/__P1.HTM"],
      },
      "Catholic prayer · Latin text",
    );
    spanishCache([
      [hailMary, "Hail Mary", "Dios te salve, María"],
      [hailMary, "Hail Mary, full of grace.", "Dios te salve, María, llena eres de gracia."],
      [hailMary, "The angelic salutation.", "La salutación angélica."],
    ]);
    render(await PrayerDetailPage(params("hail-mary")));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Dios te salve, María");
    const text = screen.getByText("Dios te salve, María, llena eres de gracia.");
    expect(text.getAttribute("lang")).toBe("es");
    expect(document.querySelector(".vf-eyebrow")).toBeNull();
    expectAbsent(
      "English",
      "Official text",
      "When it is prayed",
      "Sources",
      "La salutación angélica.",
      "Catholic prayer",
    );

    // The Latin is the stored text, never translated.
    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    const latin = screen.getByText("Ave Maria, gratia plena.");
    expect(latin.getAttribute("lang")).toBe("la");
    expect(latin.getAttribute("translate")).toBe("no");
  });
});

describe("a church's page in Spanish", () => {
  it("transliterates a name in another script and keeps the card, with no cache lookup", async () => {
    put("PARISH", "myeongdong-cathedral", "명동대성당", {
      designation: "cathedral",
      address: "74 Myeongdong-gil, Jung-gu",
      postalCode: "04537",
      city: "Seoul",
      country: "South Korea",
      countryCode: "KR",
      website: "https://www.mdsd.or.kr",
      diocese: "Archdiocese of Seoul",
      latitude: 37.5633,
      longitude: 126.9873,
    });
    const db = spanishCache([]);
    render(await ParishDetailPage(params("myeongdong-cathedral")));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Myeongdong Daeseongdang (명동대성당)",
    );
    expect(screen.getByText("Cathedral")).toBeTruthy();
    const lines = [...document.querySelectorAll("address span")].map((s) => s.textContent);
    expect(lines).toEqual(["74 Myeongdong-gil, Jung-gu", "04537 Seoul", "Corea del Sur"]);
    expectAbsent("mdsd.or.kr", "Diocese", "Archdiocese of Seoul");
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("still places a US ZIP code after the town once the country is named in Spanish", async () => {
    put("PARISH", "st-turibius", "St. Turibius Catholic Church", {
      designation: "parish",
      address: "5646 S Karlov Ave",
      postalCode: "60629",
      city: "Chicago",
      state: "IL",
      country: "United States",
    });
    render(await ParishDetailPage(params("st-turibius")));
    const lines = [...document.querySelectorAll("address span")].map((s) => s.textContent);
    expect(lines).toEqual(["5646 S Karlov Ave", "Chicago, IL 60629", "Estados Unidos"]);
  });
});

describe("an old guide link under /spiritual-life", () => {
  it("redirects without asking the translation cache anything", async () => {
    put("GUIDE", "how-to-pray-the-rosary", "How to Pray the Rosary", { steps: [] });
    const db = spanishCache([]);
    await expect(SpiritualLifeDetailPage(params("how-to-pray-the-rosary"))).rejects.toThrow(
      "redirect",
    );
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
