/**
 * What a URL of /history shows (src/app/history/historyView.ts): the filters,
 * the era and page in effect, one page of events grouped by era and century, the
 * year and deep-link landings, and the sentence announced for it all.
 */
import { describe, expect, it } from "vitest";

import {
  FILTER_KEYS,
  HISTORY_PAGE_SIZE,
  buildHistoryView,
  centuryLabel,
  eventAtYear,
  historyStatusSpeech,
  historyStatusText,
  parseHistoryParams,
  type HistoryParams,
} from "@/app/history/historyView";
import { HISTORY_PATH, historyHref } from "@/app/history/historyUrl";
import { buildTimeline, type HistoryEvent } from "@/lib/content-shared/church-history/timeline";
import { HISTORY_ERAS } from "@/lib/content-shared/church-history/types";

const timeline = buildTimeline([], { currentYear: 2026 });
const { events } = timeline;

function view(params: Partial<HistoryParams> = {}) {
  return buildHistoryView(timeline, { ...parseHistoryParams({}), ...params });
}

const shownSlugs = (v: ReturnType<typeof view>) =>
  v.groups.flatMap((g) => g.centuries.flatMap((c) => c.events.map((e) => e.slug)));

describe("parseHistoryParams", () => {
  it("takes the URL's state", () => {
    expect(
      parseHistoryParams({
        era: "fathers",
        theme: "councils",
        q: "  nicaea   creed ",
        order: "newest",
        page: "3",
        year: "1054",
        event: "first-council-of-nicaea",
      }),
    ).toEqual({
      era: "fathers",
      theme: "councils",
      q: "nicaea creed",
      order: "newest",
      page: 3,
      year: 1054,
      event: "first-council-of-nicaea",
    });
  });

  it("treats anything it does not recognise as not asked for", () => {
    expect(
      parseHistoryParams({
        era: "the-moon",
        theme: "<script>",
        order: "sideways",
        page: "-2",
        year: "soon",
        event: "../../etc",
      }),
    ).toEqual({
      era: null,
      theme: "all",
      q: "",
      order: "oldest",
      page: 1,
      year: null,
      event: null,
    });
    expect(parseHistoryParams({ page: "abc", year: "12345" })).toMatchObject({
      page: 1,
      year: null,
    });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseHistoryParams({ era: ["twentieth", "fathers"], q: ["a", "b"] })).toMatchObject({
      era: "twentieth",
      q: "a",
    });
  });
});

describe("historyHref", () => {
  it("leaves out whatever is already the default", () => {
    expect(historyHref()).toBe(HISTORY_PATH);
    expect(historyHref({ theme: "all", order: "oldest", page: 1, q: "", era: null })).toBe(
      HISTORY_PATH,
    );
  });

  it("is a link to every state", () => {
    expect(
      historyHref(
        { era: "fathers", theme: "councils", q: "st peter", order: "newest", page: 2, year: 325 },
        "history-results",
      ),
    ).toBe(
      "/history?era=fathers&theme=councils&q=st+peter&order=newest&page=2&year=325#history-results",
    );
    expect(historyHref({ event: "pentecost" }, "history-event-pentecost")).toBe(
      "/history?event=pentecost#history-event-pentecost",
    );
  });
});

describe("centuryLabel", () => {
  it.each([
    [33, "1st century"],
    [100, "1st century"],
    [101, "2nd century"],
    [250, "3rd century"],
    [325, "4th century"],
    [1054, "11th century"],
    [1150, "12th century"],
    [1250, "13th century"],
    [1950, "20th century"],
    [2000, "20th century"],
    [2001, "21st century"],
    [2026, "21st century"],
  ])("%i is the %s", (year, label) => {
    expect(centuryLabel(year)).toBe(label);
  });
});

describe("the default view", () => {
  const v = view();

  it("shows one page, starting from Pentecost", () => {
    expect(shownSlugs(v)).toHaveLength(HISTORY_PAGE_SIZE);
    expect(shownSlugs(v)[0]).toBe("pentecost");
    expect(v.page).toBe(1);
    expect(v.pageCount).toBe(Math.ceil(events.length / HISTORY_PAGE_SIZE));
    expect(v.era).toBeNull();
    expect(v.total).toBe(events.length);
  });

  it("groups under eras in order, then centuries, with one heading each", () => {
    expect(v.groups.map((g) => g.era.key).slice(0, 2)).toEqual(["apostolic", "persecution"]);
    expect(v.groups[0]!.centuries.map((c) => c.label)).toEqual(["1st century"]);
    expect(v.groups[1]!.centuries.map((c) => c.label)[0]).toBe("2nd century");
    expect(v.groups[0]!.count).toBe(v.eraCounts["apostolic"]);
  });

  it("is announced with the thousands separator", () => {
    expect(historyStatusText(v)).toBe(
      `Showing 60 of ${events.length.toLocaleString("en-US")} events`,
    );
  });

  it("has a slider standing on the first event", () => {
    expect(v.sliderYear).toBe(33);
    expect(v.sliderMin).toBe(33);
    expect(v.sliderMax).toBe(2026);
  });
});

describe("eras", () => {
  it("shows only the chosen era, with one heading, and its neighbours in reading order", () => {
    const v = view({ era: "fathers" });
    expect(v.groups.map((g) => g.era.key)).toEqual(["fathers"]);
    expect(v.previousEra?.key).toBe("persecution");
    expect(v.nextEra?.key).toBe("early-medieval");

    const newest = view({ era: "fathers", order: "newest" });
    expect(newest.previousEra?.key).toBe("early-medieval");
    expect(newest.nextEra?.key).toBe("persecution");
  });

  it("has no neighbour past either end", () => {
    expect(view({ era: "apostolic" }).previousEra).toBeNull();
    expect(view({ era: "post-conciliar" }).nextEra).toBeNull();
  });

  it("skips a neighbouring era with nothing under the filters", () => {
    const v = view({ era: "twentieth", theme: "councils" });
    if (v.nextEra) expect(v.eraCounts[v.nextEra.key]).toBeGreaterThan(0);
    if (v.previousEra) expect(v.eraCounts[v.previousEra.key]).toBeGreaterThan(0);
  });

  it("keeps one heading per era although a boundary-year event falls among the next era's", () => {
    // The timeline is sorted by date, so Vatican II's close (December 1965, in the
    // twentieth-century era) sits among the first post-conciliar events.
    const headings: string[] = [];
    for (let page = 1; page <= view().pageCount; page++) {
      headings.push(...view({ page }).groups.map((g) => g.era.key));
    }
    // Each era's heading appears on consecutive pages only: never twice in a row
    // on one page, and never returning once it is over.
    const distinct = headings.filter((key, i) => key !== headings[i - 1]);
    expect(distinct).toEqual(HISTORY_ERAS.map((e) => e.key));
  });

  it("reads every event exactly once, across all the pages", () => {
    const seen: string[] = [];
    for (let page = 1; page <= view().pageCount; page++) seen.push(...shownSlugs(view({ page })));
    expect(seen).toHaveLength(events.length);
    expect(new Set(seen).size).toBe(events.length);
  });
});

describe("pages", () => {
  it("announces the range past the first page", () => {
    const v = view({ page: 2 });
    expect(v.rangeStart).toBe(61);
    expect(v.rangeEnd).toBe(120);
    expect(historyStatusText(v)).toBe(
      `Showing 61 to 120 of ${events.length.toLocaleString("en-US")} events`,
    );
  });

  it("shows the last page for a page past the end", () => {
    const v = view({ page: 9999 });
    expect(v.page).toBe(v.pageCount);
    expect(shownSlugs(v).length).toBeGreaterThan(0);
  });

  it("says all when everything fits on one page", () => {
    const v = view({ era: "apostolic" });
    expect(historyStatusText(v)).toBe(`Showing all ${v.total} events`);
  });
});

describe("themes", () => {
  it("counts each theme under the era and search in effect", () => {
    const whole = view();
    expect(whole.themeCounts.all).toBe(events.length);
    for (const key of FILTER_KEYS) expect(whole.themeCounts[key]).toBeGreaterThan(0);

    const era = view({ era: "apostolic" });
    expect(era.themeCounts.all).toBe(era.total);
    expect(era.themeCounts.modern).toBe(0);
  });

  it("counts each era under the theme in effect", () => {
    const councils = view({ theme: "councils" });
    expect(councils.allErasCount).toBe(councils.total);
    const sum = Object.values(councils.eraCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(councils.total);
    expect(councils.groups.flatMap((g) => g.centuries).flatMap((c) => c.events)).toSatisfy(
      (list: HistoryEvent[]) => list.every((e) => e.kind === "council"),
    );
  });

  it("is honest when a theme and era have nothing in common", () => {
    const v = view({ era: "apostolic", theme: "modern" });
    expect(v.total).toBe(0);
    expect(v.groups).toEqual([]);
    expect(historyStatusText(v)).toBe("Showing no events");
  });
});

describe("search", () => {
  it("finds by title, oldest first, not best match first", () => {
    const v = view({ q: "nicaea" });
    const titles = v.groups.flatMap((g) => g.centuries).flatMap((c) => c.events);
    expect(titles.some((e) => e.slug === "first-council-of-nicaea")).toBe(true);
    const keys = titles.map((e) => e.sortKey);
    expect(keys).toEqual([...keys].sort());
  });

  it("finds by location and by context", () => {
    expect(shownSlugs(view({ q: "Zaragoza" })).length).toBeGreaterThan(0);
    const inContext = events.find((e) => e.context?.includes("upper room"));
    expect(shownSlugs(view({ q: "upper room" }))).toContain(inContext!.slug);
  });

  it("matches nothing for nonsense, and narrows the counts", () => {
    const none = view({ q: "zzzzqx" });
    expect(none.total).toBe(0);
    expect(none.allErasCount).toBe(0);
    const some = view({ q: "nicaea" });
    expect(some.allErasCount).toBe(some.total);
    expect(some.themeCounts.all).toBe(some.total);
  });
});

describe("order", () => {
  it("reverses the reading order", () => {
    const v = view({ order: "newest" });
    const shown = v.groups.flatMap((g) => g.centuries).flatMap((c) => c.events);
    expect(v.groups[0]!.era.key).toBe("post-conciliar");
    const keys = shown.map((e) => e.sortKey);
    expect(keys).toEqual([...keys].sort().reverse());
  });
});

describe("landing on a year", () => {
  it("lands in the era and on the page holding the first event at or after it", () => {
    const v = view({ year: 1545 });
    expect(v.target?.year).toBeGreaterThanOrEqual(1545);
    expect(v.era?.key).toBe("reformation-trent");
    expect(shownSlugs(v)).toContain(v.target!.slug);
    expect(v.sliderYear).toBe(1545);
    const inEra = events.filter((e) => e.era === v.era!.key);
    const earlier = inEra.filter((e) => e.year < 1545).length;
    expect(v.page).toBe(Math.floor(earlier / HISTORY_PAGE_SIZE) + 1);
    expect(historyStatusText(v)).toContain(`At 1545: ${v.target!.title}.`);
  });

  it("lands in the era a boundary year names, not on the last row of the age before", () => {
    const v = view({ year: 1054 });
    expect(v.era?.key).toBe("high-medieval");
    expect(v.target?.slug).toBe("great-schism-1054");
    expect(v.target?.year).toBe(1054);
  });

  it("reading newest first, lands where the list crosses the year going down", () => {
    const v = view({ year: 1000, order: "newest" });
    expect(v.target?.year).toBeLessThanOrEqual(1000);
    expect(v.era?.key).toBe("early-medieval");
    const list = events.filter((e) => e.era === "early-medieval" && e.year <= 1000);
    expect(v.target?.slug).toBe(list.at(-1)?.slug);
  });

  it("stays inside the filters and the ends of the timeline", () => {
    const councils = view({ theme: "councils", year: 1100 });
    expect(councils.target?.kind).toBe("council");
    expect(councils.target?.year).toBeGreaterThanOrEqual(1100);

    expect(view({ year: 1 }).target?.slug).toBe("pentecost");
    expect(view({ year: 1 }).sliderYear).toBe(33);
    const last = view({ year: 9999 });
    expect(last.sliderYear).toBe(2026);
    expect(last.era?.key).toBe("post-conciliar");
    expect(shownSlugs(last)).toContain(last.target!.slug);
  });

  it("has nothing to land on when nothing matches", () => {
    const v = view({ q: "zzzzqx", year: 1000 });
    expect(v.target).toBeNull();
    expect(v.total).toBe(0);
  });

  it("eventAtYear handles an empty list", () => {
    expect(eventAtYear([], 1000, "oldest")).toBeNull();
    expect(eventAtYear([], 1000, "newest")).toBeNull();
  });
});

describe("the sentence for the ear", () => {
  const total = events.length.toLocaleString("en-US");

  it("is the count alone in the plain view", () => {
    expect(historyStatusSpeech(view())).toBe(`Showing 60 of ${total} events.`);
  });

  it("says when the list is reversed, though nothing visible does", () => {
    expect(historyStatusSpeech(view({ order: "newest" }))).toBe(
      `Showing 60 of ${total} events, newest first.`,
    );
    expect(historyStatusText(view({ order: "newest" }))).not.toContain("newest");
    expect(historyStatusSpeech(view({ order: "newest" }))).not.toBe(historyStatusSpeech(view()));
  });

  it("names the era and theme, so that views of one length do not sound the same", () => {
    expect(historyStatusSpeech(view({ era: "fathers" }))).toMatch(
      /^Fathers & First Councils: showing \d+ of \d+ events\.$/,
    );
    expect(historyStatusSpeech(view({ era: "fathers", theme: "councils" }))).toMatch(
      /^Fathers & First Councils, Councils: showing all \d+ events\.$/,
    );
    expect(historyStatusSpeech(view({ theme: "councils" }))).toMatch(/^Councils: showing /);
  });

  it("names what was searched for", () => {
    expect(historyStatusSpeech(view({ q: "nicaea" }))).toMatch(/events? for “nicaea”\.$/);
    expect(historyStatusSpeech(view({ q: "zzzzqx" }))).toBe("Showing no events for “zzzzqx”.");
  });

  it("gives the range past the first page", () => {
    expect(historyStatusSpeech(view({ page: 2 }))).toBe(`Showing 61 to 120 of ${total} events.`);
  });

  it("leads with where a year or a link landed, since that is the news", () => {
    expect(historyStatusSpeech(view({ year: 1054 }))).toMatch(
      /^At 1054: The Great Schism\. High Middle Ages: showing \d+ of \d+ events\.$/,
    );
    expect(historyStatusSpeech(view({ event: "pentecost" }))).toMatch(
      /^Opened: Pentecost — the Church is born\. Apostolic Age: showing all \d+ events\.$/,
    );
  });

  it("keeps the visible sentence short: the page around it says the rest", () => {
    expect(historyStatusText(view({ era: "fathers" }))).toMatch(/^Showing \d+ of \d+ events$/);
    expect(historyStatusText(view({ year: 1054 }))).toMatch(
      /^Showing \d+ of \d+ events\. At 1054: The Great Schism\.$/,
    );
  });
});

describe("a deep link to an event", () => {
  it("lands on its era and page, and opens its row", () => {
    const v = view({ event: "second-vatican-council-closes" });
    expect(v.era?.key).toBe("twentieth");
    expect(v.openSlug).toBe("second-vatican-council-closes");
    expect(shownSlugs(v)).toContain("second-vatican-council-closes");
    expect(v.target?.slug).toBe("second-vatican-council-closes");
    expect(historyStatusText(v)).toContain("Opened:");
  });

  it("yields any theme or search that would hide the event", () => {
    const v = view({ event: "pentecost", theme: "modern", q: "zzzzqx" });
    expect(v.theme).toBe("all");
    expect(v.q).toBe("");
    expect(shownSlugs(v)).toContain("pentecost");
  });

  it("keeps a theme that does not hide it", () => {
    const v = view({ event: "first-council-of-nicaea", theme: "councils" });
    expect(v.theme).toBe("councils");
    expect(shownSlugs(v)).toContain("first-council-of-nicaea");
  });

  it("ignores an event that does not exist", () => {
    const v = view({ event: "no-such-event" });
    expect(v.target).toBeNull();
    expect(v.openSlug).toBeNull();
    expect(shownSlugs(v)[0]).toBe("pentecost");
  });
});
