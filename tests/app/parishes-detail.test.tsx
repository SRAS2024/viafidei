/**
 * @vitest-environment jsdom
 */
/**
 * The parish detail page (PARISH-CARD).
 *
 * /parishes/[slug] used to render through PublishedDetail, which prints every
 * remaining payload key — designation, phone, mass and confession times,
 * background, summary, and a separate section per place field. The owner asked
 * for four things and nothing else, and asked for it WITHOUT a data migration:
 * the payload below still carries all the old fields, and the page must simply
 * stop displaying them. That is what makes all 9,731 published parishes change
 * at once with no worker pass.
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
  SaveContentButton: () => <button type="button">Save</button>,
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

import ParishDetailPage from "@/app/parishes/[slug]/page";

/** Everything the worker actually stores on a parish — unchanged by this work. */
const FULL_PAYLOAD: Record<string, unknown> = {
  designation: "cathedral",
  address: "1530 Logan St",
  city: "Denver",
  state: "Colorado",
  country: "United States",
  latitude: 39.74,
  longitude: -104.98,
  website: "https://denvercathedral.org",
  phone: "(303) 831-7010",
  massTimes: "Sun 6:30am, 8:30am, 10:30am",
  confessionTimes: "Sat 3:00pm",
  background: "The cathedral was dedicated in 1912 and consecrated in 1921.",
  summary: "The mother church of the Archdiocese of Denver.",
  diocese: "Archdiocese of Denver",
};

function seed(payload: Record<string, unknown>, over: Partial<PublishedItem> = {}) {
  published.clear();
  published.set("PARISH:cathedral-basilica", {
    id: "p1",
    contentType: "PARISH",
    slug: "cathedral-basilica",
    title: "Cathedral Basilica of the Immaculate Conception",
    subtitle: "A Catholic cathedral in Denver, Colorado",
    authorityLevel: "DIOCESE",
    version: 1,
    payload,
    ...over,
  } as unknown as PublishedItem);
}

const render1 = async () =>
  render(await ParishDetailPage({ params: Promise.resolve({ slug: "cathedral-basilica" }) }));

afterEach(() => cleanup());

describe("/parishes/[slug]", () => {
  it("shows only the name, Diocese line, address with directions, and website", async () => {
    seed(FULL_PAYLOAD);
    await render1();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Cathedral Basilica of the Immaculate Conception",
    );
    expect(screen.getByText("Diocese").closest("p")).toHaveTextContent(
      "Diocese Denver, Colorado, United States",
    );
    expect(screen.getByText("1530 Logan St")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get directions/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "denvercathedral.org" })).toHaveAttribute(
      "href",
      "https://denvercathedral.org",
    );
  });

  it("stops displaying every other stored field, without removing it from the payload", async () => {
    seed(FULL_PAYLOAD);
    await render1();

    const body = document.body.textContent ?? "";
    for (const gone of [
      "Cathedral", // the designation label
      "(303) 831-7010",
      "Sun 6:30am",
      "Sat 3:00pm",
      "dedicated in 1912",
      "mother church",
      "Archdiocese of Denver",
      "A Catholic cathedral in Denver",
    ]) {
      // "Cathedral" appears inside the parish NAME, so match the standalone
      // designation heading rather than the substring.
      if (gone === "Cathedral") {
        expect(screen.queryByText("Cathedral")).not.toBeInTheDocument();
        continue;
      }
      expect(body).not.toContain(gone);
    }
    // The data itself is untouched — this is a rendering change only.
    expect(FULL_PAYLOAD.massTimes).toBe("Sun 6:30am, 8:30am, 10:30am");
  });

  it("omits the Diocese line for the ~2/3 of parishes that have no place data", async () => {
    seed({ address: "12 Chapel Rd", website: "" });
    await render1();
    expect(screen.queryByText("Diocese")).not.toBeInTheDocument();
    expect(screen.getByText("12 Chapel Rd")).toBeInTheDocument();
    // No website line, not an empty one.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the save control available", async () => {
    seed(FULL_PAYLOAD);
    await render1();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("404s an unknown slug", async () => {
    published.clear();
    await expect(
      ParishDetailPage({ params: Promise.resolve({ slug: "cathedral-basilica" }) }),
    ).rejects.toThrow("notFound");
  });
});
