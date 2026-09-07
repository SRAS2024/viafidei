/**
 * @vitest-environment jsdom
 */
/**
 * Cross-content references. The rule proved here is the one the whole site
 * depends on: a reference that cannot be resolved to a PUBLISHED item
 * disappears — it never becomes a dead link and never becomes a naked slug.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PublishedItem } from "@/lib/data/published";

const published = new Map<string, PublishedItem>();

vi.mock("@/lib/data/published", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/published")>();
  return {
    ...actual,
    getPublishedBySlug: async (contentType: string, slug: string) =>
      published.get(`${contentType}:${slug}`) ?? null,
  };
});

import { RelatedContentLinks, resolveRelatedLinks } from "@/components/ui/RelatedContentLinks";

function seed(contentType: string, slug: string, title: string) {
  published.set(`${contentType}:${slug}`, {
    id: slug,
    contentType,
    slug,
    title,
    subtitle: "",
    authorityLevel: "USCCB",
    version: 1,
    payload: {},
  } as unknown as PublishedItem);
}

afterEach(() => {
  cleanup();
  published.clear();
});

describe("resolveRelatedLinks", () => {
  it("resolves slugs to titles and canonical hrefs, keeping the given order", async () => {
    seed("PRAYER", "our-father", "Our Father");
    seed("PRAYER", "hail-mary", "Hail Mary");
    const links = await resolveRelatedLinks("PRAYER", ["hail-mary", "our-father"]);
    expect(links.map((l) => l.title)).toEqual(["Hail Mary", "Our Father"]);
    expect(links[0].href).toBe("/prayers/hail-mary");
  });

  it("drops references that are not published rather than linking nowhere", async () => {
    seed("SAINT", "st-dominic", "Saint Dominic");
    const links = await resolveRelatedLinks("SAINT", ["st-dominic", "never-published"]);
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe("Saint Dominic");
  });

  it("ignores non-string and empty entries", async () => {
    const links = await resolveRelatedLinks("SAINT", [null, 3, "  ", undefined]);
    expect(links).toEqual([]);
  });

  it("returns an empty list for a missing or non-array field", async () => {
    expect(await resolveRelatedLinks("SAINT", undefined)).toEqual([]);
    expect(await resolveRelatedLinks("SAINT", "st-dominic")).toEqual([]);
  });
});

describe("RelatedContentLinks", () => {
  it("renders titled links, never slugs", async () => {
    seed("DEVOTION", "sacred-heart", "Devotion to the Sacred Heart");
    const links = await resolveRelatedLinks("DEVOTION", ["sacred-heart"]);
    const { container } = render(<RelatedContentLinks title="Related devotions" links={links} />);
    expect(screen.getByRole("heading", { name: "Related devotions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Devotion to the Sacred Heart" })).toHaveAttribute(
      "href",
      "/devotions/sacred-heart",
    );
    expect(container.textContent).not.toContain("sacred-heart");
  });

  it("renders nothing at all when there is nothing to link to", () => {
    const { container } = render(<RelatedContentLinks title="Related devotions" links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
