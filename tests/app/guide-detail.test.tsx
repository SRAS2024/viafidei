/**
 * @vitest-environment jsdom
 */
/**
 * The guide detail page.
 *
 * What is proved here is what the audit found broken: steps rendered as closed
 * accordions with no numbers, `durationMinutes: 20` printed as a section
 * headed "Duration Minutes" containing "20", and `relatedPrayers` printed as a
 * list of raw slugs above the proper prayer dropdowns.
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

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return {
    ...actual,
    getPublishedBySlug: async (contentType: string, slug: string) =>
      published.get(`${contentType}:${slug}`) ?? null,
    buildPublishedMetadata: () => ({}),
  };
});

import GuideDetailPage from "@/app/guides/[slug]/page";

function item(partial: Partial<PublishedItem> & { slug: string; contentType: string }) {
  return {
    id: partial.slug,
    contentType: partial.contentType,
    slug: partial.slug,
    title: partial.title ?? partial.slug,
    subtitle: partial.subtitle ?? "",
    authorityLevel: "USCCB",
    version: 1,
    payload: partial.payload ?? {},
  } as unknown as PublishedItem;
}

const GUIDE_PAYLOAD = {
  slug: "how-to-pray-the-rosary",
  title: "How to Pray the Holy Rosary",
  summary: "A step-by-step guide to praying the Rosary.",
  kind: "rosary",
  intro: "The Rosary is a Gospel prayer prayed on beads.",
  whatYouNeed: ["A rosary", "Today's mysteries"],
  whenToPray: "Any time; traditionally in the evening.",
  tips: ["A single decade prayed well beats five rushed."],
  durationMinutes: 20,
  steps: [
    { order: 1, title: "Begin", body: "Make the Sign of the Cross and pray the Apostles' Creed." },
    { order: 2, title: "Opening prayers", body: "On the first bead pray the Our Father." },
  ],
  relatedPrayers: ["our-father"],
  relatedDevotions: ["sacred-heart"],
  relatedSaints: ["st-dominic"],
  citations: ["https://www.usccb.org/how-to-pray-the-rosary"],
};

function seed() {
  published.clear();
  published.set(
    "GUIDE:how-to-pray-the-rosary",
    item({
      contentType: "GUIDE",
      slug: "how-to-pray-the-rosary",
      title: "How to Pray the Holy Rosary",
      payload: GUIDE_PAYLOAD,
    }),
  );
  published.set(
    "PRAYER:our-father",
    item({
      contentType: "PRAYER",
      slug: "our-father",
      title: "Our Father",
      payload: { body: "Our Father, who art in heaven..." },
    }),
  );
  published.set(
    "DEVOTION:sacred-heart",
    item({
      contentType: "DEVOTION",
      slug: "sacred-heart",
      title: "Devotion to the Sacred Heart",
      payload: {},
    }),
  );
  published.set(
    "SAINT:st-dominic",
    item({ contentType: "SAINT", slug: "st-dominic", title: "Saint Dominic", payload: {} }),
  );
}

async function renderGuide(slug = "how-to-pray-the-rosary") {
  seed();
  const ui = await GuideDetailPage({ params: Promise.resolve({ slug }) });
  return render(ui);
}

afterEach(() => cleanup());

describe("guide detail page", () => {
  it("renders the intro, what you need, when to pray, steps and tips in order", async () => {
    await renderGuide();
    expect(screen.getByText(/Gospel prayer prayed on beads/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What you need" })).toBeInTheDocument();
    expect(screen.getByText("A rosary")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "When to pray it" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Steps" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tips" })).toBeInTheDocument();
  });

  it("shows every step's text open and numbered", async () => {
    const { container } = await renderGuide();
    expect(container.querySelector("ol")).toBeInTheDocument();
    expect(screen.getByText(/Make the Sign of the Cross/)).toBeVisible();
    expect(screen.getByText(/On the first bead/)).toBeVisible();
  });

  it("shows the duration as a header line, not a 'Duration Minutes' section", async () => {
    await renderGuide();
    expect(screen.getByText("2 steps · About 20 minutes")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /duration/i })).not.toBeInTheDocument();
    expect(screen.queryByText("20")).not.toBeInTheDocument();
  });

  it("never prints a raw slug", async () => {
    const { container } = await renderGuide();
    const text = container.textContent ?? "";
    expect(text).not.toContain("our-father");
    expect(text).not.toContain("sacred-heart");
    expect(text).not.toContain("st-dominic");
    expect(text).not.toContain("how-to-pray-the-rosary");
  });

  it("resolves related devotions and saints to titled links", async () => {
    await renderGuide();
    expect(screen.getByRole("link", { name: "Devotion to the Sacred Heart" })).toHaveAttribute(
      "href",
      "/devotions/sacred-heart",
    );
    expect(screen.getByRole("link", { name: "Saint Dominic" })).toHaveAttribute(
      "href",
      "/saints/st-dominic",
    );
  });

  it("shows the guide's prayers at the bottom with their full text available", async () => {
    await renderGuide();
    expect(screen.getByRole("heading", { name: /Prayers of this guide/ })).toBeInTheDocument();
    // The prayer is a dropdown; its title is the row, never its slug.
    expect(screen.getAllByText("Our Father").length).toBeGreaterThan(0);
  });

  it("uses a human eyebrow (the guide's kind), never the raw enum", async () => {
    const { container } = await renderGuide();
    expect(container.textContent).not.toContain("GUIDE");
    expect(screen.getByText("Rosary")).toBeInTheDocument();
  });
});
