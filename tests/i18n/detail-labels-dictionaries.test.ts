/**
 * The word over a detail page's title, in every site language: every word the pages'
 * label functions can return has a dictionary key, and every language writes each key
 * out in its own file. Read from the file because every dictionary starts as a copy of
 * English, so a forgotten key would silently put English over a Spanish page.
 *
 * Some words name a person's standing ("Saint", "Blessed", "Religious"), and a language
 * that cannot say them without knowing whether the person is a man or a woman holds an
 * empty string: the page shows no word rather than the wrong one. Those are listed here,
 * so a gap anywhere else is caught.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { doctorEyebrow } from "@/app/doctors/[slug]/facts";
import { liturgicalLine } from "@/app/liturgy-history/[slug]/facts";
import { marianEyebrow } from "@/app/our-lady/[slug]/facts";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";
import { translateTypeLabel } from "@/lib/content-shared/content-type-labels";
import {
  DETAIL_LABELS,
  detailLabelKey,
  translateDetailLabel,
} from "@/lib/content-shared/detail-labels";
import {
  GUIDE_CATEGORY_LABELS,
  GUIDE_KIND_LABELS,
  guideEyebrow,
} from "@/lib/content-shared/guide-categories";
import { saintDetailEyebrow } from "@/lib/content-shared/saints";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const ownFile = (locale: string) => read(`src/lib/i18n/dictionaries/${locale}.ts`);

const KEYS = [...DETAIL_LABELS.map((label) => detailLabelKey(label)!), "label.saint.popeFromTo"];

/** A person's standing, which most of the gendered languages cannot say of anyone. */
const PERSON = ["stage.saint", "stage.blessed", "stage.servantOfGod", "role.religious", "role.lay"];
/** "Apostle" over Junia and Phoebe, who are filed as apostles, in a language that marks it. */
const APOSTLE = "saint.apostle";
/** Where a language has no word true of a man, a woman and a group alike. */
const NO_WORD: Readonly<Record<string, readonly string[]>> = {
  es: PERSON,
  fr: PERSON,
  it: [...PERSON, APOSTLE],
  pt: [...PERSON, APOSTLE],
  la: [...PERSON, APOSTLE],
  pl: [...PERSON, "stage.venerable", APOSTLE],
  de: [...PERSON, "stage.venerable", APOSTLE],
  tl: ["stage.saint", "stage.blessed", "role.religious"],
};

describe("every word over a detail page's title", () => {
  it.each(SUPPORTED_LOCALES)("is written out in %s", (locale) => {
    const file = ownFile(locale);
    const missing = KEYS.filter((key) => !file.includes(`"${key}":`));
    expect(missing).toEqual([]);
  });

  it.each(SUPPORTED_LOCALES)("has a word in %s, unless no word fits everyone", (locale) => {
    const dict = DICTIONARIES[locale]!;
    const empty = KEYS.filter((key) => !dict[key]).map((key) => key.replace(/^label\./, ""));
    expect(empty.sort()).toEqual([...(NO_WORD[locale] ?? [])].sort());
  });

  it("keeps the English that pages have always shown", () => {
    const t = createTranslator("en");
    for (const label of DETAIL_LABELS) expect(translateDetailLabel(label, t)).toBe(label);
    expect(translateDetailLabel("Pope from 1978 to 2005", t)).toBe("Pope from 1978 to 2005");
  });

  it.each(SUPPORTED_LOCALES)("keeps a pope's years in %s", (locale) => {
    const said = createTranslator(locale)("label.saint.popeFromTo", { start: 1978, end: 2005 });
    expect(said).toContain("1978");
    expect(said).toContain("2005");
    expect(said).not.toContain("{");
  });
});

/** A word the dictionaries know: one of the list above, or a type of content. */
const known = (word: string) =>
  !!detailLabelKey(word) || translateTypeLabel(word, createTranslator("es")) !== word;

describe("every word the pages' label functions can give", () => {
  it("a saint's stage of the cause, over a bare name", () => {
    for (const status of ["canonized", "beatified", "venerable", "servant_of_god"]) {
      const word = saintDetailEyebrow({ canonizationStatus: status }, "Catherine of Vadstena");
      expect(word && known(word), `${status}: ${word}`).toBe(true);
    }
  });

  it("a saint's title, and every curated saint's own", () => {
    const curated = [
      ...read("src/lib/checklist/knowledge/saints.ts").matchAll(/titleLabel:\s*"([^"]+)"/g),
    ].map((match) => match[1]!);
    expect(curated.length).toBeGreaterThan(5);
    const words = [
      saintDetailEyebrow({ saintType: "apostle" }, "", "saint-peter"),
      saintDetailEyebrow({ saintType: "doctor_of_the_church" }),
      ...curated,
    ];
    expect(words.filter((word) => !word || !known(word))).toEqual([]);
  });

  it("a Doctor's state of life and title", () => {
    for (const role of ["", "pope", "bishop", "priest", "deacon", "religious", "lay"]) {
      const parts = doctorEyebrow({ ecclesialRole: role }).split(" · ");
      expect(
        parts.filter((part) => !known(part)),
        role,
      ).toEqual([]);
    }
  });

  it("a Marian title or dogma", () => {
    for (const slug of ["mother-of-god", "our-lady-of-aparecida"]) {
      expect(known(marianEyebrow({ slug })), slug).toBe(true);
    }
  });

  it("a sacrament's group", () => {
    for (const key of [
      "baptism",
      "confirmation",
      "eucharist",
      "reconciliation",
      "anointing_of_the_sick",
      "holy_orders",
      "matrimony",
      "",
    ]) {
      const word = generateContentSubtitle({
        contentType: "SACRAMENT",
        fields: { sacramentKey: key },
      });
      expect(known(word), word).toBe(true);
    }
  });

  it("a liturgical entry that is not a day", () => {
    const entries: Array<[Record<string, unknown>, string]> = [
      [{ kind: "liturgical_season", slug: "season-advent" }, "Advent"],
      [{ kind: "liturgical_year" }, "The Liturgical Year"],
      [{ kind: "mass_structure" }, "The Order of Mass"],
      [{ kind: "mass_structure" }, "Eucharistic Prayers of the Roman Missal"],
      [{ kind: "mass_structure" }, "The Roman Missal, Third Edition"],
      [{ kind: "mass_structure" }, "Structure of the Liturgy of the Hours"],
      [{ kind: "mass_structure" }, "Rite of Marriage"],
      [{ kind: "mass_structure" }, "Something Else"],
      [{ kind: "marriage_rite" }, "Rite of Marriage"],
      [{ kind: "council_event" }, "A Council"],
      [{ kind: "symbolism" }, "Incense"],
      [{ kind: "glossary_term" }, "Vestments"],
      [{ kind: "something_new" }, "A Day"],
    ];
    for (const [payload, title] of entries) {
      const { kind } = liturgicalLine(payload, title);
      expect(known(kind), `${JSON.stringify(payload)}: ${kind}`).toBe(true);
    }
  });

  it("a guide's kind or category", () => {
    const words = [
      ...Object.keys(GUIDE_KIND_LABELS).map((kind) => guideEyebrow({ kind })),
      ...Object.keys(GUIDE_CATEGORY_LABELS).map((category) =>
        guideEyebrow({ kind: "general", category }),
      ),
      guideEyebrow({ kind: "general", sacramentKey: "baptism" }),
      guideEyebrow({}),
    ];
    expect(words.filter((word) => !known(word))).toEqual([]);
  });

  it("a spiritual practice's kind", () => {
    const block = /PRACTICE_KIND_LABELS[^{]*\{([^}]*)\}/.exec(
      read("src/lib/content-shared/content-subtitle.ts"),
    )![1]!;
    const kinds = [...block.matchAll(/^\s*(\w+):/gm)].map((match) => match[1]!);
    expect(kinds.length).toBeGreaterThan(10);
    const words = kinds
      .map((kind) =>
        generateContentSubtitle({
          contentType: "SPIRITUAL_PRACTICE",
          fields: { practiceKind: kind },
        }),
      )
      .filter((word) => word !== "Spiritual practice");
    expect(words.filter((word) => !known(word))).toEqual([]);
  });
});

describe.each([
  "home.saints.error",
  "history.pager.label",
  "history.pager.previous",
  "history.pager.next",
  "history.eras.label",
  "history.eras.previous",
  "history.eras.next",
  "loginRequired.message",
  "loginRequired.createAccount",
  "loginRequired.close",
  "save.favorite",
  "save.favorited",
  "save.remove",
  "save.cancel",
  "save.confirmRemove",
  "save.loginRequired",
  "save.failed",
  "save.removeFailed",
])("%s, a sentence or control a reader meets", (key) => {
  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "en"))(
    "is translated in %s",
    (locale) => {
      expect(ownFile(locale)).toContain(`"${key}":`);
      expect(DICTIONARIES[locale]![key]).toBeTruthy();
      expect(DICTIONARIES[locale]![key]).not.toBe(DICTIONARIES.en![key]);
    },
  );
});
