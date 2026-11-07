/**
 * @vitest-environment jsdom
 */
/**
 * The prayer detail page.
 *
 * The audit found /prayers/our-father printing the Our Father twice — once as
 * an "Official prayer" grey box, then again as the main text — because
 * `officialPrayer` is usually the body flattened onto one line. The owner then
 * asked for the title and the prayer, so the official-text box, occasions,
 * related saints, sources, subtitle and summary are all gone. The prayer's type
 * sits under its title in a word, as on its card, and "General" names no type.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PublishedItem } from "@/lib/data/published";

const published = new Map<string, PublishedItem>();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/components/profile", () => ({
  SaveContentButton: () => null,
}));

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return {
    ...actual,
    getPublishedBySlug: async (contentType: string, slug: string) =>
      published.get(`${contentType}:${slug}`) ?? null,
    listPublishedBySlugs: async (contentType: string, slugs: string[]) =>
      slugs
        .map((slug) => published.get(`${contentType}:${slug}`))
        .filter((item): item is PublishedItem => item != null),
    buildPublishedMetadata: () => ({}),
  };
});

import PrayerLoading from "@/app/prayers/[slug]/loading";
import PrayerDetailPage from "@/app/prayers/[slug]/page";
import { prayerKnowledge } from "@/lib/checklist/knowledge/prayers";

const OUR_FATHER_BODY = "Our Father, who art in heaven,\nhallowed be thy name;\nthy kingdom come.";
/** Exactly what the payloads store: the same prayer, flattened to one line. */
const OUR_FATHER_ONE_LINE =
  "Our Father, who art in heaven, hallowed be thy name; thy kingdom come.";

function seed(payload: Record<string, unknown>, extra: Array<[string, string, string]> = []) {
  published.clear();
  published.set("PRAYER:our-father", {
    id: "p1",
    contentType: "PRAYER",
    slug: "our-father",
    title: "Our Father",
    subtitle: "",
    authorityLevel: "USCCB",
    version: 1,
    payload,
  } as unknown as PublishedItem);
  for (const [key, slug, title] of extra) {
    published.set(key, {
      id: slug,
      contentType: key.split(":")[0],
      slug,
      title,
      subtitle: "",
      authorityLevel: "USCCB",
      version: 1,
      payload: {},
    } as unknown as PublishedItem);
  }
}

async function renderPrayer() {
  return render(await PrayerDetailPage({ params: Promise.resolve({ slug: "our-father" }) }));
}

afterEach(() => cleanup());
// The language choice is session-wide, so one test's Latin must not leak into the next.
beforeEach(() => window.sessionStorage.clear());

describe("prayer detail page", () => {
  it("renders the prayer text exactly once when officialPrayer repeats the body", async () => {
    seed({
      body: OUR_FATHER_BODY,
      officialPrayer: OUR_FATHER_ONE_LINE,
      prayerType: "general",
      category: "general",
    });
    const { container } = await renderPrayer();
    expect(screen.queryByText("Official text")).not.toBeInTheDocument();
    // "hallowed be thy name" appears once, in the prayer itself.
    const occurrences = (container.textContent ?? "").split("hallowed be thy name").length - 1;
    expect(occurrences).toBe(1);
  });

  it("shows the title and the prayer, and nothing else the payload carries", async () => {
    // The owner: "for prayer just the prayer title and then its actual prayer".
    seed(
      {
        body: OUR_FATHER_BODY,
        officialPrayer: "O God, Who by the life, death, and resurrection of Thy only-begotten Son",
        summary: "The prayer Christ himself taught the disciples.",
        prayerType: "general",
        category: "general",
        occasions: ["three-oclock-hour", "Every Mass"],
        relatedSaints: ["st-teresa-of-avila"],
        citations: ["https://www.usccb.org/prayers/our-father"],
      },
      [["SAINT:st-teresa-of-avila", "st-teresa-of-avila", "Saint Teresa of Ávila"]],
    );
    published.get("PRAYER:our-father")!.subtitle = "Catholic prayer · Latin text";
    const { container } = await renderPrayer();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Our Father");
    expect(screen.getByText(/hallowed be thy name/)).toBeInTheDocument();
    const text = container.textContent ?? "";
    for (const gone of [
      "Official text",
      "O God, Who by the life",
      "The prayer Christ himself taught",
      "Catholic prayer · Latin text",
      "When it is prayed",
      "three-oclock-hour",
      "Saint Teresa of Ávila",
      "Sources",
      "usccb.org",
    ]) {
      expect(text, gone).not.toContain(gone);
    }
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens the prayers a Rosary or chaplet prayer names, in place, with their Latin", async () => {
    seed({ body: OUR_FATHER_BODY, latin: "Pater noster, qui es in caelis." });
    published.set("PRAYER:rosary-opening-prayers", {
      id: "p2",
      contentType: "PRAYER",
      slug: "rosary-opening-prayers",
      title: "Opening Prayers of the Rosary",
      subtitle: "",
      authorityLevel: "USCCB",
      version: 1,
      payload: { body: "3. On the single bead, pray the Our Father.", prayerType: "rosary" },
    } as unknown as PublishedItem);
    render(await PrayerDetailPage({ params: Promise.resolve({ slug: "rosary-opening-prayers" }) }));

    const name = screen.getByRole("button", { name: /Our Father/ });
    fireEvent.click(name);
    expect(screen.getByText(/hallowed be thy name/)).toBeInTheDocument();
    // The opened prayer's title follows the page's h1 as an h2, never an h3.
    expect(screen.getAllByRole("heading").map((h) => `${h.tagName}:${h.textContent}`)).toEqual([
      "H1:Opening Prayers of the Rosary",
      "H2:Our Father",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    expect(
      screen.getByText("Pater noster, qui es in caelis.").closest(".vf-prayer"),
    ).toHaveAttribute("translate", "no");
  });

  it("never links a prayer's own name inside its text", async () => {
    seed({ body: OUR_FATHER_BODY, latin: "Pater noster, qui es in caelis." });
    await renderPrayer();
    // Only the Share control carries the name; the prayer text has no link.
    expect(screen.getAllByRole("button", { name: /Our Father/ })).toEqual([
      screen.getByRole("button", { name: "Share Our Father" }),
    ]);
  });

  it("shows the title and the prayer — no category eyebrow, never a stored raw string", async () => {
    seed({
      body: OUR_FATHER_BODY,
      prayerType: "general",
      category: "dominical", // a curated descriptive string, not a canonical value
    });
    const { container } = await renderPrayer();
    expect(container.textContent).not.toContain("dominical");
    // "General" over the Our Father said nothing; the title opens the page.
    expect(container.querySelector(".vf-eyebrow")).toBeNull();
    expect(container.textContent).not.toContain("General");
    expect(container.querySelector("header")?.firstElementChild?.textContent).toMatch(
      /^Our Father/,
    );
  });

  it("loads in the shape of the page it is loading, not the list above it", () => {
    render(<PrayerLoading />);
    expect(screen.getByTestId("detail-loading")).toHaveClass("vf-detail");
  });

  it("sets the page in the reading column: title, actions, then the prayer", async () => {
    seed({ body: OUR_FATHER_BODY, latin: "Pater noster.", category: "marian" });
    const { container } = await renderPrayer();
    const article = container.querySelector("article.vf-detail")!;
    const header = article.querySelector("header.vf-detail-header")!;
    expect(header.firstElementChild?.tagName).toBe("H1");
    expect(header.textContent).not.toContain("Marian");
    const actions = header.querySelector(".vf-detail-actions")!;
    expect(
      within(actions as HTMLElement).getByRole("button", { name: "Share Our Father" }),
    ).toBeTruthy();
    // The chips stay with the text they switch, after the header.
    const group = screen.getByRole("group", { name: "Prayer language" });
    expect(header.contains(group)).toBe(false);
    expect(group.nextElementSibling).toHaveClass("vf-prayer");
    expect(group.nextElementSibling).toHaveTextContent("hallowed be thy name;");
    expect(screen.getByText("hallowed be thy name;")).toHaveClass("vf-prayer-line");
  });

  it("sets a title's closing bracket under it, with the title's words unchanged", async () => {
    seed({ body: OUR_FATHER_BODY });
    published.get("PRAYER:our-father")!.title = "Hail Holy Queen (Salve Regina)";
    await renderPrayer();
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveTextContent("Hail Holy Queen (Salve Regina)");
    expect(title.querySelector(".vf-detail-title-aside")).toHaveTextContent("(Salve Regina)");
  });

  it("keeps a psalm's other number with its title, and St. with its name", async () => {
    seed({ body: OUR_FATHER_BODY });
    published.get("PRAYER:our-father")!.title = "Psalm 102 (103)";
    const { unmount } = await renderPrayer();
    expect(screen.getByRole("heading", { level: 1 }).querySelector("span")).toBeNull();
    unmount();

    published.get("PRAYER:our-father")!.title = "The Chaplet of St. Michael";
    await renderPrayer();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "The Chaplet of St.\u00a0Michael",
    );
  });

  it("says when a language is a machine translation rather than the liturgical text", async () => {
    seed({
      body: OUR_FATHER_BODY,
      latin: "Pater noster, qui es in caelis.",
      greek: "Πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς.",
      // The June 2026 machine fills are marked; this prayer's Greek is one.
      machineTranslated: ["greek"],
    });
    await renderPrayer();
    const note = /Unofficial translation/;
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Greek" }));
    expect(screen.getByText("Πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς.")).toBeInTheDocument();
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  it("never calls the curated Latin unofficial under a marker that outlived the fill", async () => {
    // The live Litany of Saint Joseph: the curated seed wrote the Holy See's
    // Latin over the June 2026 machine fill and kept the marker, which still
    // names both languages. Only the Greek is a machine fill.
    const curated = prayerKnowledge.find((p) => p.slug === "litany-of-saint-joseph")!;
    published.clear();
    published.set("PRAYER:litany-of-saint-joseph", {
      id: "p3",
      contentType: "PRAYER",
      slug: "litany-of-saint-joseph",
      title: "Litany of Saint Joseph",
      subtitle: "",
      authorityLevel: "VATICAN",
      version: 1,
      payload: {
        body: curated.payload.body,
        latin: curated.payload.latin,
        greek: "Κύριε, ελέησον.",
        machineTranslated: ["latin", "greek"],
      },
    } as unknown as PublishedItem);
    const { container } = render(
      await PrayerDetailPage({ params: Promise.resolve({ slug: "litany-of-saint-joseph" }) }),
    );
    const note = /Unofficial translation/;
    fireEvent.click(screen.getByRole("button", { name: "Latin" }));
    expect(container.textContent).toContain("Sancte Ioseph, ora pro nobis.");
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Greek" }));
    expect(screen.getByText(note)).toBeInTheDocument();
  });
});
