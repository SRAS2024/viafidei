/**
 * The order the public lists show their content in. The heads of these lists are
 * the owner's own and are pinned exactly; every list is held to the content the
 * site publishes, so a renamed slug cannot silently drop a saint or a prayer to
 * the back of its list.
 */
import { describe, expect, it } from "vitest";

import { ALL_CURATED_ENTRIES } from "@/lib/checklist";
import {
  DISPLAY_ORDER_LISTS,
  popeReignStart,
  sortApparitionsForDisplay,
  sortMarianTitlesForDisplay,
  sortPopesForDisplay,
  sortPrayersForDisplay,
} from "@/lib/content-shared/display-order";
import {
  OLD_TESTAMENT_SAINTS,
  SAINT_DISPLAY_ORDER,
  SAINT_DISPLAY_RANK,
  SAINT_DUPLICATE_OF,
} from "@/lib/content-shared/saints";

const entry = (slug: string, title = slug) => ({ slug, title });
const slugsOf = (type: string) =>
  ALL_CURATED_ENTRIES.filter((e) => e.contentType === type).map((e) => e.slug);
const reversed = <T>(list: readonly T[]): T[] => [...list].reverse();

describe("sortPrayersForDisplay", () => {
  const head = ["our-father", "glory-be", "hail-mary", "jesus-prayer", "fatima-prayer"];

  it("opens with the Our Father, Glory Be, Hail Mary, Jesus Prayer and Fatima Prayer", () => {
    const shuffled = reversed(DISPLAY_ORDER_LISTS.prayers).map((slug) => entry(slug));
    const sorted = sortPrayersForDisplay(shuffled).map((p) => p.slug);
    expect(sorted.slice(0, 5)).toEqual(head);
    expect(sorted.slice(5, 12)).toEqual([
      "sign-of-the-cross",
      "apostles-creed",
      "salve-regina",
      "memorare",
      "angelus",
      "act-of-contrition",
      "prayer-to-saint-michael",
    ]);
  });

  it("ranks at least 250 prayers, each one a published prayer, none twice", () => {
    const { prayers } = DISPLAY_ORDER_LISTS;
    expect(prayers.length).toBeGreaterThanOrEqual(250);
    expect(new Set(prayers).size).toBe(prayers.length);
    const known = new Set(slugsOf("PRAYER"));
    expect(prayers.filter((slug) => !known.has(slug))).toEqual([]);
  });

  it("files a future publish after the ranked prayers, by title, without throwing", () => {
    const sorted = sortPrayersForDisplay([
      entry("a-new-prayer-zeta", "Zeta Prayer"),
      entry("a-new-prayer-alpha", "The Alpha Prayer"),
      entry("hail-mary", "Hail Mary"),
    ]).map((p) => p.slug);
    expect(sorted).toEqual(["hail-mary", "a-new-prayer-alpha", "a-new-prayer-zeta"]);
    expect(sortPrayersForDisplay([])).toEqual([]);
  });

  it("puts familiar prayers before Scripture, collects and Latin hymn texts", () => {
    const sorted = sortPrayersForDisplay([
      { slug: "x-hymn", title: "Aeterna caeli gloria", subtype: "hymn" },
      { slug: "collect-of-the-epiphany", title: "Collect of the Epiphany" },
      { slug: "x-scripture", title: "A Prayer (Judith 9)", subtype: "intercession" },
      { slug: "newman-x", title: "An Author's Meditation", subtype: "general" },
      { slug: "x-familiar", title: "Prayer at a Bedside", subtype: "intercession" },
    ]).map((p) => p.slug);
    expect(sorted).toEqual([
      "x-familiar",
      "newman-x",
      "x-scripture",
      "collect-of-the-epiphany",
      "x-hymn",
    ]);
  });

  it("reads a prayer's type from a full payload as well as from a list row", () => {
    const sorted = sortPrayersForDisplay([
      { slug: "x-hymn", title: "A Latin Text", payload: { prayerType: "hymn" } },
      { slug: "x-familiar", title: "The Prayer of the Hour", payload: { prayerType: "general" } },
    ]).map((p) => p.slug);
    expect(sorted).toEqual(["x-familiar", "x-hymn"]);
  });

  it("sends the pages the crawl filed as prayers to the very end", () => {
    const sorted = sortPrayersForDisplay([
      entry("prayer-videos", "Prayer Videos"),
      { slug: "x-hymn", title: "Zeta Hymn", subtype: "hymn" },
    ]).map((p) => p.slug);
    expect(sorted).toEqual(["x-hymn", "prayer-videos"]);
  });

  it("orders the litanies with the famous ones first", () => {
    const litanies = ALL_CURATED_ENTRIES.filter(
      (e) => e.contentType === "PRAYER" && e.payload.prayerType === "litany",
    ).map((e) => ({
      slug: e.slug,
      title: String(e.payload.title ?? e.slug),
      subtype: "litany",
    }));
    const sorted = sortPrayersForDisplay(litanies).map((p) => p.slug);
    expect(sorted.slice(0, 7)).toEqual([
      "litany-of-the-blessed-virgin-mary",
      "litany-of-the-saints",
      "litany-of-humility",
      "litany-of-the-sacred-heart-of-jesus",
      "litany-of-the-holy-name-of-jesus",
      "litany-of-saint-joseph",
      "litany-of-the-precious-blood",
    ]);
  });
});

describe("sortPopesForDisplay", () => {
  const pope = (slug: string, papacyStart?: string) => ({
    slug,
    title: slug,
    payload: papacyStart === undefined ? {} : { papacyStart },
  });

  it("runs from the current pope down to Saint Peter", () => {
    const all = reversed(DISPLAY_ORDER_LISTS.popes).map((slug) => pope(slug));
    const sorted = sortPopesForDisplay([...all].reverse()).map((p) => p.slug);
    expect(sorted.slice(0, 8)).toEqual([
      "pope-leo-xiv",
      "pope-francis",
      "pope-benedict-xvi",
      "pope-saint-john-paul-ii",
      "pope-john-paul-i",
      "pope-saint-paul-vi",
      "pope-saint-john-xxiii",
      "pope-venerable-pius-xii",
    ]);
    expect(sorted.at(-1)).toBe("pope-saint-peter");
    expect(sorted.at(-2)).toBe("pope-saint-linus");
    // The whole line, which also proves its years never run backwards.
    expect(sorted).toEqual(reversed(DISPLAY_ORDER_LISTS.popes));
  });

  it("keeps popes who began in the same year in their true order, the later first", () => {
    const pairs = [
      ["pope-saint-john-paul-ii", "pope-john-paul-i"],
      ["pope-paul-v", "pope-leo-xi"],
      ["pope-gregory-xiv", "pope-urban-vii"],
      ["pope-paul-iv", "pope-marcellus-ii"],
      ["pope-julius-ii", "pope-pius-iii"],
      ["pope-boniface-viii", "pope-saint-celestine-v"],
      ["pope-john-xviii", "pope-john-xvii"],
      ["pope-theodore-ii", "pope-romanus"],
      ["pope-stephen-vi", "pope-boniface-vi"],
      ["pope-gregory-iv", "pope-valentine"],
      ["pope-constantine", "pope-sisinnius"],
      ["pope-john-iv", "pope-severinus"],
    ];
    for (const [later, earlier] of pairs) {
      // Same stored year, listed in the wrong order, as production has them.
      const sorted = sortPopesForDisplay([pope(earlier!, "1000"), pope(later!, "1000")]);
      expect(sorted.map((p) => p.slug)).toEqual([later, earlier]);
    }
    const the1276 = sortPopesForDisplay([
      pope("pope-adrian-v", "1276"),
      pope("pope-innocent-v", "1276"),
      pope("pope-john-xxi", "1276"),
    ]).map((p) => p.slug);
    expect(the1276).toEqual(["pope-john-xxi", "pope-adrian-v", "pope-innocent-v"]);
  });

  it("is not moved by a wrong year on a record", () => {
    // Benedict IX is stored 1045-1045 for the first of three reigns from 1032.
    const sorted = sortPopesForDisplay([
      pope("pope-john-xix", "1024"),
      pope("pope-benedict-ix", "1099"),
      pope("pope-sylvester-iii", "1045"),
    ]).map((p) => p.slug);
    expect(sorted).toEqual(["pope-sylvester-iii", "pope-benedict-ix", "pope-john-xix"]);
  });

  it("names the whole line once, every curated pope among it", () => {
    const { popes } = DISPLAY_ORDER_LISTS;
    expect(popes).toHaveLength(265);
    expect(new Set(popes).size).toBe(265);
    const line = new Set(popes);
    expect(slugsOf("POPE").filter((slug) => !line.has(slug))).toEqual([]);
  });

  it("reads a reign's start from any stored form, never a day as a year", () => {
    expect(popeReignStart({ papacyStart: "2025-05-08" })).toEqual({ year: 2025, dayOfYear: 508 });
    expect(popeReignStart({ papacyStart: "May 8, 2025" })).toEqual({ year: 2025, dayOfYear: 508 });
    expect(popeReignStart({ papacyStart: "8 May 2025" })).toEqual({ year: 2025, dayOfYear: 508 });
    expect(popeReignStart({ papacyStart: "c. 125" })).toEqual({ year: 125, dayOfYear: 0 });
    expect(popeReignStart({ papacyStart: "1045" })).toEqual({ year: 1045, dayOfYear: 0 });
    expect(popeReignStart({ papacyStart: "" })).toBeNull();
    expect(popeReignStart({})).toBeNull();
    expect(popeReignStart(undefined)).toBeNull();
  });

  it("files the next pope by his own record, ahead of the current one", () => {
    const sorted = sortPopesForDisplay([
      pope("pope-leo-xiv", "2025"),
      pope("pope-next-b", "September 2, 2040"),
      pope("pope-next-a", "2040-03-01"),
      pope("pope-undated"),
    ]).map((p) => p.slug);
    expect(sorted).toEqual(["pope-next-b", "pope-next-a", "pope-leo-xiv", "pope-undated"]);
  });
});

describe("sortApparitionsForDisplay", () => {
  it("opens with Guadalupe, Lourdes, Fatima, then Medjugorje and the Miraculous Medal", () => {
    const shuffled = reversed(DISPLAY_ORDER_LISTS.apparitions).map((slug) => entry(slug));
    expect(
      sortApparitionsForDisplay(shuffled)
        .slice(0, 9)
        .map((a) => a.slug),
    ).toEqual([
      "apparition-our-lady-of-guadalupe",
      "apparition-our-lady-of-lourdes",
      "apparition-our-lady-of-fatima",
      "apparition-our-lady-queen-of-peace-medjugorje",
      "apparition-miraculous-medal-rue-du-bac",
      "apparition-our-lady-of-knock",
      "apparition-our-lady-of-la-salette",
      "apparition-our-lady-of-mount-carmel-simon-stock",
      "apparition-our-lady-of-akita",
    ]);
  });

  it("ranks every published apparition exactly once", () => {
    const { apparitions } = DISPLAY_ORDER_LISTS;
    expect(apparitions).toHaveLength(52);
    expect(new Set(apparitions).size).toBe(52);
    const ranked = new Set(apparitions);
    expect(slugsOf("APPARITION").filter((slug) => !ranked.has(slug))).toEqual([]);
  });

  it("files an apparition it does not know after the ranked ones", () => {
    expect(
      sortApparitionsForDisplay([
        entry("apparition-new", "A New Apparition"),
        entry("apparition-our-lady-of-lourdes", "Lourdes"),
      ]).map((a) => a.slug),
    ).toEqual(["apparition-our-lady-of-lourdes", "apparition-new"]);
  });
});

describe("sortMarianTitlesForDisplay", () => {
  it("opens with her dogmas and universal titles", () => {
    const shuffled = reversed(DISPLAY_ORDER_LISTS.marianTitles).map((slug) => entry(slug));
    expect(
      sortMarianTitlesForDisplay(shuffled)
        .slice(0, 7)
        .map((t) => t.slug),
    ).toEqual([
      "immaculate-conception",
      "queen-of-heaven",
      "mother-of-god",
      "assumption-of-mary",
      "perpetual-virginity",
      "immaculate-heart-of-mary",
      "our-lady-of-guadalupe",
    ]);
  });

  it("ranks every published Marian title exactly once", () => {
    const { marianTitles } = DISPLAY_ORDER_LISTS;
    expect(marianTitles).toHaveLength(61);
    expect(new Set(marianTitles).size).toBe(61);
    const ranked = new Set(marianTitles);
    expect(slugsOf("MARIAN_TITLE").filter((slug) => !ranked.has(slug))).toEqual([]);
  });
});

describe("the head of the saint list", () => {
  it("is the owner's order, exactly", () => {
    expect(SAINT_DISPLAY_ORDER.slice(0, 21)).toEqual([
      "saint-blessed-virgin-mary",
      "saint-joseph",
      "saint-peter",
      "saint-paul",
      "saint-james-the-greater",
      "saint-john-the-apostle",
      "saint-andrew-the-apostle",
      "saint-philip-the-apostle",
      "saint-bartholomew",
      "saint-matthew",
      "saint-thomas-the-apostle",
      "saint-james-the-less",
      "saint-jude-thaddeus",
      "saint-simon-the-zealot",
      "saint-matthias",
      "saint-john-the-baptist",
      "saint-mary-magdalene",
      "saint-augustine-of-hippo",
      "saint-ignatius-of-antioch",
      "saint-thomas-aquinas",
      "saint-mother-teresa-of-calcutta",
    ]);
    expect(SAINT_DISPLAY_ORDER.slice(21, 26)).toEqual([
      "saint-francis-of-assisi",
      "saint-anthony-of-padua",
      "saint-therese-of-lisieux",
      "saint-padre-pio",
      "saint-michael",
    ]);
  });

  it("names about two hundred popular saints, none twice", () => {
    expect(SAINT_DISPLAY_ORDER.length).toBeGreaterThanOrEqual(220);
    expect(new Set(SAINT_DISPLAY_ORDER).size).toBe(SAINT_DISPLAY_ORDER.length);
  });

  it("carries a curated record for all four saints the list opens without", () => {
    const curated = new Set(slugsOf("SAINT"));
    for (const slug of [
      "saint-blessed-virgin-mary",
      "saint-philip-the-apostle",
      "saint-james-the-less",
      "saint-simon-the-zealot",
    ]) {
      expect(curated.has(slug), slug).toBe(true);
    }
  });

  it("never ranks a duplicate over the record it duplicates", () => {
    const ranked = new Set(SAINT_DISPLAY_ORDER);
    for (const [duplicate, canonical] of Object.entries(SAINT_DUPLICATE_OF)) {
      expect(ranked.has(duplicate), `${duplicate} is ranked`).toBe(false);
      // A canonical record is never itself a duplicate of a third.
      expect(SAINT_DUPLICATE_OF[canonical], canonical).toBeUndefined();
      if (ranked.has(canonical)) {
        expect(SAINT_DISPLAY_RANK.get(duplicate)).toBe(SAINT_DISPLAY_RANK.get(canonical));
      }
    }
  });

  it("hides the three same-person records the owner's list would show twice", () => {
    expect(SAINT_DUPLICATE_OF["saint-john-the-evangelist"]).toBe("saint-john-the-apostle");
    expect(SAINT_DUPLICATE_OF["saint-jude-the-apostle"]).toBe("saint-jude-thaddeus");
    expect(SAINT_DUPLICATE_OF["saint-mother-teresa"]).toBe("saint-mother-teresa-of-calcutta");
  });

  it("keeps the Old Testament saints apart from the head of the list", () => {
    const ranked = new Set(SAINT_DISPLAY_ORDER);
    expect(OLD_TESTAMENT_SAINTS.filter((slug) => ranked.has(slug))).toEqual([]);
    // Saint Anne, Saint Joachim and the New Testament are not the Old Testament.
    for (const slug of ["saint-anne", "saint-joachim", "saint-john-the-baptist"]) {
      expect(OLD_TESTAMENT_SAINTS).not.toContain(slug);
    }
    // Production's Abraham, Moses, David and Sarah are not the biblical figures.
    for (const slug of ["saint-abraham", "saint-moses", "saint-david", "saint-sarah"]) {
      expect(OLD_TESTAMENT_SAINTS).not.toContain(slug);
    }
  });
});
