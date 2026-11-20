/**
 * @vitest-environment jsdom
 *
 * Content is published in English and shown as published until it is translated (always
 * on the Latin site). On a page in another language that English is marked lang="en", or
 * VoiceOver reads it in the page's voice: the Latin site's biographies were read with a
 * Latin voice. What the translation overlay has translated takes the page's language.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const locale = vi.hoisted(() => ({ current: "la" as string | undefined }));
vi.mock("@/lib/i18n/request-locale", () => ({
  requestLocale: () => locale.current,
  rememberRequestLocale: () => undefined,
}));

import { GuidePrayers } from "@/components/ui/GuidePrayers";
import { instructionField } from "@/components/ui/GuideSteps";
import { PrayerLanguageProvider } from "@/components/ui/PrayerLanguageChips";
import { PublishedDetail } from "@/components/ui/PublishedDetail";
import { PublishedList } from "@/components/ui/PublishedList";
import type { PublishedItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";
import { attachDisplay } from "@/lib/translation/display";
import type { PrayerVariant } from "@/lib/content-shared/prayer-language";
import { englishWhereUntranslated, sameText } from "@/lib/translation/shown-language";

const EN_VARIANT: PrayerVariant = {
  code: "en",
  label: "English",
  text: "Our Father…",
  preserve: false,
};
const LA_VARIANT: PrayerVariant = {
  code: "la",
  label: "Latin",
  text: "Pater noster…",
  preserve: true,
};

afterEach(() => {
  cleanup();
  locale.current = "la";
});

const BIOGRAPHY =
  "Carlo Acutis was an Italian Catholic teenager known for his devotion to the Eucharist and his use of the internet to spread it.";

function saint(over: Partial<PublishedItem> = {}): PublishedItem {
  return {
    id: "1",
    checklistItemId: "c1",
    contentType: "SAINT",
    slug: "saint-carlo-acutis",
    title: "Saint Carlo Acutis",
    subtitle: "Saint, patron of young people · Feast October 12",
    authorityLevel: "TRUSTED_PUBLISHER",
    version: 1,
    publishedAt: null,
    payload: { biography: BIOGRAPHY, summary: "A teenager of the Eucharist." },
    ...over,
  } as PublishedItem;
}

function detail(item: PublishedItem, t = createTranslator("la")) {
  return render(
    <PublishedDetail
      t={t}
      item={item}
      showSubtitle={false}
      lede={false}
      factItems={[{ label: t("saints.feastDay"), value: "October 12" }]}
      primaryFields={["biography"]}
      headings={{ biography: null }}
    />,
  );
}

describe("shown-language helpers", () => {
  it("calls text English only where it is shown as stored, on a page in another language", () => {
    expect(englishWhereUntranslated("la", "Our Father", "Our Father")).toBe("en");
    expect(englishWhereUntranslated("es", "Padre nuestro", "Our Father")).toBeUndefined();
    expect(englishWhereUntranslated("en", "Our Father", "Our Father")).toBeUndefined();
    expect(englishWhereUntranslated(undefined, "Our Father", "Our Father")).toBeUndefined();
    // Structures are compared by content: the overlay copies what it walks through.
    expect(sameText([{ title: "Day 1" }], [{ title: "Day 1" }])).toBe(true);
    expect(sameText([{ title: "Día 1" }], [{ title: "Day 1" }])).toBe(false);
  });
});

describe("a detail page in another language", () => {
  it("marks the title, the facts' values and the biography as English on the Latin site", () => {
    const { container } = detail(saint());
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("lang", "en");
    expect(screen.getByText(/Italian Catholic teenager/).closest("[lang]")).toHaveAttribute(
      "lang",
      "en",
    );
    const value = screen.getByText("October 12");
    expect(value.closest("dd")).toHaveAttribute("lang", "en");
    // The label is the reader's own word.
    expect(container.querySelector("dt")).not.toHaveAttribute("lang");
  });

  it("marks nothing on the English site", () => {
    locale.current = "en";
    const { container } = detail(saint(), createTranslator("en"));
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveAttribute("lang");
    expect(container.querySelector("[lang]")).toBeNull();
  });

  it("leaves what is translated in the page's language, and marks only the rest", () => {
    locale.current = "es";
    const stored = saint();
    const item = attachDisplay(
      { ...stored },
      {
        locale: "es",
        title: stored.title,
        subtitle: stored.subtitle ?? null,
        payload: {
          ...stored.payload,
          biography: "Carlo Acutis fue un adolescente católico italiano.",
        },
        machineTranslated: true,
        pendingUnits: 0,
      },
    );
    detail(item, createTranslator("es"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("lang", "en");
    expect(screen.getByText(/adolescente católico/).closest("[lang]")).toBeNull();
  });

  it("judges each day of a novena on its own", () => {
    locale.current = "es";
    const days = [
      { day: 1, title: "Day 1", text: "O Lord, hear our prayer." },
      { day: 2, title: "Day 2", text: "O Lord, have mercy." },
    ];
    const stored = {
      ...saint(),
      contentType: "NOVENA",
      slug: "a-novena",
      title: "A Novena",
      payload: { days },
    } as PublishedItem;
    const item = attachDisplay(
      { ...stored },
      {
        locale: "es",
        title: "Una novena",
        subtitle: null,
        payload: { days: [{ ...days[0], title: "Día 1" }, days[1]] },
        machineTranslated: true,
        pendingUnits: 1,
      },
    );
    render(<PublishedDetail t={createTranslator("es")} item={item} primaryFields={["days"]} />);
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveAttribute("lang");
    const first = screen.getByText("Día 1").closest(".vf-disclosure");
    const second = screen.getByText("Day 2").closest(".vf-disclosure");
    expect(first).not.toHaveAttribute("lang");
    expect(second).toHaveAttribute("lang", "en");
  });

  it("calls nothing on a parish's page English: it is named in its own country's language", () => {
    const parish = {
      ...saint(),
      contentType: "PARISH",
      slug: "crkva-sv-nikole-tavelica",
      title: "Crkva sv. Nikole Tavelića",
      payload: { description: "Župna crkva." },
    } as PublishedItem;
    const { container } = render(
      <PublishedDetail t={createTranslator("la")} item={parish} primaryFields={["description"]} />,
    );
    expect(container.querySelector("[lang]")).toBeNull();
  });
});

describe("a card in another language", () => {
  it("marks an untranslated title and description as English, and a translated one not", () => {
    locale.current = "ko";
    const english = saint({ id: "a", slug: "a", title: "Saint Agnes" });
    const translatedStored = saint({ id: "b", slug: "b", title: "Saint Benedict" });
    const translated = attachDisplay(
      { ...translatedStored },
      {
        locale: "ko",
        title: "성 베네딕토",
        subtitle: null,
        payload: { ...translatedStored.payload, summary: "수도 생활의 아버지." },
        machineTranslated: true,
        pendingUnits: 0,
      },
    );
    render(<PublishedList items={[english, translated]} baseHref="/saints" />);
    expect(screen.getByRole("link", { name: "Saint Agnes" })).toHaveAttribute("lang", "en");
    expect(screen.getAllByText("A teenager of the Eucharist.")[0]).toHaveAttribute("lang", "en");
    expect(screen.getByRole("link", { name: "성 베네딕토" })).not.toHaveAttribute("lang");
    expect(screen.getByText("수도 생활의 아버지.")).not.toHaveAttribute("lang");
  });
});

describe("the reader's own words inside English text", () => {
  const spanish = {
    readerLanguage: "es",
    names: { la: "Latín" },
    groupLabel: "Idioma de la oración",
    groupFor: "{title}: idioma",
  };

  it("says each prayer's language in a list: English where untranslated, the reader's where not", () => {
    const prayers = [
      { slug: "a", title: "Our Father", variants: [EN_VARIANT, LA_VARIANT] },
      { slug: "b", title: "Ave María", variants: [EN_VARIANT], titleTranslated: true },
    ];
    render(
      <PrayerLanguageProvider setup={spanish}>
        <GuidePrayers prayers={prayers} heading="Prayers of this novena" />
      </PrayerLanguageProvider>,
    );
    expect(screen.getByText("Our Father").closest(".vf-disclosure")).toHaveAttribute("lang", "en");
    expect(screen.getByText("Ave María").closest(".vf-disclosure")).toHaveAttribute("lang", "es");
    expect(screen.getByRole("heading", { name: "Prayers of this novena" })).toHaveAttribute(
      "lang",
      "en",
    );
    // The chips are named in Spanish, so they say so even inside English text.
    expect(screen.getByRole("group", { name: "Idioma de la oración" })).toHaveAttribute(
      "lang",
      "es",
    );
  });

  it("gives a step's spoken number the reader's language", () => {
    render(
      <div lang="en">
        {instructionField(
          undefined,
          3,
          createTranslator("es"),
        )("1. Make the sign of the cross.\n2. Pray the Our Father.")}
      </div>,
    );
    const label = screen.getAllByText(/^Paso 1/)[0]!;
    expect(label).toHaveAttribute("lang", "es");
  });
});
