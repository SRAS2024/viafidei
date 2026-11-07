/**
 * @vitest-environment jsdom
 */
/**
 * /history as the server renders it: only the page of events the URL asks for,
 * each a native disclosure with its details inside, and every control a link or a
 * form that works without JavaScript.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { createTranslator } from "@/lib/i18n/translator";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en"), locale: "en" }),
}));
vi.mock("@/lib/data/history-timeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/history-timeline")>(
    "@/lib/data/history-timeline",
  );
  return {
    ...actual,
    loadHistoryTimeline: async () =>
      actual.timelineFromInputs(
        {
          documents: [],
          publishedSlugs: { popes: [], saints: ["saint-peter"], doctors: [], apparitions: [] },
        },
        2026,
      ),
  };
});

import HistoryPage, { generateMetadata } from "@/app/history/page";
import { CHURCH_HISTORY_EVENTS } from "@/lib/content-shared/church-history-events";

afterEach(() => cleanup());

const TOTAL = CHURCH_HISTORY_EVENTS.length.toLocaleString("en-US");

async function show(params: Record<string, string> = {}) {
  return render(await HistoryPage({ searchParams: Promise.resolve(params) }));
}

const rows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLDetailsElement>("details.vf-timeline-event"));

describe("/history", () => {
  it("renders one page of native disclosures and no more", async () => {
    const { container } = await show();
    expect(rows(container)).toHaveLength(60);
    const first = rows(container)[0]!;
    expect(first.open).toBe(false);
    expect(first.id).toBe("history-event-pentecost");
    expect(first.querySelector("summary")).toHaveTextContent(/c\. 33.*Pentecost.*Event/);
    // The whole of its details is in the page already, closed.
    expect(first.textContent).toContain("Historical context");
    expect(first.textContent).toContain("Significance");
    expect(first.textContent).toContain("Jerusalem");
    expect(within(first).getByRole("link", { hidden: true, name: "Saint Peter" })).toHaveAttribute(
      "href",
      "/saints/saint-peter",
    );
  });

  it("gives the page one h1, era h2s and century h3s", async () => {
    await show();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      "Church History",
    ]);
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2.slice(0, 2)).toEqual(["Apostolic Age", "Persecutions & Martyrs"]);
    const h3 = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(h3.slice(0, 2)).toEqual(["1st century", "2nd century"]);
  });

  it("opens with a short subtitle and a thousands separator", async () => {
    await show();
    expect(
      screen.getByText(
        `${TOTAL} events from c. 33 to today, councils, saints and martyrs, schisms and reform, and the Magisterium`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Scroll the timeline/)).not.toBeInTheDocument();
  });

  it("announces the count in a live region", async () => {
    await show();
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 60 of ${TOTAL} events`);
    expect(screen.getByRole("status").closest("[aria-busy]")).toBeNull();
    expect(document.getElementById("history-results")).toHaveAttribute("aria-busy", "false");
  });

  it("offers twelve eras in a grid, the current one marked, with years and counts spoken", async () => {
    await show({ era: "fathers", theme: "councils", order: "newest" });
    const nav = screen.getAllByRole("navigation", { name: "Eras" })[0]!;
    const links = within(nav).getAllByRole("link");
    expect(within(nav).getAllByRole("listitem")).toHaveLength(12);
    expect(links[0]).toHaveAccessibleName(/^All eras/);
    expect(links[0]).toHaveAttribute("href", "/history?theme=councils&order=newest");
    const current = within(nav).getByRole("link", { current: true });
    expect(current).toHaveAccessibleName(/^Fathers & First Councils.*from 313 to 590.*events$/);
    // The other choices keep the theme and order, and drop any page.
    expect(links.map((a) => a.getAttribute("href"))).toContain(
      "/history?era=apostolic&theme=councils&order=newest",
    );
  });

  it("does not link to an era with nothing under the filters", async () => {
    await show({ theme: "modern" });
    const nav = screen.getAllByRole("navigation", { name: "Eras" })[0]!;
    expect(within(nav).queryByRole("link", { name: /^Apostolic Age/ })).toBeNull();
    expect(within(nav).getByText("Apostolic Age")).toBeInTheDocument();
  });

  it("folds the eras into one native disclosure as well, for a phone", async () => {
    const { container } = await show({ era: "fathers" });
    const fold = container.querySelector<HTMLDetailsElement>("details.vf-history-eras-fold")!;
    expect(fold.open).toBe(false);
    expect(fold.querySelector("summary")).toHaveTextContent(/Era: Fathers & First Councils/);
    expect(fold.querySelectorAll("a")).toHaveLength(12);
  });

  it("makes the theme a native menu of links with its counts", async () => {
    const { container } = await show({ theme: "councils" });
    const menu = container.querySelector<HTMLDetailsElement>("details.vf-history-menu")!;
    expect(menu.querySelector("summary")).toHaveAccessibleName(
      /Filter the timeline by theme: Councils .*events/,
    );
    const items = Array.from(menu.querySelectorAll("a"));
    expect(items.map((a) => a.querySelector("span")?.textContent)).toEqual([
      "All",
      "Beginnings",
      "Councils",
      "Doctrine & Magisterium",
      "Saints & Martyrs",
      "Schisms & Reform",
      "Our Lady",
      "Modern Era",
    ]);
    // Choosing the active theme again clears it.
    expect(items[2]).toHaveAttribute("aria-current", "true");
    expect(items[2]).toHaveAttribute("href", "/history");
    expect(items[1]).toHaveAttribute("href", "/history?theme=beginnings");
  });

  it("makes the order two links, the current one marked", async () => {
    await show({ order: "newest", page: "3", era: "twentieth" });
    const group = screen.getByRole("group", { name: "Order of events" });
    const [oldest, newest] = within(group).getAllByRole("link");
    expect(oldest).toHaveAttribute("href", "/history?era=twentieth");
    expect(oldest).not.toHaveAttribute("aria-current");
    expect(newest).toHaveAttribute("aria-current", "true");
  });

  it("searches with a plain GET form that keeps the era, theme and order", async () => {
    await show({ era: "fathers", theme: "councils", order: "newest", q: "nicaea" });
    const form = screen.getByRole("search", { name: "Find an event" });
    expect(form).toHaveAttribute("action", "/history");
    expect(form).toHaveAttribute("method", "get");
    const field = (name: string) => form.querySelector(`input[name="${name}"]`);
    expect(field("era")).toHaveAttribute("value", "fathers");
    expect(field("theme")).toHaveAttribute("value", "councils");
    expect(field("order")).toHaveAttribute("value", "newest");
    expect(screen.getByRole("searchbox", { name: "Find an event" })).toHaveValue("nicaea");
  });

  it("types a year with a plain GET form that carries its anchor", async () => {
    await show({ theme: "councils", q: "rome", era: "fathers" });
    const input = screen.getByRole("spinbutton", { name: "Go to year" });
    const form = input.closest("form")!;
    expect(form).toHaveAttribute("method", "get");
    expect(form.getAttribute("action")).toBe("/history#history-year-target");
    expect(form.querySelector('input[name="theme"]')).toHaveAttribute("value", "councils");
    expect(form.querySelector('input[name="q"]')).toHaveAttribute("value", "rome");
    // A year picks its own era.
    expect(form.querySelector('input[name="era"]')).toBeNull();
    expect(input).toHaveAttribute("name", "year");
  });

  it("labels the slider's anchors and leaves the era boundaries unlabelled", async () => {
    const { container } = await show();
    const scale = container.querySelector(".vf-history-scale")!;
    expect(scale).toHaveAttribute("aria-hidden", "true");
    expect(
      Array.from(scale.querySelectorAll(".vf-history-anchor")).map((a) => a.textContent),
    ).toEqual(["33", "500", "1000", "1500", "2026"]);
    expect(scale.querySelectorAll(".vf-history-tick").length).toBeGreaterThanOrEqual(9);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "33, Apostolic Age");
    // No step attribute: see the slider's comment.
    expect(screen.getByRole("slider")).not.toHaveAttribute("step");
  });

  it("lands on a year: the era is chosen and the row marked and anchored", async () => {
    const { container } = await show({ year: "1054" });
    const nav = screen.getAllByRole("navigation", { name: "Eras" })[0]!;
    expect(within(nav).getByRole("link", { current: true })).toHaveAccessibleName(
      /^High Middle Ages/,
    );
    expect(screen.getByRole("status")).toHaveTextContent("At 1054: The Great Schism.");
    const anchor = container.querySelector("#history-year-target")!;
    const row = anchor.parentElement!.querySelector("details")!;
    expect(row.id).toBe("history-event-great-schism-1054");
    expect(row.querySelector("summary")).toHaveAttribute("aria-current", "true");
    expect(row.open).toBe(false);
    expect(screen.getByRole("slider")).toHaveValue("1054");
  });

  it("lands on a deep link with that row open", async () => {
    const { container } = await show({ event: "second-vatican-council-closes" });
    const row = container.querySelector<HTMLDetailsElement>(
      "#history-event-second-vatican-council-closes",
    )!;
    expect(row.open).toBe(true);
    expect(row.querySelector("summary")).toHaveAttribute("aria-current", "true");
    expect(rows(container).filter((d) => d.open)).toHaveLength(1);
  });

  it("pages with links that land on the list", async () => {
    await show({ theme: "saints", page: "2" });
    const pager = screen.getByRole("navigation", { name: "Pages of events" });
    expect(within(pager).getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(pager).getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/history?theme=saints&page=3#history-results",
    );
    expect(within(pager).getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/history?theme=saints#history-results",
    );
  });

  it("has no pager when one page holds everything", async () => {
    await show({ era: "apostolic" });
    expect(screen.queryByRole("navigation", { name: "Pages of events" })).toBeNull();
  });

  it("offers the eras on either side at the foot of an era", async () => {
    await show({ era: "fathers", theme: "councils" });
    const steps = screen.getByRole("navigation", { name: "Neighboring eras" });
    const links = within(steps).getAllByRole("link");
    expect(links[0]).toHaveTextContent(/Previous era.*Persecutions & Martyrs/);
    expect(links[0]).toHaveAttribute(
      "href",
      "/history?era=persecution&theme=councils#history-results",
    );
    expect(links[1]).toHaveTextContent(/Next era.*Early Middle Ages/);
  });

  it("has none in the all-eras view", async () => {
    await show();
    expect(screen.queryByRole("navigation", { name: "Neighboring eras" })).toBeNull();
  });

  it("is honest about an empty list and offers the way back", async () => {
    const { container } = await show({ q: "zzzzqx" });
    expect(rows(container)).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Showing no events");
    expect(screen.getByText("Nothing here matches “zzzzqx”.")).toBeInTheDocument();
    const back = within(container.querySelector<HTMLElement>(".vf-timeline-empty")!).getAllByRole(
      "link",
    );
    expect(back.map((a) => a.getAttribute("href"))).toEqual(["/history"]);
  });

  it("says so when an era and theme have nothing in common, with both ways back", async () => {
    const { container } = await show({ era: "apostolic", theme: "modern" });
    expect(screen.getByText("No Modern Era events in Apostolic Age.")).toBeInTheDocument();
    const back = within(container.querySelector<HTMLElement>(".vf-timeline-empty")!).getAllByRole(
      "link",
    );
    expect(back.map((a) => a.getAttribute("href"))).toEqual(["/history?era=apostolic", "/history"]);
  });

  it("offers a clear-search link and a show-all link only where they differ", async () => {
    await show({ q: "nicaea" });
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/history");
    expect(screen.queryByRole("link", { name: "Show all events" })).toBeNull();
    cleanup();
    await show({ q: "nicaea", theme: "councils" });
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/history?theme=councils",
    );
    expect(screen.getByRole("link", { name: "Show all events" })).toHaveAttribute(
      "href",
      "/history",
    );
    cleanup();
    await show();
    expect(screen.queryByRole("link", { name: "Show all events" })).toBeNull();
  });

  it("has no loading boundary: its fallback would stay on screen with JavaScript off", () => {
    expect(() => readFileSync(join(process.cwd(), "src/app/history/loading.tsx"))).toThrow();
  });
});

describe("/history metadata", () => {
  const meta = (params: Record<string, string>) =>
    generateMetadata({ searchParams: Promise.resolve(params) });

  it("makes each era and each of its pages a page in its own right", async () => {
    expect((await meta({})).alternates?.canonical).toBe("/history");
    expect((await meta({ page: "3" })).alternates?.canonical).toBe("/history?page=3");
    const era = await meta({ era: "twentieth", page: "2" });
    expect(era.alternates?.canonical).toBe("/history?era=twentieth&page=2");
    expect(era.title).toBe("Twentieth Century · Church History");
  });

  it("points a filter or a year back to the page it is a view of", async () => {
    expect((await meta({ theme: "councils" })).alternates?.canonical).toBe("/history");
    expect((await meta({ order: "newest", year: "1054" })).alternates?.canonical).toBe("/history");
  });

  it("keeps a search out of the index", async () => {
    expect((await meta({ q: "nicaea" })).robots).toEqual({ index: false, follow: true });
    expect((await meta({})).robots).toBeUndefined();
  });
});
