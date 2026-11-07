/**
 * A novena's Background has to be true where it stands. It comes after the days now,
 * so nothing in it may point down at them; day meditations are not shown, so nothing
 * in it may say they are, and a novena made of meditations says it does not give them;
 * and it is read aloud, so no slug or enum word may be in it. What is about the day
 * meditations stays stored, ready to come back, and is changed when the page is shown.
 * These read every curated novena and the words production's rows held before the
 * correction, since either may be what a page is given.
 */
import { describe, expect, it } from "vitest";

import { novenaKnowledge } from "@/lib/checklist/knowledge/novenas";
import {
  NOVENA_DAY_MEDITATIONS_SHOWN,
  novenaBackgroundForDisplay,
} from "@/lib/content-shared/structured-content";

const backgrounds: [string, string][] = novenaKnowledge.map((entry) => [
  entry.slug,
  entry.payload.background as string,
]);

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) ?? [];

/** The only words a page adds to what is stored: that the meditations are not given. */
const WHAT_IT_ADDS = [
  "His meditations are not reproduced here, and the prayers above are his own.",
  "; the meditations themselves are not reproduced here",
  "; the considerations are not reproduced here",
  "The considerations are not reproduced here.",
  " are not reproduced here",
  " are not reproduced",
  "St. Alphonsus's own",
];

/** True when `shown` is `stored` with words left out and, apart from those, none added or moved. */
function onlyLeavesOut(stored: string, shown: string): boolean {
  const from = words(stored);
  let at = 0;
  const rest = WHAT_IT_ADDS.reduce((text, added) => text.replace(added, ""), shown);
  for (const word of words(rest)) {
    while (at < from.length && from[at] !== word) at += 1;
    if (at === from.length) return false;
    at += 1;
  }
  return true;
}

describe("every curated novena's stored background", () => {
  it("is a background on all of them", () => {
    expect(backgrounds).toHaveLength(104);
    for (const [slug, text] of backgrounds) expect(text.length, slug).toBeGreaterThan(100);
  });

  it("says above, not below, of what is above it", () => {
    for (const [slug, text] of backgrounds) {
      expect(text, slug).not.toMatch(/\bbelow\b/);
      expect(text, slug).not.toMatch(/\bwhat follows\b/);
    }
  });

  it("names no source the page does not print", () => {
    for (const [slug, text] of backgrounds) expect(text, slug).not.toMatch(/\bcited\b/);
  });

  it("has no enum word and no slug in its reader text", () => {
    const slugs = novenaKnowledge.map((entry) => entry.slug);
    for (const [slug, text] of backgrounds) {
      expect(text, slug).not.toMatch(/\bPRAYERs?\b/);
      expect(text, slug).not.toMatch(/\bnovena-[a-z]/);
      expect(text, slug).not.toMatch(/\([a-z]+-[a-z-]+\)/);
      for (const other of slugs) expect(text, slug).not.toContain(other);
    }
    // A sequence of words joined by hyphens is a slug unless a person would write it.
    const joined = backgrounds.flatMap(([, text]) =>
      [...text.matchAll(/\b[a-z]+(?:-[a-z]+){2,}\b/g)].map((match) => match[0]),
    );
    expect(new Set(joined)).toEqual(new Set(["day-by-day"]));
  });

  it("gives each item it names by its title", () => {
    const text = (slug: string) => backgrounds.find(([s]) => s === slug)![1];
    expect(text("novena-immaculate-conception-raccolta")).toContain(
      "also published separately as the prayer Tota Pulchra Es, Maria (All Fair Art Thou, O Mary).",
    );
    expect(text("novena-saint-philip-neri")).toContain(
      "the Prayer to St Philip Neri for Humility (for Sunday), the Prayer to St Philip Neri for the Love of God (for Wednesday), the Prayer to St Philip Neri for Purity (for Tuesday) and the Prayer to St Philip Neri for Patience (for Monday).",
    );
    expect(text("novena-annunciation-pagani")).toContain(
      "distinct from the Novena for the Annunciation (Raccolta) in this catalogue, whose prayers are different.",
    );
    expect(text("novena-sacred-heart-golden-manual")).toContain(
      "distinct from the Novena to the Sacred Heart of Jesus, the Novena to the Sacred Heart (Saint Alphonsus Liguori) and the Novena for the Feast of the Sacred Heart (Our Favorite Novenas) in this catalogue,",
    );
  });
});

describe("novenaBackgroundForDisplay", () => {
  it("keeps the meditations hidden until the owner says otherwise", () => {
    expect(NOVENA_DAY_MEDITATIONS_SHOWN).toBe(false);
  });

  it("says nothing of day meditations on any novena", () => {
    let changed = 0;
    for (const [slug, stored] of backgrounds) {
      const shown = novenaBackgroundForDisplay(stored);
      if (shown !== stored) changed += 1;
      expect(shown, slug).not.toMatch(/\bday meditations?\b/i);
      expect(shown, slug).not.toMatch(
        /\bthe meditations (?:are (?!not reproduced)|given|below|above)/i,
      );
      expect(shown, slug).not.toMatch(/\bmeditations (?:given|here|below|above)\b/i);
      expect(shown, slug).not.toMatch(/\bgives these meditations\b/);
      expect(shown, slug).not.toMatch(/\bsummari[sz]ed in the day\b/i);
    }
    expect(changed).toBe(57);
  });

  // A summary says what the novena is made of, and it is true of the novena. The days
  // give a title and a prayer, so the page says so before anyone goes looking.
  it.each([
    [
      "novena-holy-spirit",
      "His meditations are not reproduced here, and the prayers above are his own.",
    ],
    [
      "novena-christmas-saint-alphonsus",
      "St. Alphonsus's own meditations are not reproduced here, and the prayers above are his own.",
    ],
    [
      "novena-sacred-heart-saint-alphonsus",
      "; his meditations, which precede them, are not reproduced here.",
    ],
    ["novena-litany-of-loreto-saint-alphonsus", ", and the considerations are not reproduced."],
    ["novena-our-lady-of-perpetual-help", "; the meditations themselves are not reproduced here."],
    [
      "novena-saint-francis-of-assisi-ara-coeli",
      "Each day's consideration is followed by a prayer; the considerations are not reproduced here.",
    ],
    [
      "novena-seven-sorrows-of-mary",
      "sets a meditation and a practice before each day's prayers; they and the indulgence notes are omitted.",
    ],
    ["novena-saint-clare-of-assisi", "The considerations are not reproduced here."],
    [
      "novena-saint-teresa-of-avila",
      "The meditations are not reproduced here; the prayers are reproduced in full.",
    ],
    ["novena-our-lady-of-lourdes", "only the prayers are reproduced."],
  ])("says of %s that it does not give them", (slug, sentence) => {
    const stored = backgrounds.find(([s]) => s === slug)![1];
    expect(novenaBackgroundForDisplay(stored)).toContain(sentence);
  });

  it("leaves no pronoun with nothing to point at", () => {
    const stored = backgrounds.find(([s]) => s === "novena-christmas-saint-alphonsus")![1];
    expect(novenaBackgroundForDisplay(stored)).not.toMatch(/\bHis own meditations\b/);
  });

  it("only leaves words out, but for saying so, and leaves the text well formed", () => {
    for (const [slug, stored] of backgrounds) {
      const shown = novenaBackgroundForDisplay(stored);
      expect(onlyLeavesOut(stored, shown), slug).toBe(true);
      expect(shown, slug).not.toMatch(/\s{2,}|\s[.,;]|;\s*\.|^\s|\s$/);
      expect(shown, slug).toMatch(/^\p{Lu}/u);
      expect(shown, slug).toMatch(/[.'"]$/);
      expect(shown.length, slug).toBeGreaterThan(stored.length * 0.7);
    }
  });

  it("brings back every sentence when the meditations are shown", () => {
    for (const [slug, stored] of backgrounds) {
      expect(novenaBackgroundForDisplay(stored, true), slug).toBe(stored);
    }
  });

  it.each([
    [
      "a sentence only about them",
      "It is taken from the book. The day meditations are editorial. It is a private devotion.",
      "It is taken from the book. It is a private devotion.",
    ],
    [
      "the same, with the note that follows it",
      "The book's preface offers them. The day meditations are editorial introductions, and the indulgence notes are omitted. It is private.",
      "The book's preface offers them. The indulgence notes are omitted. It is private.",
    ],
    [
      "a clause after a semicolon, at the end of a sentence",
      "It is taken from 'Our Favorite Novenas' (New York: Benziger Brothers, copyright 1897); the day meditations are editorial. It is private.",
      "It is taken from 'Our Favorite Novenas' (New York: Benziger Brothers, copyright 1897). It is private.",
    ],
    [
      "a clause that the rest of the sentence still needs",
      "Its prayers are said on each of the nine days; the day meditations are editorial, and the indulgence notes are omitted.",
      "Its prayers are said on each of the nine days; the indulgence notes are omitted.",
    ],
    [
      "a clause beside the prayers",
      "The prayers above are the received day-texts; the meditations are short editorial introductions.",
      "The prayers above are the received day-texts.",
    ],
    [
      "a clause in the middle of a sentence, saying what the page gives",
      "Each day's consideration, summarised in the day meditations, is followed by a prayer.",
      "Each day's consideration is followed by a prayer; the considerations are not reproduced here.",
    ],
    [
      "the Christmas novena's two halves, the saint's name going with the second",
      "It may be kept apart. The meditations given here are short editorial introductions to the subject St. Alphonsus assigns each day; his own meditations are not reproduced here, and the prayers above are his own.",
      "It may be kept apart. St. Alphonsus's own meditations are not reproduced here, and the prayers above are his own.",
    ],
    [
      "a meditation and a practice said to be summarised",
      "The book sets a meditation and a practice before each day's prayers; they are summarised in the day meditations, and the indulgence notes are omitted.",
      "The book sets a meditation and a practice before each day's prayers; they and the indulgence notes are omitted.",
    ],
    [
      "a sentence only about a consideration's summary",
      "It follows the novena of St. Francis. Each day's consideration is summarised in the day meditation. It is private.",
      "It follows the novena of St. Francis. The considerations are not reproduced here. It is private.",
    ],
  ])("takes out %s", (_name, stored, shown) => {
    expect(novenaBackgroundForDisplay(stored)).toBe(shown);
  });

  // A row that has not been corrected yet, wherever it is, still reads true of them.
  it.each([
    [
      "The meditations below are short editorial introductions, not Hammer's own meditations. It is private.",
      "It is private.",
    ],
    [
      "Each day's prayer is Alphonsus's own Affections and Prayers; his meditations, which precede them, are summarised in the day meditations below. It is distinct.",
      "Each day's prayer is Alphonsus's own Affections and Prayers; his meditations, which precede them, are not reproduced here. It is distinct.",
    ],
    [
      "The book directs this; the considerations are summarised in the day meditations below, and only the prayers are reproduced.",
      "The book directs this; only the prayers are reproduced.",
    ],
    [
      "Only Newman's nine prayers are reproduced here; the addresses are summarised in the day meditations and are best read in full in the cited edition.",
      "Only Newman's nine prayers are reproduced here; the addresses are best read in full in the cited edition.",
    ],
  ])("reads an older stored sentence the same way: %s", (stored, shown) => {
    expect(novenaBackgroundForDisplay(stored)).toBe(shown);
  });

  it.each([
    "Devotion to the Holy Face grew from meditation on the disfigured face of the suffering Christ.",
    "It was written as nine meditations on charity, the gift proper to the Holy Spirit.",
    "The day-by-day subjects above are editorial and the prayer is unaltered.",
    "The received form gives one prayer, with a different subject for meditation on each of the nine days.",
  ])("leaves what is not about them alone: %s", (text) => {
    expect(novenaBackgroundForDisplay(text)).toBe(text);
  });
});
