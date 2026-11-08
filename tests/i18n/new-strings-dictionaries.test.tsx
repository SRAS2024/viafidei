/**
 * @vitest-environment jsdom
 */
/**
 * The words this branch added to pages that are otherwise in the reader's language: the
 * homepage's day block, the detail pages' fact labels, the women Doctors' label, the Our
 * Lady list's title, the profile's error lines, the calendar's and the readings' notes,
 * and the history page's controls. Each is written out in every language's own file,
 * because every dictionary starts as a copy of English and a forgotten key would put
 * English, read in a Spanish voice, on a Spanish page. English stays word for word.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { doctorEyebrow } from "@/app/doctors/[slug]/facts";
import { LiturgicalToday } from "@/app/_sections/LiturgicalToday";
import { TodayDateHeading } from "@/app/_sections/TodayDateHeading";
import {
  massOptionLabel,
  TODAY_WORD_KEYS,
  todayHeadingParts,
  todayWords,
} from "@/app/_sections/today-words";
import {
  FACT_LABELS,
  factLabel,
  translateDetailLabel,
  translateFacts,
} from "@/lib/content-shared/detail-labels";
import {
  buildHistoryView,
  eraRangeSpoken,
  historyStatusSpeech,
  parseHistoryParams,
  type HistoryParams,
} from "@/app/history/historyView";
import { buildTimeline } from "@/lib/content-shared/church-history/timeline";
import { massOptions } from "@/lib/content-shared/liturgical-calendar";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { tPlural } from "@/lib/i18n/plural";
import { createTranslator } from "@/lib/i18n/translator";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ownFile = (locale: string) =>
  readFileSync(join(process.cwd(), `src/lib/i18n/dictionaries/${locale}.ts`), "utf8");
const OTHER_LOCALES = SUPPORTED_LOCALES.filter((locale) => locale !== "en");

/** Sentences and controls: every language says them in its own words. */
const SENTENCES = [
  "common.opensInNewTab",
  "home.today.label",
  "home.today.sundayCycle",
  "home.today.weekdayCycle",
  "home.today.colour",
  "mass.vigil.sunday",
  "mass.ascension.wednesdayEvening",
  "mass.ascension.thursday",
  "mass.ascension.saturdayEvening",
  "mass.ascension.sunday",
  "facts.declaredDoctor",
  "facts.birthName",
  "facts.underTheTitle",
  "facts.relatedSaint",
  "profile.favorites.removeFailed",
  "profile.milestones.removeFailed",
  "profile.goals.due",
  "calendar.outOfRange",
  "readings.massesOnDate",
  "readings.readingsOfMass",
  "readings.douayMisses",
  "readings.readItAt",
  "history.find.region",
  "history.find.search",
  "history.order.label",
  "history.slider.label",
  "history.slider.input",
  "history.era.all",
  "history.showAll",
  "history.searchAll",
  "history.noEvents",
  "history.era.spokenRange",
  "history.era.spokenToToday",
  "history.status.none",
  "history.status.one",
  "history.status.all",
  "history.status.some",
  "history.status.range",
  "history.status.query",
  "history.status.newest",
  "history.status.at",
  "history.status.opened",
];

/** Labels: some are the same word in another language ("Date", "Status", "Region"). */
const LABEL_KEYS = [
  ...TODAY_WORD_KEYS,
  ...FACT_LABELS.map((label) => factLabel(label, (key) => key)),
  "saints.facts.patronOf",
  "ourLady.filter.titles",
  "ourLady.filter.apparitions",
  "ourLady.filter.all",
  "readings.mass",
  "readings.readings",
  "history.era.prefix",
  "history.status.scoped",
];

describe.each(OTHER_LOCALES)("the branch's new words in %s", (locale) => {
  const file = ownFile(locale);
  const dict = DICTIONARIES[locale]!;

  it("writes out every label in its own file", () => {
    expect([...SENTENCES, ...LABEL_KEYS].filter((key) => !file.includes(`"${key}":`))).toEqual([]);
    expect(LABEL_KEYS.filter((key) => !dict[key])).toEqual([]);
  });

  it("says every sentence in its own words", () => {
    expect(SENTENCES.filter((key) => !dict[key] || dict[key] === DICTIONARIES.en![key])).toEqual(
      [],
    );
  });

  it("keeps every placeholder a sentence fills in", () => {
    for (const key of [...SENTENCES, ...LABEL_KEYS]) {
      const wanted = (DICTIONARIES.en![key]!.match(/\{\w+\}/g) ?? []).sort();
      expect((dict[key]!.match(/\{\w+\}/g) ?? []).sort(), key).toEqual(wanted);
    }
  });
});

describe("the homepage's date heading", () => {
  it.each([
    ["en", "Saturday,", "May 8, 2027", " "],
    ["es", "sábado,", "8 de mayo de 2027", " "],
    ["fr", "samedi", "8 mai 2027", " "],
    ["de", "Samstag,", "8. Mai 2027", " "],
    ["la", "Sabbato,", "8 Maii 2027", " "],
    ["ko", "2027년 5월 8일", "토요일", " "],
    ["zh", "2027年5月8日", "星期六", ""],
  ] as const)("is written the %s way", (locale, first, second, gap) => {
    expect(todayHeadingParts("2027-05-08", locale)).toEqual({ first, second, gap });
  });

  it("is the page's language, read as one date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 4, 8, 19, 0));
    render(<TodayDateHeading id="today" locale="es" todayLabel="Hoy" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveAccessibleName(
      "sábado, 8 de mayo de 2027",
    );
  });
});

describe("the day block's Masses", () => {
  it("are the calendar's own English, word for word, on every date of five years", () => {
    const words = todayWords(createTranslator("en"));
    const day = new Date(Date.UTC(2026, 0, 1));
    for (let i = 0; i < 5 * 366; i++) {
      const date = new Date(day.getTime() + i * 86_400_000);
      for (const option of massOptions(date)) {
        expect(massOptionLabel(option, date, "en", words), date.toISOString()).toBe(option.label);
      }
    }
  });

  it.each([
    [
      "es",
      [
        "Vigilia de la Ascensión (sábado por la tarde)",
        "Vigilia del VII domingo de Pascua (sábado por la tarde), donde la Ascensión fue el jueves",
      ],
    ],
    [
      "fr",
      [
        "Vigile de l’Ascension (samedi soir)",
        "Messe anticipée du 7e dimanche de Pâques (samedi soir), là où l’Ascension a été fêtée le jeudi",
      ],
    ],
  ] as const)("are said in %s, on the eve of the Ascension's Sunday", (locale, expected) => {
    const date = new Date(Date.UTC(2027, 4, 8));
    const words = todayWords(createTranslator(locale));
    expect(
      massOptions(date)
        .slice(1)
        .map((option) => massOptionLabel(option, date, locale, words)),
    ).toEqual(expected);
  });

  it("are labelled and linked in the page's language", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 4, 8, 19, 0));
    render(
      <LiturgicalToday
        loadingLabel="Cargando la liturgia de hoy…"
        words={todayWords(createTranslator("es"))}
        locale="es"
      />,
    );
    for (const label of [
      "Tiempo litúrgico",
      "Ciclo dominical",
      "Ciclo ferial",
      "Color litúrgico",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const english of ["Season", "Sunday cycle", "Weekday cycle", "Liturgical colour"]) {
      expect(screen.queryByText(english)).toBeNull();
    }
    expect(
      screen.getByRole("link", { name: "Vigilia de la Ascensión (sábado por la tarde)" }),
    ).toHaveAttribute("href", "/liturgy/readings?date=2027-05-08&mass=vigil");
  });
});

describe("the facts under a detail page's title", () => {
  it("keep the English they have always had", () => {
    const t = createTranslator("en");
    for (const label of FACT_LABELS) expect(factLabel(label, t)).toBe(label);
  });

  it.each([
    ["es", "Proclamación"],
    ["de", "Erhebung"],
    ["ko", "교회 학자 선포"],
  ] as const)("are labelled in %s", (locale, declared) => {
    const t = createTranslator(locale);
    const facts = translateFacts(
      [
        { label: "Declared Doctor", value: "1970, by Pope Paul VI" },
        null,
        { label: "Pontificate", value: "2013 – 2025" },
      ],
      t,
    );
    expect(facts.map((fact) => fact?.label)).toEqual([declared, undefined, t("facts.pontificate")]);
    expect(t("facts.pontificate")).not.toBe("Pontificate");
  });
});

describe("Doctor of the Church over the four women Doctors", () => {
  // Teresa of Ávila, Thérèse of Lisieux and Hildegard of Bingen are filed as religious,
  // Catherine of Siena as lay faithful; their saint pages give the bare title.
  const womenLabels = [
    doctorEyebrow({ ecclesialRole: "religious" }),
    doctorEyebrow({ ecclesialRole: "lay" }),
    "Doctor of the Church",
  ];

  it.each(["es", "pt", "de"] as const)("is no masculine word in %s", (locale) => {
    const t = createTranslator(locale);
    for (const label of womenLabels) expect(translateDetailLabel(label, t), label).toBeNull();
  });

  it.each([
    ["es", "Obispo · Doctor de la Iglesia"],
    ["pt", "Bispo · Doutor da Igreja"],
    ["de", "Bischof · Kirchenlehrer"],
  ] as const)("is still said of a bishop in %s", (locale, said) => {
    const t = createTranslator(locale);
    expect(translateDetailLabel(doctorEyebrow({ ecclesialRole: "bishop" }), t)).toBe(said);
  });

  it.each([
    ["it", "Dottore della Chiesa"],
    ["fr", "Docteur de l’Église"],
    ["pl", "Doktor Kościoła"],
    ["la", "Doctor Ecclesiae"],
  ] as const)("is the same word for a woman in %s", (locale, word) => {
    const t = createTranslator(locale as Locale);
    expect(translateDetailLabel(doctorEyebrow({ ecclesialRole: "religious" }), t)).toBe(word);
  });
});

describe("the history page's spoken eras and counts", () => {
  const era = { from: 30, to: 100 };
  const count = (locale: Locale, n: number) =>
    tPlural(createTranslator(locale), locale, "history.eventCount", n);

  it("keep their English", () => {
    const t = createTranslator("en");
    expect(eraRangeSpoken(era, 2026, t)).toBe(eraRangeSpoken(era, 2026));
    expect(eraRangeSpoken({ from: 1965, to: 9999 }, 2026, t)).toBe("from 1965 to today");
    expect([count("en", 1), count("en", 35), count("en", 1528)]).toEqual([
      "1 event",
      "35 events",
      "1,528 events",
    ]);
  });

  it("are said in the reader's language and grammar", () => {
    expect(eraRangeSpoken(era, 2026, createTranslator("es"))).toBe("de 30 a 100");
    expect(count("es", 1)).toBe("1 acontecimiento");
    expect(count("es", 35)).toBe("35 acontecimientos");
    expect([count("pl", 1), count("pl", 3), count("pl", 35)]).toEqual([
      "1 wydarzenie",
      "3 wydarzenia",
      "35 wydarzeń",
    ]);
    expect(count("ko", 35)).toBe("사건 35건");
  });

  const timeline = buildTimeline([], { currentYear: 2026 });
  const view = (params: Partial<HistoryParams> = {}) =>
    buildHistoryView(timeline, { ...parseHistoryParams({}), ...params });
  const views: Array<Partial<HistoryParams>> = [
    {},
    { order: "newest" },
    { era: "fathers" },
    { era: "fathers", theme: "councils" },
    { q: "nicaea" },
    { q: "zzzzqx" },
    { page: 2 },
    { year: 1054 },
    { event: "pentecost" },
  ];

  it("say the status sentence word for word in English with the translator", () => {
    const t = createTranslator("en");
    for (const params of views) {
      expect(historyStatusSpeech(view(params), t, "en"), JSON.stringify(params)).toBe(
        historyStatusSpeech(view(params)),
      );
    }
  });

  it("say the status sentence in Spanish, with no English frame left", () => {
    const t = createTranslator("es");
    expect(historyStatusSpeech(view({ page: 2 }), t, "es")).toMatch(
      /^Se muestran del 61 al 120 de \d+ acontecimientos\.$/,
    );
    for (const params of views) {
      expect(historyStatusSpeech(view(params), t, "es")).not.toMatch(
        /Showing|events|newest first|Opened|At \d/,
      );
    }
  });

  it.each(OTHER_LOCALES)("has every plural form %s uses, written out", (locale) => {
    const intl = locale === "tl" ? "fil" : locale;
    for (const category of new Intl.PluralRules(intl).resolvedOptions().pluralCategories) {
      const key = `history.eventCount.${category}`;
      expect(ownFile(locale), key).toContain(`"${key}":`);
      expect(DICTIONARIES[locale]![key], key).toContain("{count}");
    }
  });
});
