/**
 * @vitest-environment jsdom
 */
/**
 * Latin / Greek on every form of prayer.
 *
 * The owner found the language toggle "gone" on the Rosary, the Divine Mercy
 * Chaplet and the novenas. On /devotions/* it had never been there: a
 * devotion's prayers were a row of links to other pages, so the Rosary and the
 * Divine Mercy Chaplet showed no prayer text and no chip at all. Novenas listed
 * the same three prayers whatever their days actually prayed. These pages now
 * carry the prayers themselves — inline where they are named and as dropdowns
 * below — with the shared Latin / Greek chips.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PublishedItem } from "@/lib/data/published";

const published = new Map<string, PublishedItem>();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: () => {
    throw new Error("redirect");
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
    getAnyPublishedBySlug: async (slug: string, types: string[]) =>
      types.map((t) => published.get(`${t}:${slug}`)).find(Boolean) ?? null,
    listPublishedBySlugs: async (contentType: string, slugs: string[]) =>
      slugs
        .map((slug) => published.get(`${contentType}:${slug}`))
        .filter((item): item is PublishedItem => item != null),
    buildPublishedMetadata: () => ({}),
  };
});

import DevotionDetailPage from "@/app/devotions/[slug]/page";
import NovenaDetailPage from "@/app/novenas/[slug]/page";
import OurLadyDetailPage from "@/app/our-lady/[slug]/page";
import SpiritualLifeDetailPage from "@/app/spiritual-life/[slug]/page";

function put(contentType: string, slug: string, title: string, payload: Record<string, unknown>) {
  published.set(`${contentType}:${slug}`, {
    id: slug,
    contentType,
    slug,
    title,
    subtitle: "",
    authorityLevel: "VATICAN",
    version: 1,
    payload,
  } as unknown as PublishedItem);
}

function seedPrayers() {
  put("PRAYER", "sign-of-the-cross", "Sign of the Cross", {
    body: "In the name of the Father...",
    latin: "In nomine Patris...",
  });
  put("PRAYER", "our-father", "Our Father", {
    body: "Our Father, who art in heaven...",
    latin: "Pater noster, qui es in caelis...",
    greek: "Πάτερ ἡμῶν...",
  });
  put("PRAYER", "hail-mary", "Hail Mary", {
    body: "Hail Mary, full of grace...",
    latin: "Ave Maria, gratia plena...",
  });
  put("PRAYER", "glory-be", "Glory Be", { body: "Glory be to the Father..." });
  put("PRAYER", "apostles-creed", "Apostles' Creed", {
    body: "I believe in God...",
    latin: "Credo in Deum...",
  });
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const prayerList = (heading: string) =>
  screen.getByRole("heading", { name: heading }).closest("section")!;

beforeEach(() => {
  published.clear();
  window.sessionStorage.clear();
  seedPrayers();
});
afterEach(() => cleanup());

describe("/devotions/[slug] — the Rosary and the chaplets", () => {
  beforeEach(() => {
    put("DEVOTION", "divine-mercy-chaplet", "The Divine Mercy Chaplet", {
      background: "The Lord Jesus dictated the chaplet to St. Faustina in 1935.",
      practiceInstructions:
        "Begin with the Sign of the Cross, the Our Father, the Hail Mary, and the Apostles' Creed.",
      relatedPrayers: ["our-father", "hail-mary", "apostles-creed"],
    });
  });

  it("lists the devotion's prayers as dropdowns with Latin and Greek chips", async () => {
    render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    const list = prayerList("Prayers of this devotion");
    expect(within(list).getByRole("button", { name: "Latin" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Greek" })).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: /Our Father/ }));
    fireEvent.click(within(list).getByRole("button", { name: "Latin" }));
    expect(within(list).getByText(/Pater noster/)).toHaveAttribute("translate", "no");
  });

  it("opens a prayer named in 'How to practice' in place", async () => {
    render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    const article = screen.getByRole("article");
    const inline = within(article).getByRole("button", { name: /Apostles' Creed/ });
    fireEvent.click(inline);
    expect(within(article).getByText("I believe in God...")).toBeInTheDocument();
  });

  it("no longer shows the prayers as a row of links to other pages", async () => {
    const { container } = render(await DevotionDetailPage(params("divine-mercy-chaplet")));
    expect(screen.queryByRole("heading", { name: "Related prayers" })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="/prayers/"]')).toBeNull();
  });
});

describe("/novenas/[slug]", () => {
  it("numbers each day and lists the prayers its days name, in order", async () => {
    put("NOVENA", "divine-mercy-novena", "Divine Mercy Novena", {
      days: [
        {
          day: 1,
          title: "All mankind, especially sinners",
          prayerText: "Begin with the Sign of the Cross, one Our Father and the Apostles' Creed.",
        },
      ],
    });
    render(await NovenaDetailPage(params("divine-mercy-novena")));

    const day = screen.getByRole("button", { name: /Day 1\s*All mankind/ });
    fireEvent.click(day);
    // The day's prayer names open in place (case-sensitively: it is prayer text).
    expect(screen.getAllByRole("button", { name: /Our Father/ }).length).toBeGreaterThan(0);

    const list = prayerList("Prayers of this novena");
    const titles = within(list)
      .getAllByRole("button", { expanded: false })
      .map((b) => b.textContent);
    expect(titles).toEqual([
      expect.stringContaining("Sign of the Cross"),
      expect.stringContaining("Our Father"),
      expect.stringContaining("Apostles' Creed"),
    ]);
    expect(within(list).getByRole("button", { name: "Latin" })).toBeInTheDocument();
  });

  it("falls back to the Our Father, Hail Mary and Glory Be when the days name no prayer", async () => {
    put("NOVENA", "novena-saint-jude", "Novena to Saint Jude", {
      days: [{ day: 1, title: "Patron of hopeless cases", prayerText: "O blessed apostle..." }],
    });
    render(await NovenaDetailPage(params("novena-saint-jude")));
    const list = prayerList("Prayers of this novena");
    expect(within(list).getByRole("button", { name: /Our Father/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /Hail Mary/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /Glory Be/ })).toBeInTheDocument();
  });
});

describe("/our-lady/[slug] and /spiritual-life/[slug]", () => {
  it("shows a Marian title's prayers in full, never their slugs", async () => {
    put("MARIAN_TITLE", "gate-of-heaven", "Gate of Heaven", {
      origin: "Ianua caeli is an invocation of the Litany of Loreto.",
      associatedPrayers: ["hail-mary", "not-published"],
    });
    const { container } = render(await OurLadyDetailPage(params("gate-of-heaven")));
    const list = prayerList("Prayers");
    expect(within(list).getByRole("button", { name: /Hail Mary/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Latin" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("hail-mary");
    expect(container.textContent).not.toContain("not-published");
  });

  it("shows a practice's prayers in full", async () => {
    put("SPIRITUAL_PRACTICE", "meditating-the-mysteries", "Meditating the Mysteries", {
      instructions: "Pray one Our Father and ten Hail Marys for each mystery.",
      relatedPrayers: ["our-father", "hail-mary"],
    });
    render(await SpiritualLifeDetailPage(params("meditating-the-mysteries")));
    const list = prayerList("Prayers");
    expect(within(list).getByRole("button", { name: /Our Father/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Greek" })).toBeInTheDocument();
  });
});
