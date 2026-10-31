/**
 * Prayer lists in the reader's language (src/lib/data/prayer-sets.ts with
 * src/lib/translation). Which prayers a devotion's instructions or a novena's
 * days name, and in what order, is decided on the stored English, exactly as
 * for an English reader; the lists and inline panels then show each prayer's
 * title and text in the reader's language (`localizePrayers`), looked up once
 * for the prayers shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedItem } from "@/lib/data/published";
import type { Locale } from "@/lib/i18n/locales";
import { planItem, unitHash } from "@/lib/translation/segments";
import { resetTranslationStoreState, setTranslationDb, type Db } from "@/lib/translation/store";

const published: PublishedItem[] = [];
let locale: Locale = "es";

// The reader's language arrives as it does in production, through the
// `vf_locale` cookie that @/lib/i18n/server reads.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "vf_locale" ? { name, value: locale } : undefined),
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/data/published", () => ({
  listPublishedBySlugs: async (_type: string, slugs: string[]) =>
    slugs
      .map((slug) => published.find((p) => p.slug === slug))
      .filter((p): p is PublishedItem => p != null),
}));

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import { loadPrayerSet, loadPrayersForText } from "@/lib/data/prayer-sets";
import { localizePrayers } from "@/lib/translation/localize";

function prayer(slug: string, title: string, payload: Record<string, unknown>): PublishedItem {
  return {
    id: slug,
    contentType: "PRAYER",
    slug,
    title,
    subtitle: "",
    payload: { language: "en", ...payload },
  } as unknown as PublishedItem;
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

const OUR_FATHER = prayer("our-father", "Our Father", {
  body: "Our Father, who art in heaven, hallowed be thy name.",
  latin: "Pater noster, qui es in caelis, sanctificetur nomen tuum.",
});
const HAIL_MARY = prayer("hail-mary", "Hail Mary", { body: "Hail Mary, full of grace." });
const GLORY_BE = prayer("glory-be", "Glory Be", { body: "Glory be to the Father." });

beforeEach(() => {
  resetTranslationStoreState();
  published.length = 0;
  published.push(OUR_FATHER, HAIL_MARY, GLORY_BE);
  locale = "es";
});
afterEach(() => setTranslationDb(null));

describe("a prayer list for a Spanish reader", () => {
  it("is chosen and ordered on the English names, and shows each prayer in Spanish", async () => {
    const db = spanishCache([
      [OUR_FATHER, "Our Father", "Padre Nuestro"],
      [
        OUR_FATHER,
        "Our Father, who art in heaven, hallowed be thy name.",
        "Padre nuestro, que estás en el cielo, santificado sea tu nombre.",
      ],
      [HAIL_MARY, "Hail Mary", "Dios te salve, María"],
    ]);
    // The stored instructions name the Our Father first, though the stored
    // list only has the Hail Mary: the English decides, as for every reader.
    const { prayers, ordered } = await loadPrayersForText(
      ["hail-mary"],
      ["Pray one Our Father, then three Hail Marys."],
    );
    expect(prayers.map((p) => p.title)).toEqual(["Our Father", "Hail Mary"]);
    expect(ordered).toBe(true);
    expect(db.$queryRaw).not.toHaveBeenCalled();

    const shown = await localizePrayers(prayers);
    // One lookup, for the two prayers shown: never the Glory Be the text does
    // not name, though it was a candidate.
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const [, hashes] = (db.$queryRaw.mock.calls[0]![0] as { values: [string, string[]] }).values;
    expect(hashes).toHaveLength(
      planItem(OUR_FATHER).units.length + planItem(HAIL_MARY).units.length,
    );
    expect(shown.map((p) => [p.slug, p.title])).toEqual([
      ["our-father", "Padre Nuestro"],
      ["hail-mary", "Dios te salve, María"],
    ]);
    // The vernacular is the reader's translation, labelled and marked up as
    // Spanish; the Latin is the stored text.
    expect(shown[0]!.variants).toEqual([
      {
        code: "en",
        label: "Español",
        lang: "es",
        text: "Padre nuestro, que estás en el cielo, santificado sea tu nombre.",
        preserve: false,
      },
      {
        code: "la",
        label: "Latin",
        text: "Pater noster, qui es in caelis, sanctificetur nomen tuum.",
        preserve: true,
      },
    ]);
    // A text still waiting for the translator stays English, labelled English.
    expect(shown[1]!.variants[0]).toEqual({
      code: "en",
      label: "English",
      text: "Hail Mary, full of grace.",
      preserve: false,
    });
  });

  it("keeps the curated Latin official in the reader's view, under a stale marker", async () => {
    // The live Litany of Saint Joseph: curated official Latin under a marker
    // that still names Latin and Greek (see tests/data/prayer-sets.test.ts).
    const curated = prayerKnowledge.find((p) => p.slug === "litany-of-saint-joseph")!;
    const litany = prayer("litany-of-saint-joseph", "Litany of Saint Joseph", {
      body: "Lord, have mercy on us.",
      latin: curated.payload.latin,
      greek: "Κύριε, ἐλέησον.",
      machineTranslated: ["latin", "greek"],
    });
    published.push(litany);
    spanishCache([[litany, "Lord, have mercy on us.", "Señor, ten piedad de nosotros."]]);
    const [shown] = await localizePrayers(await loadPrayerSet(["litany-of-saint-joseph"]));
    expect(shown!.variants.map((v) => [v.code, v.lang ?? v.code, v.unofficial ?? false])).toEqual([
      ["en", "es", false],
      ["la", "la", false],
      ["el", "el", true],
    ]);
  });
});

describe("a prayer list for an English reader", () => {
  it("is the stored prayers themselves, with no cache lookup", async () => {
    locale = "en";
    const db = spanishCache([[OUR_FATHER, "Our Father", "Padre Nuestro"]]);
    const set = await loadPrayerSet(["our-father", "hail-mary"]);
    const shown = await localizePrayers(set);
    shown.forEach((p, i) => expect(p).toBe(set[i]));
    expect(shown.map((p) => p.title)).toEqual(["Our Father", "Hail Mary"]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
