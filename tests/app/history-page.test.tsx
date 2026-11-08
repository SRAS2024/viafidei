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

import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
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
          publishedSlugs: {
            popes: [],
            saints: ["saint-peter", "saint-augustine-of-hippo", "saint-monica"],
            doctors: ["doctor-augustine-of-hippo"],
            apparitions: [],
          },
          relatedTitles: {
            saints: {
              "saint-peter": "Saint Peter the Apostle",
              "saint-augustine-of-hippo": "Saint Augustine of Hippo",
              "saint-monica": "Saint Monica",
            },
            doctors: { "doctor-augustine-of-hippo": "Saint Augustine of Hippo" },
          },
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
    expect(
      within(first).getByRole("link", { hidden: true, name: "Saint Peter the Apostle" }),
    ).toHaveAttribute("href", "/saints/saint-peter");
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

  it("gives a voice each era's years and count, as one line it can read", async () => {
    const { container } = await show();
    const lines = Array.from(container.querySelectorAll(".vf-timeline-era-meta"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      // Safari's accessibility tree loses the rest of a line of text that begins with
      // something hidden from it (it used to lose the count), and takes .sr-only out of
      // the line as a stop of its own.
      expect(line.firstElementChild).toHaveClass("vf-sr-inline");
      expect(line.querySelector(".sr-only")).toBeNull();
    }
    const heard = lines.map((line) => {
      const copy = line.cloneNode(true) as Element;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
      return copy.textContent?.replace(/\s+/g, " ").trim();
    });
    expect(heard[0]).toMatch(/^from 30 to 100, \d+ events?$/);
    for (const words of heard) expect(words).toMatch(/^from \S+ to \S+, [\d,]+ events?$/);
    // And what the eye reads is what it always was, the words given no room of their own.
    const seen = lines[0]!.querySelectorAll('[aria-hidden="true"]');
    expect(seen[0]).toHaveTextContent(/^30–100$/);
    expect(seen[1]).toHaveTextContent(/^·$/);
  });

  it("keeps a neighboring era's label a line of its own beside its arrow", async () => {
    await show({ era: "persecution" });
    const steps = screen.getByRole("navigation", { name: "Neighboring eras" });
    expect(within(steps).getByRole("link", { name: /^Previous era Apostolic Age/ })).toBeVisible();
    expect(within(steps).getByRole("link", { name: /^Next era Fathers/ })).toBeVisible();
    for (const label of steps.querySelectorAll(".vf-history-era-step-label")) {
      for (const node of label.childNodes) expect(node.nodeType).toBe(Node.ELEMENT_NODE);
      expect(label.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    }
  });

  it("opens on its title alone, which says what the page is", async () => {
    const { container } = await show();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Church History");
    expect(container.querySelector(".vf-page-hero-lede")).toBeNull();
    expect(screen.queryByText(/events from c\. 33 to today/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Scroll the timeline/)).not.toBeInTheDocument();
  });

  it("announces the count in a live region", async () => {
    await show();
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 60 of ${TOTAL} events`);
    expect(screen.getByRole("status").closest("[aria-busy]")).toBeNull();
    expect(document.getElementById("history-results")).toHaveAttribute("aria-busy", "false");
  });

  it("gives the ear its own sentence, and shows no label for the order", async () => {
    await show({ order: "newest", era: "fathers", theme: "councils" });
    const status = screen.getByRole("status");
    const spoken = status.querySelector(".sr-only");
    const seen = status.querySelector('[aria-hidden="true"]');
    expect(spoken).toHaveTextContent(
      /^Fathers & First Councils, Councils: showing .*, newest first\.$/,
    );
    expect(seen).toHaveTextContent(/^Showing .* events$/);
    expect(seen).not.toHaveTextContent("newest");
  });

  it("keeps the list role on every list, which Safari drops from a list with no markers", async () => {
    const { container } = await show({ theme: "saints", page: "2" });
    const lists = Array.from(container.querySelectorAll("ul, ol"));
    expect(lists.length).toBeGreaterThan(3);
    for (const list of lists) expect(list).toHaveAttribute("role", "list");
  });

  it("has no era in the title, so that nothing speaks over the status on a move", async () => {
    const title = async (params: Record<string, string>) =>
      (await generateMetadata({ searchParams: Promise.resolve(params) })).title;
    expect(await title({})).toBe("Church History");
    expect(await title({ era: "fathers" })).toBe("Church History");
    expect(await title({ year: "1054" })).toBe("Church History");
    expect(await title({ theme: "councils", page: "2" })).toBe("Church History");
  });

  it("offers the way on from a year to the row it found", async () => {
    await show({ year: "1054" });
    const link = screen.getByRole("link", { name: /^Go to this event/ });
    expect(link).toHaveAccessibleName("Go to this event: The Great Schism");
    expect(link).toHaveAttribute("href", "#history-event-great-schism-1054");
    cleanup();
    await show({ era: "fathers" });
    expect(screen.queryByRole("link", { name: /^Go to this event/ })).toBeNull();
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

  it("keeps Previous, the numbers and Next in one order, the keyboard's", async () => {
    await show({ page: "2" });
    const pager = screen.getByRole("navigation", { name: "Pages of events" });
    const names = within(pager)
      .getAllByRole("link")
      .map((a) => a.getAttribute("aria-label") ?? a.textContent?.trim());
    expect(names[0]).toMatch(/Previous/);
    expect(names.at(-1)).toMatch(/Next/);
    // The narrow layout hides the words, not the names: see the stylesheet's pager.
    expect(pager.querySelectorAll(".vf-history-pager-word")).toHaveLength(2);
    // One list, so they wrap as one line of words does: the numbers used to stack up
    // in their own column between the arrows once the text was enlarged.
    expect(within(pager).getAllByRole("list")).toHaveLength(1);
    expect(within(pager).getAllByRole("listitem").at(0)).toContainElement(
      within(pager).getByRole("link", { name: /Previous/ }),
    );
    expect(within(pager).getAllByRole("listitem").at(-1)).toContainElement(
      within(pager).getByRole("link", { name: /Next/ }),
    );
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const block = css.slice(
      css.indexOf(".vf-history-pager {"),
      css.indexOf(".vf-history-era-steps {"),
    );
    expect(block).not.toMatch(/order:\s*-?\d/);
    expect(block).not.toMatch(/flex-wrap: nowrap/);
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

  it("does not offer show-all for what narrows nothing, and keeps the order when it does", async () => {
    await show({ order: "newest" });
    expect(screen.queryByRole("link", { name: "Show all events" })).toBeNull();
    cleanup();
    await show({ page: "2" });
    expect(screen.queryByRole("link", { name: "Show all events" })).toBeNull();
    cleanup();
    await show({ era: "fathers", order: "newest" });
    expect(screen.getByRole("link", { name: "Show all events" })).toHaveAttribute(
      "href",
      "/history?order=newest",
    );
    cleanup();
    const { container } = await show({ era: "apostolic", theme: "modern", order: "newest" });
    const back = within(container.querySelector<HTMLElement>(".vf-timeline-empty")!).getByRole(
      "link",
      { name: "Show all events" },
    );
    expect(back).toHaveAttribute("href", "/history?order=newest");
  });

  it("marks the ways back that are gone once followed, for the focus to go on", async () => {
    await show({ q: "nicaea", theme: "councils" });
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "data-landing",
      "status",
    );
    expect(screen.getByRole("link", { name: "Show all events" })).toHaveAttribute(
      "data-landing",
      "status",
    );
    cleanup();
    const { container } = await show({ q: "zzzzqx", theme: "councils" });
    for (const link of container.querySelectorAll(".vf-timeline-empty a")) {
      expect(link).toHaveAttribute("data-landing", "status");
    }
  });

  it("reads each related link from its page's own title, and tells two apart", async () => {
    const { container } = await show({ event: "baptism-of-saint-augustine" });
    const row = container.querySelector("#history-event-baptism-of-saint-augustine")!;
    expect(
      within(row as HTMLElement)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual([
      "Saint Augustine of Hippo",
      "Saint Monica",
      "Saint Augustine of Hippo, Doctor of the Church",
    ]);
  });

  it("has no loading boundary: its fallback would stay on screen with JavaScript off", () => {
    expect(() => readFileSync(join(process.cwd(), "src/app/history/loading.tsx"))).toThrow();
  });
});

// What a browser would show, guarded here because e2e runs apart from this suite.
describe("/history's stylesheet", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("only animates a row's opening for a reader who has not asked for less motion", () => {
    // The site-wide reset names *, *::before and *::after, which do not reach this.
    const media = css.lastIndexOf("@media", css.indexOf("::details-content {"));
    expect(css.slice(media, css.indexOf("::details-content {"))).toContain(
      "@media (prefers-reduced-motion: no-preference)",
    );
  });

  it("clears a focused row or link of the sticky era heading: focus scrolls what it lands on", () => {
    expect(css).toMatch(
      /\.vf-timeline-event,\s*\.vf-timeline-summary,\s*\.vf-timeline-body a \{\s*scroll-margin-top/,
    );
  });

  it("does not jump the page as the focus moves among the held box's own controls", () => {
    expect(css).toMatch(/\.vf-history-docked :is\(input, button\) \{\s*scroll-margin-top: -1rem;/);
  });

  it("leaves the slider's place to the page, with no browser's own correction on top", () => {
    expect(css).toMatch(/\.vf-history \{[^}]*overflow-anchor: none;/);
  });

  it("keeps the readout's height whichever era's name it shows", () => {
    expect(css).toMatch(/\.vf-history-readout > \* \{\s*grid-area: 1 \/ 1;/);
    expect(css).toMatch(/\.vf-history-readout-room \{\s*visibility: hidden;/);
  });

  it("breaks a word too long for a phone's line at 200% rather than letting it run out", () => {
    expect(css).toMatch(/\.vf-timeline-body \{[^}]*overflow-wrap: break-word;/);
  });

  it("rings the slider's thumb, not the input whose box runs through the year labels", () => {
    expect(css).toMatch(/\.vf-history-slider:focus-visible \{\s*outline: none;/);
    expect(css).toMatch(/\.vf-history-slider:focus-visible::-webkit-slider-thumb \{\s*box-shadow/);
    expect(css).toMatch(/\.vf-history-slider:focus-visible::-moz-range-thumb \{\s*box-shadow/);
  });

  it("keeps the slider's mark and the era counts readable on the dark panel", () => {
    expect(css).toMatch(
      /html\[data-theme="dark"\] \.vf-history \{[^}]*--slider-fill: var\(--focus-ring\);/,
    );
    expect(css).toMatch(
      /html\[data-theme="dark"\] \.vf-history \.vf-history-era-count \{\s*opacity: 0\.9;/,
    );
    expect(css).toContain(
      'html[data-theme="dark"] .vf-history a.vf-history-era:hover .vf-history-era-count',
    );
  });

  it("sets no supporting text on this page below 14 pixels", () => {
    const start = css.indexOf("Church history: the control panel");
    const block = css.slice(start, css.indexOf("@layer utilities", start));
    const sizes = [...block.matchAll(/font-size: (?:min\()?([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(5);
    expect(sizes.filter((size) => size < 0.875)).toEqual([]);
  });

  it("gives a row's kind a line of its own before its one long word can run out of the row", () => {
    expect(css).toMatch(
      /@container history-list \(max-width: 18\.5rem\) \{\s*\.vf-timeline-summary \{[^}]*"marker date chevron"\s*"marker title title"\s*"marker kind kind"/,
    );
  });
});

describe("/history in the reader's language", () => {
  const LOCALES = Object.keys(DICTIONARIES) as Locale[];

  it("has its own words for what this page added, in every language", () => {
    expect(LOCALES).toHaveLength(12);
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const t = createTranslator(locale);
      const en = createTranslator("en");
      for (const key of ["history.goToEvent", "history.yearBox"]) {
        expect(t(key), `${locale} ${key}`).not.toBe(en(key));
      }
      expect(t("history.doctorOfTheChurch", { name: "X" }), locale).toMatch(/^X[,，] ?\S/);
      expect(t("history.doctorOfTheChurch", { name: "X" }), locale).not.toBe(
        en("history.doctorOfTheChurch", { name: "X" }),
      );
      expect(t("history.sliderHint", { years: 5 }), locale).toMatch(/5/);
      expect(t("history.sliderHint", { years: 5 }), locale).not.toContain("{years}");
      expect(t("history.sliderHint", { years: 5 }), locale).not.toBe(
        en("history.sliderHint", { years: 5 }),
      );
    }
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
    expect(era.description).toMatch(/^Twentieth Century: A timeline/);
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
