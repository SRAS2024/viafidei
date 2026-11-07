/**
 * @vitest-environment jsdom
 */
/**
 * The church detail page (PARISH-CARD) — parishes, cathedrals, basilicas,
 * shrines and chapels.
 *
 * The owner asked for the name, then what the church is ("Minor Basilica" —
 * always minor or major for a basilica), then its address, "and that is it",
 * WITHOUT a data migration: the payload below still carries every old field
 * (phone, Mass and confession times, website, background, summary, diocese)
 * and the page simply does not display them. That is what makes every
 * published parish change at once with no worker pass.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
  postalCode: "80203",
  city: "Denver",
  state: "Colorado",
  country: "United States",
  countryCode: "US",
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
  it("shows the name, what the church is, and its full address with directions", async () => {
    seed(FULL_PAYLOAD);
    await render1();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Cathedral Basilica of the Immaculate Conception",
    );
    expect(screen.getByText("Cathedral")).toBeInTheDocument();
    const lines = Array.from(document.querySelectorAll("address span")).map((s) => s.textContent);
    expect(lines).toEqual(["1530 Logan St", "Denver, Colorado 80203", "United States"]);
    expect(screen.getByRole("button", { name: /get directions/i })).toBeInTheDocument();
  });

  it("stops displaying every other stored field, without removing it from the payload", async () => {
    seed(FULL_PAYLOAD);
    await render1();

    const body = document.body.textContent ?? "";
    for (const gone of [
      "Diocese",
      "denvercathedral.org",
      "(303) 831-7010",
      "Sun 6:30am",
      "Sat 3:00pm",
      "dedicated in 1912",
      "mother church",
      "A Catholic cathedral in Denver",
    ]) {
      expect(body, gone).not.toContain(gone);
    }
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    // The data itself is untouched — this is a rendering change only.
    expect(FULL_PAYLOAD.massTimes).toBe("Sun 6:30am, 8:30am, 10:30am");
  });

  it("states minor or major for a basilica", async () => {
    seed({ ...FULL_PAYLOAD, designation: "major-basilica" });
    await render1();
    expect(screen.getByText("Major Basilica")).toBeInTheDocument();
  });

  it("degrades to what the record has: a street alone, no postal code, no designation", async () => {
    seed({ address: "12 Chapel Rd", website: "" });
    await render1();
    const lines = Array.from(document.querySelectorAll("address span")).map((s) => s.textContent);
    expect(lines).toEqual(["12 Chapel Rd"]);
    expect(screen.queryByText("Parish")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the save control available", async () => {
    seed(FULL_PAYLOAD);
    await render1();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("sits on the reading page's column, with directions, share and save in one row", async () => {
    seed(FULL_PAYLOAD);
    await render1();
    expect(document.querySelector("article")).toHaveClass("vf-detail");
    const actions = document.querySelector(".vf-detail-actions") as HTMLElement;
    const names = within(actions)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual([
      "Get directions to Cathedral Basilica of the Immaculate Conception",
      "Share Cathedral Basilica of the Immaculate Conception",
      "Save",
    ]);
  });

  it("404s an unknown slug", async () => {
    published.clear();
    await expect(
      ParishDetailPage({ params: Promise.resolve({ slug: "cathedral-basilica" }) }),
    ).rejects.toThrow("notFound");
  });
});
