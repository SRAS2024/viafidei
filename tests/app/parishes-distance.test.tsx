/**
 * @vitest-environment jsdom
 */
/**
 * /parishes hands the locator the site language (the `vf_locale` cookie, else
 * Accept-Language) and that language's "{distance} away" phrase. Without both,
 * the near-me line under each parish name would fall back to English and to
 * the browser's region alone, and a Portuguese page on a US phone would read
 * "0.5 mi away" instead of "A 800 m de distância".
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { ParishListItem } from "@/lib/data/published";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const NEAR: ParishListItem = {
  id: "near",
  slug: "near",
  title: "Near Parish",
  subtitle: "A Catholic parish",
  designation: "parish",
  location: "",
  address: null,
  website: null,
  city: null,
  state: null,
  country: null,
  // About half a mile due east of the visitor below.
  latitude: 41.88,
  longitude: -87.62027,
  href: "/parishes/near",
};

vi.mock("@/lib/data/published", () => ({
  listParishPage: async () => ({ items: [NEAR], total: 1, page: 1, pageSize: 30, pageCount: 1 }),
  countPublishedBySubtype: async () => ({ parish: 1 }),
}));

let siteLocale: Locale = "en";
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator(siteLocale), locale: siteLocale }),
}));

import ParishesPage from "@/app/parishes/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  siteLocale = "en";
});

/** A browser in Chicago with these languages, and the near API answering NEAR. */
function stubBrowser(languages: string[]) {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: 41.88, longitude: -87.63 } } as GeolocationPosition),
  );
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition }, languages });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [NEAR],
        requestedRadiusMiles: 50,
        radiusMiles: 50,
        widened: false,
      }),
    })),
  );
}

describe("/parishes near-me distance line", () => {
  it.each([
    ["pt", ["en-US"], "A 800 m de distância"],
    ["ko", ["ko-KR"], "800m 거리"],
    ["en", ["en-US"], "0.5 mi away"],
    ["en", ["en-GB"], "800 m away"],
  ] as const)("a %s page on a %j browser reads %j", async (locale, browser, line) => {
    siteLocale = locale;
    stubBrowser([...browser]);

    render(await ParishesPage({ searchParams: Promise.resolve({}) }));
    // No location yet: the directory claims no distance.
    expect(screen.queryByText(line)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() => expect(screen.getByText(line)).toBeInTheDocument());
    const card = screen.getByRole("heading", { name: "Near Parish" }).closest("article")!;
    expect(within(card as HTMLElement).getByText(line)).toBeInTheDocument();
  });
});
