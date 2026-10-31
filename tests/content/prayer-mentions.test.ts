/**
 * Which spans of a text name a prayer (src/lib/content-shared/prayer-mentions.ts).
 *
 * The matcher turns "pray the Our Father" into an inline-expandable prayer and
 * decides which prayers a novena or a Rosary/chaplet prayer lists. Most of the
 * text it reads is itself prayer, so what matters as much as finding the
 * rubrics is NOT finding the phrases that merely look like them: "our father
 * Abraham" in the Benedictus, "Ave, Ave, Ave, Maria" in a hymn refrain, "O my
 * Jesus" opening some other prayer. Every case below comes from published text.
 */
import { describe, expect, it } from "vitest";

import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";
import {
  BUILDING_BLOCK_PRAYERS,
  prayersMentionedIn,
  tokenizePrayerMentions,
} from "@/lib/content-shared/prayer-mentions";

const PRAYERS = [
  { slug: "sign-of-the-cross", title: "Sign of the Cross" },
  { slug: "apostles-creed", title: "Apostles' Creed" },
  { slug: "our-father", title: "Our Father" },
  { slug: "hail-mary", title: "Hail Mary" },
  { slug: "glory-be", title: "Glory Be" },
  { slug: "fatima-prayer", title: "Fatima Prayer (O My Jesus)" },
  { slug: "salve-regina", title: "Hail Holy Queen (Salve Regina)" },
];

const slugs = (named: Array<{ slug: string }>) => named.map((p) => p.slug);

describe("tokenizePrayerMentions", () => {
  it("finds every prayer a chaplet's rubrics name, in the order it names them", () => {
    const text =
      "1. Begin with the Sign of the Cross, 1 Our Father, 1 Hail Mary and The Apostles Creed.";
    const { segments, matched } = tokenizePrayerMentions(text, PRAYERS, { matchCase: true });
    expect(slugs(matched)).toEqual([
      "sign-of-the-cross",
      "our-father",
      "hail-mary",
      "apostles-creed",
    ]);
    // The segments are a lossless split of the text.
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });

  it("reads plurals and lower-case later words as the prayer", () => {
    const { matched } = tokenizePrayerMentions(
      "Recite the Our Father, ten Hail Marys and the Glory be to the Father.",
      PRAYERS,
      { matchCase: true },
    );
    expect(slugs(matched)).toEqual(["our-father", "hail-mary", "glory-be"]);
  });

  it("does not read 'our father' / 'our fathers' in a canticle or psalm as the Our Father", () => {
    for (const text of [
      "the oath he swore to our father Abraham",
      "In you our fathers put their trust.",
    ]) {
      expect(tokenizePrayerMentions(text, PRAYERS, { matchCase: true }).matched).toEqual([]);
    }
    // Instructions are matched in any case, but a plural must still be cased as
    // written: "promise to our fathers" (an Advent guide) is not a rubric.
    expect(tokenizePrayerMentions("the promise to our fathers", PRAYERS).matched).toEqual([]);
  });

  it("matches the commas a name is written with, and no others", () => {
    const named = tokenizePrayerMentions("Conclude with the Hail, Holy Queen.", PRAYERS).matched;
    expect(slugs(named)).toEqual(["salve-regina"]);
    // The refrain of "Immaculate Mary" is not the Hail Mary.
    const refrain = tokenizePrayerMentions("Ave, Ave, Ave, Maria!", [
      { slug: "hail-mary", title: "Hail Mary" },
    ]);
    expect(refrain.matched).toEqual([]);
  });

  it("never reads a prayer's opening words as its name", () => {
    expect(tokenizePrayerMentions("O my Jesus, I adore you in the crib.", PRAYERS).matched).toEqual(
      [],
    );
    expect(slugs(tokenizePrayerMentions("Add the Fatima Prayer.", PRAYERS).matched)).toEqual([
      "fatima-prayer",
    ]);
  });

  it("leaves text that names nothing as a single plain segment", () => {
    const { segments, matched } = tokenizePrayerMentions("Honor your father and mother.", PRAYERS);
    expect(matched).toEqual([]);
    expect(segments).toEqual([{ text: "Honor your father and mother." }]);
  });
});

describe("prayersMentionedIn", () => {
  it("collects the prayers named across several texts, each once", () => {
    const named = prayersMentionedIn(
      ["Pray one Our Father.", "", "Then three Hail Marys and one Our Father."],
      PRAYERS,
      { matchCase: true },
    );
    expect(slugs(named)).toEqual(["our-father", "hail-mary"]);
  });

  it("returns nothing for empty text", () => {
    expect(prayersMentionedIn(["", "  "], PRAYERS)).toEqual([]);
  });

  it("names only curated prayers as building blocks (a typo would silently link nothing)", () => {
    const curated = new Set(prayerKnowledge.map((p) => p.slug));
    for (const slug of BUILDING_BLOCK_PRAYERS) expect(curated, slug).toContain(slug);
    expect(new Set(BUILDING_BLOCK_PRAYERS).size).toBe(BUILDING_BLOCK_PRAYERS.length);
  });
});
