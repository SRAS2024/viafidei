/**
 * @vitest-environment jsdom
 */
/**
 * The parish locator (PUB-1, client half).
 *
 * The component used to receive the ENTIRE published parish directory as
 * client props and sort it in the browser; at the directory's 200,000-record
 * goal that is tens of megabytes per visitor. It now receives one server page
 * and asks /api/parishes/near for the nearest fifty once the visitor grants
 * geolocation — and it must fail open (keep the directory) whenever that
 * lookup cannot answer.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ParishLocator } from "@/app/parishes/ParishLocator";
import type { ParishListItem } from "@/lib/data/published";

function parish(over: Partial<ParishListItem> & { id: string; title: string }): ParishListItem {
  return {
    slug: over.id,
    subtitle: "A Catholic parish",
    designation: "parish",
    location: "Somewhere",
    city: null,
    state: null,
    country: null,
    latitude: null,
    longitude: null,
    href: `/parishes/${over.id}`,
    ...over,
  };
}

const PAGE: ParishListItem[] = [
  parish({ id: "a-parish", title: "A Parish" }),
  parish({ id: "b-basilica", title: "B Basilica", designation: "minor-basilica" }),
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubGeolocation(lat: number, lon: number) {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: lat, longitude: lon } } as GeolocationPosition),
  );
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
}

describe("ParishLocator", () => {
  it("renders the server's page of parishes, labelling the designation (never the raw value)", () => {
    render(<ParishLocator parishes={PAGE} total={1030} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "A Parish",
      "B Basilica",
    ]);
    expect(screen.getByText("Minor Basilica")).toBeInTheDocument();
    expect(screen.queryByText("minor-basilica")).not.toBeInTheDocument();
    expect(screen.getByText(/1,030 parishes in the directory/)).toBeInTheDocument();
  });

  it("fetches /api/parishes/near after geolocation and shows those parishes with distances", async () => {
    stubGeolocation(41.88, -87.63);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [parish({ id: "near", title: "Near Parish", distanceMiles: 0.3 })],
        total: 1,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParishLocator parishes={PAGE} total={1030} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Near Parish" })).toBeTruthy());
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/api/parishes/near?lat=41.88&lng=-87.63");
    expect(url).toContain("radiusMiles=50");

    // The whole directory is NOT sorted in the browser — only what the API returned.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    const card = screen.getByRole("heading", { name: "Near Parish" }).closest("a")!;
    expect(within(card).getByText(/mi$/)).toBeInTheDocument();
  });

  it("fails open when the near lookup errors — the directory page stays on screen", async () => {
    stubGeolocation(41.88, -87.63);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  it("surfaces a friendly message when permission is denied, keeping the directory", () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) =>
      error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/denied/i);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });
});
