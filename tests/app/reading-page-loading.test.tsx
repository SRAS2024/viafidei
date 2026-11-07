/**
 * @vitest-environment jsdom
 */
/**
 * A guide, practice, devotion or novena loads in the reading column it will be
 * read in, not in the grid of cards its list page loads in.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";

import { createTranslator } from "@/lib/i18n/translator";

const locale = vi.hoisted(() => ({ current: "en" as "en" | "es" }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator(locale.current) }),
}));

import LiturgicalCalendarLoading from "@/app/liturgical-calendar/loading";
import DailyReadingsLoading from "@/app/liturgy/readings/loading";
import DevotionLoading from "@/app/devotions/[slug]/loading";
import DoctorLoading from "@/app/doctors/[slug]/loading";
import GuideLoading from "@/app/guides/[slug]/loading";
import LiturgyEntryLoading from "@/app/liturgy-history/[slug]/loading";
import NovenaLoading from "@/app/novenas/[slug]/loading";
import OurLadyLoading from "@/app/our-lady/[slug]/loading";
import PopeLoading from "@/app/popes/[slug]/loading";
import PrayerLoading from "@/app/prayers/[slug]/loading";
import RiteLoading from "@/app/rites/[slug]/loading";
import SacramentLoading from "@/app/sacraments/[slug]/loading";
import SaintLoading from "@/app/saints/[slug]/loading";
import SpiritualPracticeLoading from "@/app/spiritual-life/[slug]/loading";

afterEach(() => {
  cleanup();
  locale.current = "en";
});

/** The placeholder is a server component: it awaits the reader's language first. */
async function renderPlaceholder(Loading: () => ReactElement) {
  const { type: Skeleton, props } = Loading();
  render(await (Skeleton as (p: object) => Promise<ReactElement>)(props as object));
}

const READING_PAGES: Array<[string, () => ReactElement]> = [
  ["guide", GuideLoading],
  ["practice", SpiritualPracticeLoading],
  ["devotion", DevotionLoading],
  ["novena", NovenaLoading],
  ["prayer", PrayerLoading],
  ["saint", SaintLoading],
  ["doctor", DoctorLoading],
  ["pope", PopeLoading],
  ["rite", RiteLoading],
  ["sacrament", SacramentLoading],
  ["title or apparition", OurLadyLoading],
  ["liturgical entry or document", LiturgyEntryLoading],
];

describe("reading pages while they load", () => {
  it.each(READING_PAGES)(
    "a %s reserves the reading column and says it is busy",
    async (_name, Loading) => {
      await renderPlaceholder(Loading);
      const skeleton = screen.getByTestId("detail-loading");
      expect(skeleton).toHaveClass("vf-detail");
      expect(skeleton).toHaveAttribute("aria-busy", "true");
      expect(screen.queryByTestId("tab-loading-cards")).not.toBeInTheDocument();
    },
  );

  it.each(READING_PAGES)("a %s tells a screen reader it is loading", async (_name, Loading) => {
    await renderPlaceholder(Loading);
    const status = screen.getByRole("status");
    // Made here, as a client navigation makes it, the status speaks a moment later.
    await waitFor(() => expect(status).toHaveTextContent("Loading"));
    expect(status).toHaveClass("sr-only");
    // Beside the busy wrapper, not in it, where a screen reader may hold it back.
    expect(status).not.toHaveAttribute("aria-busy");
    expect(status.closest('[aria-busy="true"]')).toBeNull();
  });

  it("says so in the reader's language", async () => {
    locale.current = "es";
    await renderPlaceholder(SaintLoading);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cargando"));
  });
});

describe("the day's readings and the calendar while they load", () => {
  const PLACEHOLDERS: Array<[string, () => Promise<ReactElement>, string, string, string]> = [
    [
      "the readings",
      DailyReadingsLoading,
      "readings-loading",
      "Loading the readings of the day…",
      "Cargando las lecturas del día…",
    ],
    [
      "the calendar",
      LiturgicalCalendarLoading,
      "calendar-loading",
      "Loading the calendar…",
      "Cargando el calendario…",
    ],
  ];

  it.each(PLACEHOLDERS)(
    "%s tell a screen reader beside the busy wrapper, never in it",
    async (_name, Loading, testId, english) => {
      render(await Loading());
      const status = screen.getByRole("status");
      await waitFor(() => expect(status).toHaveTextContent(english));
      expect(status).toHaveClass("sr-only");
      expect(status).not.toHaveAttribute("aria-busy");
      expect(status.closest('[aria-busy="true"]')).toBeNull();
      const busy = screen.getByTestId(testId);
      expect(busy).toHaveAttribute("aria-busy", "true");
      expect(busy).not.toHaveAttribute("role");
      expect(busy.contains(status)).toBe(false);
    },
  );

  it.each(PLACEHOLDERS)(
    "%s say so in the reader's language",
    async (_name, Loading, _testId, _english, spanish) => {
      locale.current = "es";
      render(await Loading());
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(spanish));
    },
  );
});
