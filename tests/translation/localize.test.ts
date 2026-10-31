import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { displayItem, displayOverlay, displayPrayerVariants } from "@/lib/translation/display";
import {
  finalizeTranslation,
  localCountryName,
  localizeItem,
  localizeItems,
  localizeParishes,
  regionCodeForEnglishName,
} from "@/lib/translation/localize";
import { planItem, unitHash, type PlannableItem } from "@/lib/translation/segments";
import {
  fileDemand,
  flushDemand,
  LOOKUP_TIMEOUT_MS,
  readTranslations,
  resetTranslationStoreState,
  setTranslationDb,
  translationsPaused,
  type Db,
} from "@/lib/translation/store";

/** A ContentTranslation table in memory: lang → hash → text. */
function fakeDb(rows: Record<string, Record<string, string>> = {}) {
  const queries: unknown[][] = [];
  const inserts: unknown[][] = [];
  const db = {
    $queryRaw: vi.fn(async (sql: { values: unknown[] }) => {
      const [lang, hashes] = sql.values as [string, string[]];
      queries.push(hashes);
      return hashes
        .filter((h) => rows[lang]?.[h] !== undefined)
        .map((h) => ({ sourceHash: h, text: rows[lang]![h]! }));
    }),
    $executeRaw: vi.fn(async (sql: { values: unknown[] }) => {
      inserts.push(sql.values);
      return 1;
    }),
  };
  return { db: db as unknown as Db & typeof db, queries, inserts };
}

const devotion: PlannableItem = {
  contentType: "DEVOTION",
  slug: "holy-hour",
  title: "The Holy Hour",
  subtitle: "Eucharistic adoration",
  payload: {
    summary: "Watch one hour with Christ.",
    background: "St. Margaret Mary saw the Sacred Heart.",
    devotionType: "eucharistic",
  },
};

const hashOf = (item: PlannableItem, lang: string, source: string) => {
  const unit = planItem(item).units.find((u) => u.source === source)!;
  return unitHash(lang, unit);
};

beforeEach(() => {
  resetTranslationStoreState();
  vi.unstubAllEnvs();
});
afterEach(() => {
  setTranslationDb(null);
  vi.unstubAllEnvs();
});

describe("reading the translation cache", () => {
  it("returns stored texts, then answers from memory", async () => {
    const { db, queries } = fakeDb({ es: { h1: "uno" } });
    setTranslationDb(db);
    expect(await readTranslations("es", ["h1", "h2"])).toEqual(new Map([["h1", "uno"]]));
    expect(await readTranslations("es", ["h1", "h2"])).toEqual(new Map([["h1", "uno"]]));
    expect(queries).toEqual([["h1", "h2"]]);
  });

  it("never waits longer than its timeout for a slow database", async () => {
    setTranslationDb({
      $queryRaw: () => new Promise(() => {}),
      $executeRaw: vi.fn(),
    } as unknown as Db);
    const started = Date.now();
    expect(await readTranslations("es", ["h1"])).toEqual(new Map());
    expect(Date.now() - started).toBeLessThan(LOOKUP_TIMEOUT_MS + 300);
  });

  it("pauses lookups when the table does not exist yet", async () => {
    const queryRaw = vi.fn(async () => {
      throw Object.assign(new Error('relation "ContentTranslation" does not exist'), {
        code: "42P01",
      });
    });
    setTranslationDb({ $queryRaw: queryRaw, $executeRaw: vi.fn() } as unknown as Db);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readTranslations("es", ["h1"])).toEqual(new Map());
    expect(translationsPaused()).toBe(true);
    expect(await readTranslations("es", ["h2"])).toEqual(new Map());
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all when translation is disabled", async () => {
    vi.stubEnv("TRANSLATION_DISABLED", "true");
    const { db } = fakeDb();
    setTranslationDb(db);
    expect(await readTranslations("es", ["h1"])).toEqual(new Map());
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("files demand once per unit, in one insert", async () => {
    const { db, inserts } = fakeDb();
    setTranslationDb(db);
    const unit = { kind: "text" as const, source: "Pray.", sourceLang: "en", protect: [] };
    fileDemand([
      { lang: "es", hash: "h1", unit },
      { lang: "es", hash: "h1", unit },
      { lang: "fr", hash: "h1", unit },
    ]);
    expect(await flushDemand()).toBe(2);
    fileDemand([{ lang: "es", hash: "h1", unit }]);
    expect(await flushDemand()).toBe(0);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual(expect.arrayContaining(["es", "fr", "h1", "Pray."]));
  });
});

describe("localizeItems", () => {
  it("leaves English and Latin readers' items exactly as they are, without a lookup", async () => {
    const { db } = fakeDb();
    setTranslationDb(db);
    for (const locale of ["en", "la"] as const) {
      const [out] = await localizeItems([devotion], { locale });
      expect(out).toBe(devotion);
    }
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("overlays what is translated, keeps English fields for logic, and files the rest", async () => {
    const { db, inserts } = fakeDb({
      es: {
        [hashOf(devotion, "es", "The Holy Hour")]: "La Hora Santa",
        [hashOf(devotion, "es", "Watch one hour with Christ.")]: "velad una hora con Cristo.",
        // A row whose protected saint's name did not survive is never shown.
        [hashOf(devotion, "es", "St. Margaret Mary saw the Sacred Heart.")]:
          "Santa Margarita María vio el Sagrado Corazón.",
      },
    });
    setTranslationDb(db);
    const [out] = await localizeItems([devotion], { locale: "es" });
    expect(out).not.toBe(devotion);
    expect(out!.title).toBe("The Holy Hour");
    expect(out!.payload).toBe(devotion.payload);
    const shown = displayItem(out!);
    expect(shown.title).toBe("La Hora Santa");
    expect(shown.subtitle).toBe("Eucharistic adoration");
    expect(shown.payload).toEqual({
      summary: "Velad una hora con Cristo.",
      background: "St. Margaret Mary saw the Sacred Heart.",
      devotionType: "eucharistic",
    });
    expect(displayOverlay(out)).toMatchObject({
      locale: "es",
      machineTranslated: true,
      pendingUnits: 2,
    });
    await flushDemand();
    // Only the subtitle was missing; the rejected row is not filed again.
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual(expect.arrayContaining(["Eucharistic adoration"]));
    expect(inserts[0]).not.toContain("St. Margaret Mary saw the Sacred Heart.");
  });

  it("labels a machine-translated prayer text as the reader's language, not English", async () => {
    const prayer: PlannableItem & { payload: Record<string, unknown> } = {
      contentType: "PRAYER",
      slug: "hail-mary",
      title: "Hail Mary",
      payload: {
        language: "en",
        body: "Hail Mary, full of grace.",
        latin: "Ave Maria, gratia plena.",
      },
    };
    const { db } = fakeDb({
      es: {
        [hashOf(prayer, "es", "Hail Mary, full of grace.")]:
          "Dios te salve, María, llena eres de gracia.",
      },
    });
    setTranslationDb(db);
    const [out] = await localizeItems([prayer], { locale: "es" });
    expect(displayPrayerVariants(out as typeof prayer)).toEqual([
      {
        code: "en",
        label: "Español",
        lang: "es",
        text: "Dios te salve, María, llena eres de gracia.",
        preserve: false,
      },
      { code: "la", label: "Latin", text: "Ave Maria, gratia plena.", preserve: true },
    ]);
    // Untranslated, it is the English it always was.
    expect(displayPrayerVariants(prayer)[0]).toEqual({
      code: "en",
      label: "English",
      text: "Hail Mary, full of grace.",
      preserve: false,
    });
  });

  it("serves the original when the cache cannot be read", async () => {
    setTranslationDb({
      $queryRaw: async () => {
        throw new Error("connection refused");
      },
      $executeRaw: vi.fn(),
    } as unknown as Db);
    const [out] = await localizeItems([devotion], { locale: "fr" });
    expect(displayItem(out!)).toEqual(devotion);
    expect(await localizeItem(null, { locale: "fr" })).toBeNull();
  });

  it("finalizes a stored row: typography, and the protected spans restored exactly", () => {
    const unit = {
      kind: "text" as const,
      source: "We sing the Salve Regina.",
      sourceLang: "en",
      protect: ["Salve Regina"],
    };
    expect(finalizeTranslation(unit, "Cantamos la salve regina.", "es")).toBe(
      "Cantamos la Salve Regina.",
    );
    expect(finalizeTranslation(unit, "Cantamos la Salve Reina.", "es")).toBeNull();
    expect(
      finalizeTranslation(
        { ...unit, kind: "name", protect: [] },
        "  Catedral  de Myeongdong ",
        "es",
      ),
    ).toBe("Catedral de Myeongdong");
  });
});

describe("localizeParishes (rule b)", () => {
  const seoul = { title: "명동대성당", country: "South Korea", countryCode: "KR" };
  const madrid = { title: "Parroquia San José", country: "Spain" };
  const kyiv = { title: "Церква Святого Миколая", country: "Ukraine" };
  const athens = { title: "Ναός Αγίου Ιωσήφ", country: "Greece" };
  const beijing = { title: "北京圣母无染原罪主教座堂", country: "China" };
  const boston = { title: "St. Mary's Catholic Church", country: "United States" };

  it("transliterates a foreign-script name, always showing the original, with no lookup at all", async () => {
    const { db } = fakeDb();
    setTranslationDb(db);
    const [s, m, k, a] = await localizeParishes([seoul, madrid, kyiv, athens], { locale: "en" });
    expect(s!.title).toBe("Myeongdong Daeseongdang (명동대성당)");
    expect(m).toBe(madrid);
    // The country decides the Cyrillic system: Ukrainian national transliteration.
    expect(k!.title).toBe("Tserkva Sviatoho Mykolaia (Церква Святого Миколая)");
    expect(a!.title).toBe("Naos Agiou Iosif (Ναός Αγίου Ιωσήφ)");
    expect(seoul.title).toBe("명동대성당"); // inputs are never changed
    await flushDemand();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("transliterates for every Latin-script reader and names the country in their language", async () => {
    const [es] = await localizeParishes([seoul, madrid], { locale: "es" });
    expect(es).toEqual({
      ...seoul,
      title: "Myeongdong Daeseongdang (명동대성당)",
      country: "Corea del Sur",
    });
    const [la] = await localizeParishes([seoul], { locale: "la" });
    expect(la!.title).toBe("Myeongdong Daeseongdang (명동대성당)");
    expect(la!.country).toBe("South Korea");
  });

  it("keeps a name in the reader's own script, and names the country in the reader's language", async () => {
    const [s, m] = await localizeParishes([seoul, madrid], { locale: "ko" });
    expect(s!.title).toBe("명동대성당");
    expect(s!.country).toBe("대한민국");
    expect(m!.title).toBe("Parroquia San José");
    expect(m!.country).toBe("스페인");
  });

  it("never machine-translates: Han stays as written, and so does a Latin name for CJK readers", async () => {
    const { db } = fakeDb();
    setTranslationDb(db);
    const [b, s] = await localizeParishes([beijing, boston], { locale: "ko" });
    expect(b!.title).toBe("北京圣母无染原罪主教座堂");
    expect(b!.country).toBe("중국");
    expect(s!.title).toBe("St. Mary's Catholic Church");
    const [b2] = await localizeParishes([beijing], { locale: "en" });
    expect(b2!.title).toBe("北京圣母无染原罪主教座堂");
    const [s2] = await localizeParishes([boston], { locale: "zh" });
    expect(s2!.title).toBe("St. Mary's Catholic Church");
    await flushDemand();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("keeps a Japanese name with kanji as written (a half-romanized name is worse)", async () => {
    const [j] = await localizeParishes([{ title: "カトリック浦上教会", country: "Japan" }], {
      locale: "fr",
    });
    expect(j!.title).toBe("カトリック浦上教会");
    expect(j!.country).toBe("Japon");
  });

  it("serves Korean readers the content as published, with no lookup", async () => {
    const { db } = fakeDb();
    setTranslationDb(db);
    const [out] = await localizeItems([devotion], { locale: "ko" });
    expect(out).toBe(devotion);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("maps English country names to codes and back into each language", () => {
    expect(regionCodeForEnglishName("United States")).toBe("US");
    expect(regionCodeForEnglishName("ukraine")).toBe("UA");
    expect(regionCodeForEnglishName("Atlantis")).toBeNull();
    expect(localCountryName("United States", "es")).toBe("Estados Unidos");
    expect(localCountryName("Germany", "de")).toBe("Deutschland");
    expect(localCountryName("Philippines", "tl")).toBe("Pilipinas");
    expect(localCountryName("United States", "en")).toBe("United States");
    expect(localCountryName("Republic of Narnia", "es")).toBe("Republic of Narnia");
    expect(localCountryName(null, "es")).toBeNull();
  });
});
