/**
 * @vitest-environment jsdom
 */
/**
 * A list's loading placeholder opens with the same words as the finished page, in the
 * reader's language: the first HTML a screen reader gets is the placeholder, and a page
 * marked lang="es" with an English heading in it is voiced with the wrong sounds. Its
 * label comes and goes by the same rule too, so the opening keeps its height.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";

import { createTranslator } from "@/lib/i18n/translator";

const locale = vi.hoisted(() => ({ current: "es" as "en" | "es" | "de" }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator(locale.current) }),
}));

import DevotionsLoading from "@/app/devotions/(list)/loading";
import LitaniesLoading from "@/app/litanies/loading";
import LiturgyLoading from "@/app/liturgy/(list)/loading";
import PrayersLoading from "@/app/prayers/(list)/loading";
import SacramentsLoading from "@/app/sacraments/(list)/loading";
import SaintsLoading from "@/app/saints/(list)/loading";
import SaintsTodayLoading from "@/app/saints/today/loading";
import SpiritualLifeLoading from "@/app/spiritual-life/(list)/loading";

afterEach(() => {
  cleanup();
  locale.current = "es";
});

/** Runs a placeholder and the server component it returns, as Next would. */
async function show(Loading: () => Promise<ReactElement>) {
  const element = await Loading();
  if (typeof element.type === "function") {
    const run = element.type as (props: object) => Promise<ReactElement>;
    return render(await run(element.props as object));
  }
  // The centred column around the feast day saints' placeholder.
  const inner = (element.props as { children: ReactElement }).children;
  const run = inner.type as (props: object) => Promise<ReactElement>;
  return render(await run(inner.props as object));
}

const LISTS: Array<[string, () => Promise<ReactElement>, string, string, string | null]> = [
  ["saints", SaintsLoading, "nav.saints", "saints.title", "saints.subtitle"],
  ["prayers", PrayersLoading, "nav.prayers", "prayers.title", "prayers.subtitle"],
  ["litanies", LitaniesLoading, "litanies.eyebrow", "litanies.title", "litanies.subtitle"],
  ["devotions", DevotionsLoading, "nav.devotions", "devotions.title", "devotions.subtitle"],
  [
    "spiritual life",
    SpiritualLifeLoading,
    "nav.spiritualLife",
    "spiritualLife.title",
    "spiritualLife.subtitle",
  ],
  ["liturgy", LiturgyLoading, "nav.liturgy", "liturgy.title", "liturgy.subtitle"],
  ["feast day saints", SaintsTodayLoading, "saints.today.eyebrow", "saints.today.title", null],
];

describe("a list placeholder in the reader's language", () => {
  it.each(LISTS)(
    "%s reads as its finished page does",
    async (_name, Loading, label, title, sub) => {
      const t = createTranslator("es");
      const { container } = await show(Loading);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t(title));
      if (sub) expect(container.querySelector(".vf-page-hero-lede")).toHaveTextContent(t(sub));
      const repeatsTitle = t(label).trim().toLowerCase() === t(title).trim().toLowerCase();
      const eyebrow = container.querySelector(".vf-page-hero .vf-eyebrow");
      if (repeatsTitle) expect(eyebrow).toBeNull();
      else expect(eyebrow).toHaveTextContent(t(label));
      // Made here, as a client navigation makes it, the status speaks a moment later.
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(t("common.loadingContent")),
      );
    },
  );

  it("the sacraments read as their finished page does", async () => {
    const t = createTranslator("es");
    const { container } = render(await SacramentsLoading());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(t("sacraments.title"));
    expect(container.querySelector(".vf-page-hero .vf-eyebrow")).toHaveTextContent(
      t("nav.sacraments"),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(t("common.loadingContent")),
    );
    expect(screen.getByRole("status").closest('[aria-busy="true"]')).toBeNull();
  });
});
