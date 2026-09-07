/**
 * @vitest-environment jsdom
 */
/**
 * The prayer detail page.
 *
 * The audit found /prayers/our-father printing the Our Father twice — once as
 * an "Official prayer" grey box, then again as the main text — because
 * `officialPrayer` is usually the body flattened onto one line. It also showed
 * no source, no occasions and no related saints at all.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
    buildPublishedMetadata: () => ({}),
  };
});

import PrayerDetailPage from "@/app/prayers/[slug]/page";

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

  it("still shows the official text when it is genuinely a different text", async () => {
    seed({
      body: OUR_FATHER_BODY,
      officialPrayer: "Pater noster, qui es in caelis, sanctificetur nomen tuum.",
      prayerType: "general",
      category: "general",
    });
    await renderPrayer();
    expect(screen.getByText("Official text")).toBeInTheDocument();
    expect(screen.getByText(/Pater noster/)).toBeInTheDocument();
  });

  it("shows citations as source links", async () => {
    seed({
      body: OUR_FATHER_BODY,
      prayerType: "general",
      category: "general",
      citations: ["https://www.usccb.org/prayers/our-father", "not-a-url"],
    });
    await renderPrayer();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /usccb.org/ });
    expect(link).toHaveAttribute("href", "https://www.usccb.org/prayers/our-father");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("shows the occasions the prayer is prayed on", async () => {
    seed({
      body: OUR_FATHER_BODY,
      prayerType: "general",
      category: "general",
      occasions: ["Every Mass", "Each decade of the Rosary"],
    });
    await renderPrayer();
    expect(screen.getByRole("heading", { name: "When it is prayed" })).toBeInTheDocument();
    expect(screen.getByText("Every Mass")).toBeInTheDocument();
  });

  it("resolves related saints to titled links, never slugs", async () => {
    seed(
      {
        body: OUR_FATHER_BODY,
        prayerType: "general",
        category: "general",
        relatedSaints: ["st-teresa-of-avila", "not-published"],
      },
      [["SAINT:st-teresa-of-avila", "st-teresa-of-avila", "Saint Teresa of Ávila"]],
    );
    const { container } = await renderPrayer();
    expect(screen.getByRole("link", { name: "Saint Teresa of Ávila" })).toHaveAttribute(
      "href",
      "/saints/st-teresa-of-avila",
    );
    // The unpublished reference simply disappears — no dead link, no slug.
    expect(container.textContent).not.toContain("not-published");
    expect(container.textContent).not.toContain("st-teresa-of-avila");
  });

  it("uses the prayer's canonical category as the eyebrow, never a stored raw string", async () => {
    seed({
      body: OUR_FATHER_BODY,
      prayerType: "general",
      category: "dominical", // a curated descriptive string, not a canonical value
    });
    const { container } = await renderPrayer();
    expect(container.textContent).not.toContain("dominical");
  });
});
