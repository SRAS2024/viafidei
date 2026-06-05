/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { ParishLocator, type ParishCard } from "@/app/parishes/ParishLocator";

const PARISHES: ParishCard[] = [
  {
    id: "far",
    slug: "far-parish",
    title: "Far Parish",
    designationLabel: "Parish",
    location: "Los Angeles, CA",
    latitude: 34.0522,
    longitude: -118.2437,
  },
  {
    id: "near",
    slug: "near-parish",
    title: "Near Parish",
    designationLabel: "Cathedral",
    location: "New York, NY",
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    id: "nogeo",
    slug: "no-geo-parish",
    title: "No Geo Parish",
    designationLabel: "Shrine",
    location: "Unknown",
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ParishLocator", () => {
  it("lists every parish in original order before locating", () => {
    render(<ParishLocator parishes={PARISHES} />);
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["Far Parish", "Near Parish", "No Geo Parish"]);
  });

  it("sorts geocoded parishes nearest-first and shows the distance when location is granted", () => {
    // Geolocate the user in New York → Near Parish should come first.
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: 40.713, longitude: -74.006 } } as GeolocationPosition),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    render(<ParishLocator parishes={PARISHES} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));

    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    // Nearest geocoded first, the un-geocoded parish last.
    expect(titles[0]).toBe("Near Parish");
    expect(titles[2]).toBe("No Geo Parish");

    // The nearest card shows a small distance; the far one a large one.
    const near = screen.getByRole("heading", { name: "Near Parish" }).closest("a")!;
    expect(within(near).getByText(/mi$/)).toBeInTheDocument();
  });

  it("surfaces a friendly message when permission is denied", () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) =>
      error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    render(<ParishLocator parishes={PARISHES} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/denied/i);
    // The full directory is still shown.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  });
});
