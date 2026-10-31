/**
 * The prayer lists behind every surface that shows prayers with the Latin /
 * Greek chips (src/lib/data/prayer-sets.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublishedItem } from "@/lib/data/published";

const listPublishedBySlugs = vi.fn();
/** A failed lookup is a plain rejected promise, outside the spy's bookkeeping. */
let lookupFails = false;
vi.mock("@/lib/data/published", () => ({
  listPublishedBySlugs: (...args: unknown[]) =>
    lookupFails ? Promise.reject(new Error("db down")) : listPublishedBySlugs(...args),
}));

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import {
  loadNamedPrayers,
  loadPrayerSet,
  loadPrayersForText,
  publishedPrayerVariants,
} from "@/lib/data/prayer-sets";

function prayer(slug: string, title: string, payload: Record<string, unknown>): PublishedItem {
  return { id: slug, contentType: "PRAYER", slug, title, subtitle: "", payload } as PublishedItem;
}

const OUR_FATHER = prayer("our-father", "Our Father", {
  body: "Our Father, who art in heaven...",
  latin: "Pater noster...",
  greek: "Πάτερ ἡμῶν...",
});
const HAIL_MARY = prayer("hail-mary", "Hail Mary", { body: "Hail Mary, full of grace..." });
const SIGN_OF_THE_CROSS = prayer("sign-of-the-cross", "Sign of the Cross", {
  body: "In the name of the Father...",
  latin: "In nomine Patris...",
});
const APOSTLES_CREED = prayer("apostles-creed", "Apostles' Creed", { body: "I believe in God..." });
const SALVE_REGINA = prayer("salve-regina", "Hail Holy Queen (Salve Regina)", {
  body: "Hail, holy Queen, Mother of mercy...",
});
const MEMORARE = prayer("memorare", "Memorare", { body: "Remember, O most gracious Virgin..." });
const TITLE_ONLY = prayer("prayer-videos", "Prayer Videos", {});

beforeEach(() => {
  listPublishedBySlugs.mockReset();
  lookupFails = false;
});

describe("loadPrayerSet", () => {
  it("returns each published prayer with its language variants, in the order given", async () => {
    listPublishedBySlugs.mockResolvedValue([OUR_FATHER, HAIL_MARY]);
    const set = await loadPrayerSet(["our-father", "hail-mary"]);
    expect(listPublishedBySlugs).toHaveBeenCalledWith("PRAYER", ["our-father", "hail-mary"]);
    expect(set.map((p) => p.slug)).toEqual(["our-father", "hail-mary"]);
    expect(set[0]!.variants.map((v) => v.code)).toEqual(["en", "la", "el"]);
  });

  it("drops a prayer with no text, ignores junk input, and survives a failed lookup", async () => {
    listPublishedBySlugs.mockResolvedValue([TITLE_ONLY, HAIL_MARY]);
    expect((await loadPrayerSet(["prayer-videos", "hail-mary"])).map((p) => p.slug)).toEqual([
      "hail-mary",
    ]);
    expect(await loadPrayerSet("our-father")).toEqual([]);
    expect(await loadPrayerSet([42, ""])).toEqual([]);
    lookupFails = true;
    expect(await loadPrayerSet(["our-father"])).toEqual([]);
  });
});

describe("loadNamedPrayers", () => {
  it("finds the building-block prayers a text names, in the order it names them", async () => {
    listPublishedBySlugs.mockResolvedValue([OUR_FATHER, HAIL_MARY]);
    const named = await loadNamedPrayers(["Pray three Hail Marys, then one Our Father."], {
      matchCase: true,
    });
    expect(named.map((p) => p.slug)).toEqual(["hail-mary", "our-father"]);
  });

  it("never links a prayer to itself", async () => {
    listPublishedBySlugs.mockResolvedValue([OUR_FATHER, HAIL_MARY]);
    const named = await loadNamedPrayers(["Our Father, who art in heaven"], {
      matchCase: true,
      exclude: "our-father",
    });
    expect(named).toEqual([]);
  });

  it("does not query at all for empty text", async () => {
    expect(await loadNamedPrayers(["", " "])).toEqual([]);
    expect(listPublishedBySlugs).not.toHaveBeenCalled();
  });
});

describe("loadPrayersForText", () => {
  /** The published rows behind whatever slugs a call asks for. */
  const PUBLISHED = [
    SIGN_OF_THE_CROSS,
    APOSTLES_CREED,
    OUR_FATHER,
    HAIL_MARY,
    SALVE_REGINA,
    MEMORARE,
  ];
  beforeEach(() => {
    listPublishedBySlugs.mockImplementation(async (_type: string, slugs: string[]) =>
      slugs
        .map((slug) => PUBLISHED.find((p) => p.slug === slug))
        .filter((p): p is PublishedItem => p != null),
    );
  });

  // The live Rosary devotion: its stored list lacks the Sign of the Cross its
  // instructions begin with, and lists the Creed fourth though it comes first.
  const ROSARY_INSTRUCTIONS =
    "Begin with the Sign of the Cross and the Apostles' Creed. Pray one Our Father, three " +
    "Hail Marys, and a Glory Be. Conclude with the Hail Holy Queen.";

  it("adds the prayers the text names and orders the list as the text prays it", async () => {
    const { prayers, ordered } = await loadPrayersForText(
      ["our-father", "hail-mary", "apostles-creed", "salve-regina"],
      [ROSARY_INSTRUCTIONS],
    );
    expect(prayers.map((p) => p.slug)).toEqual([
      "sign-of-the-cross",
      "apostles-creed",
      "our-father",
      "hail-mary",
      "salve-regina",
    ]);
    expect(ordered).toBe(true);
  });

  it("keeps a listed prayer the text never names, after the named ones, and is then unordered", async () => {
    const { prayers, ordered } = await loadPrayersForText(
      ["memorare", "our-father"],
      ["Pray one Our Father."],
    );
    expect(prayers.map((p) => p.slug)).toEqual(["our-father", "memorare"]);
    expect(ordered).toBe(false);
  });

  it("falls through to the named prayers when the listed ones are not published", async () => {
    const { prayers } = await loadPrayersForText(["not-published"], ["Pray one Our Father."], {
      matchCase: true,
    });
    expect(prayers.map((p) => p.slug)).toEqual(["our-father"]);
  });

  it("invents nothing: no list and no text means no prayers", async () => {
    expect(await loadPrayersForText(undefined, ["O blessed apostle, pray for us."])).toEqual({
      prayers: [],
      ordered: false,
    });
    expect(await loadPrayersForText([], [])).toEqual({ prayers: [], ordered: false });
  });
});

describe("publishedPrayerVariants", () => {
  // The live Litany of Saint Joseph: the curated seed wrote the Holy See's
  // official Latin over the June 2026 machine fill but kept the marker, so the
  // row says both its languages are machine-made. Only the Greek is.
  const curated = prayerKnowledge.find((p) => p.slug === "litany-of-saint-joseph")!;
  const officialLatin = curated.payload.latin as string;

  it("never calls the curated received text unofficial, whatever a stale marker says", () => {
    const variants = publishedPrayerVariants("litany-of-saint-joseph", {
      body: curated.payload.body,
      latin: officialLatin,
      greek: "Κύριε, ἐλέησον.",
      machineTranslated: ["latin", "greek"],
    });
    expect(variants.map((v) => [v.code, v.unofficial ?? false])).toEqual([
      ["en", false],
      ["la", false],
      ["el", true],
    ]);
  });

  it("keeps a marked text unofficial when it is not the curated one", () => {
    const variants = publishedPrayerVariants("litany-of-saint-joseph", {
      body: "Lord, have mercy on us.",
      latin: "Domine, miserere nobis (machine).",
      machineTranslated: ["latin"],
    });
    expect(variants[1]).toMatchObject({ code: "la", unofficial: true });
    // A prayer the registries do not hold keeps its marker as stored.
    expect(
      publishedPrayerVariants("not-curated", {
        body: "x",
        latin: officialLatin,
        machineTranslated: ["latin"],
      })[1],
    ).toMatchObject({ unofficial: true });
  });

  it("is what every prayer list builds its variants with", async () => {
    listPublishedBySlugs.mockResolvedValue([
      prayer("litany-of-saint-joseph", "Litany of Saint Joseph", {
        body: curated.payload.body,
        latin: officialLatin,
        machineTranslated: ["latin"],
      }),
    ]);
    const [litany] = await loadPrayerSet(["litany-of-saint-joseph"]);
    expect(litany!.variants[1]).not.toHaveProperty("unofficial");
  });
});
