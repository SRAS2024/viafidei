/**
 * @vitest-environment jsdom
 */
/**
 * /saints/today — the saints whose feast falls today.
 *
 * A saint's card in any list reads the name, then the patronage, then the feast
 * day (the owner's rule, built for /saints in PR #355). This page used to show
 * a "Feast day" eyebrow over the name and the first 280 characters of the
 * biography; it now shows the same card as /saints.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PublishedItem } from "@/lib/data/published";
import { createTranslator } from "@/lib/i18n/translator";

const listSaintsForFeast = vi.fn();

vi.mock("@/lib/data/published", () => ({
  listSaintsForFeast: (...args: unknown[]) => listSaintsForFeast(...args),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en") }),
}));
vi.mock("@/app/saints/today/TodayDateLabel", () => ({ TodayDateLabel: () => null }));

import SaintsTodayPage from "@/app/saints/today/page";

function saint(slug: string, title: string, payload: Record<string, unknown>): PublishedItem {
  return { id: slug, contentType: "SAINT", slug, title, subtitle: "", payload } as PublishedItem;
}

afterEach(() => cleanup());

describe("/saints/today", () => {
  it("shows each saint's name, then patronage, then feast day — no biography excerpt", async () => {
    listSaintsForFeast.mockResolvedValue([
      saint("saint-wolfgang", "Saint Wolfgang of Regensburg", {
        saintType: "bishop",
        patronages: ["Regensburg", "carpenters"],
        feastDay: "10-31",
        feastMonth: 10,
        feastDayOfMonth: 31,
        biography: "Wolfgang was a Bavarian bishop who reformed the monasteries of his diocese.",
        // A full row carries its summary; the card must not print it as a
        // fourth line under the name, patronage and feast day.
        summary: "Saint Wolfgang, bishop of Regensburg and reformer of monasteries.",
      }),
    ]);
    const { container } = render(
      await SaintsTodayPage({ searchParams: Promise.resolve({ month: "10", day: "31" }) }),
    );

    expect(listSaintsForFeast).toHaveBeenCalledWith(10, 31);
    const card = container.querySelector("article")!;
    expect(Array.from(card.querySelectorAll("h2, p")).map((el) => el.textContent)).toEqual([
      "Saint Wolfgang of Regensburg",
      "Patron of Regensburg, carpenters",
      "Feast day: October\u00a031",
    ]);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/saints/saint-wolfgang");
    expect(container.textContent).not.toContain("reformed the monasteries");
    expect(container.textContent).not.toContain("reformer of monasteries");
  });

  it("opens with the page's own hero, the date as its sentence", async () => {
    listSaintsForFeast.mockResolvedValue([]);
    const { container } = render(await SaintsTodayPage({ searchParams: Promise.resolve({}) }));
    const hero = container.querySelector(".vf-page-hero")!;
    expect(hero.querySelector("h1")).toHaveTextContent("Today's Feast Day Saints");
    expect(hero.querySelector(".vf-eyebrow")).toHaveTextContent("Today");
  });

  it("says so when no saint's feast falls today", async () => {
    listSaintsForFeast.mockResolvedValue([]);
    render(await SaintsTodayPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("No published feast day saints for today.")).toBeInTheDocument();
  });
});
