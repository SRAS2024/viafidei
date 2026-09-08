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
 *
 * It also has to be HONEST about sparse coverage. "Use my location" was never
 * broken: the API answered 200 with an empty list because the directory had no
 * records near the visitor yet. A blank list says "there are no Catholic
 * parishes near you"; the widened radius and the sentence explaining it are
 * pinned below, as is the distance line under each parish name — which appears
 * only once the visitor has actually located themselves.
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
    address: null,
    website: null,
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

/** Chicago, and a parish about half a mile due east of it. */
const HERE = { latitude: 41.88, longitude: -87.63 };
const HALF_A_MILE_EAST = { latitude: 41.88, longitude: -87.62027 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubGeolocation(lat: number, lon: number, languages?: string[]) {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: lat, longitude: lon } } as GeolocationPosition),
  );
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition }, languages });
}

/** The shape /api/parishes/near now answers with. */
function nearResponse(body: Record<string, unknown>) {
  return vi.fn(async () => ({ ok: true, json: async () => body }));
}

const cardFor = (name: string) =>
  screen.getByRole("heading", { name }).closest("article") as HTMLElement;

/**
 * The sentence under the button. It is one paragraph whose text is broken up
 * by the "Show the full directory" control, so it is read whole rather than
 * matched node by node.
 */
const explanation = () =>
  screen.getByRole("button", { name: /show the full directory/i }).closest("p") as HTMLElement;

describe("ParishLocator", () => {
  it("renders the server's page of parishes", () => {
    render(<ParishLocator parishes={PAGE} total={1030} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "A Parish",
      "B Basilica",
    ]);
    // The owner removed the designation from the parish card entirely; the raw
    // stored value was never shown and still is not.
    expect(screen.queryByText("minor-basilica")).not.toBeInTheDocument();
    expect(screen.getByText(/1,030 parishes in the directory/)).toBeInTheDocument();
  });

  it("shows no distance at all until the visitor has located themselves", () => {
    // Even a row that somehow carries a distance must not claim one: with no
    // fix from the device there is nothing to measure from.
    render(<ParishLocator parishes={[parish({ id: "x", title: "X", distanceMiles: 3 })]} />);
    expect(screen.queryByText(/away$/)).not.toBeInTheDocument();
  });

  it("fetches /api/parishes/near after geolocation and shows those parishes with distances", async () => {
    stubGeolocation(HERE.latitude, HERE.longitude, ["en-US"]);
    const fetchMock = nearResponse({
      items: [parish({ id: "near", title: "Near Parish", ...HALF_A_MILE_EAST })],
      total: 1,
      requestedRadiusMiles: 50,
      radiusMiles: 50,
      widened: false,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ParishLocator parishes={PAGE} total={1030} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Near Parish" })).toBeTruthy());
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/api/parishes/near?lat=41.88&lng=-87.63");
    expect(url).toContain("radiusMiles=50");

    // The whole directory is NOT sorted in the browser — only what the API returned.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(within(cardFor("Near Parish")).getByText("0.5 miles away")).toBeInTheDocument();
    expect(explanation()).toHaveTextContent("The parishes nearest you, within 50 miles.");
  });

  it("puts the distance directly below the parish name", async () => {
    stubGeolocation(HERE.latitude, HERE.longitude, ["en-US"]);
    vi.stubGlobal(
      "fetch",
      nearResponse({
        items: [parish({ id: "near", title: "Near Parish", ...HALF_A_MILE_EAST })],
        radiusMiles: 50,
        requestedRadiusMiles: 50,
        widened: false,
      }),
    );

    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() => expect(screen.getByText("0.5 miles away")).toBeInTheDocument());

    const heading = screen.getByRole("heading", { name: "Near Parish" });
    const away = screen.getByText("0.5 miles away");
    // DOCUMENT_POSITION_FOLLOWING: the distance comes after the name in the DOM.
    expect(heading.compareDocumentPosition(away) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("takes the unit from the DEVICE's region, not from where the coordinate falls", async () => {
    // A German phone standing in Chicago still reads metric.
    stubGeolocation(HERE.latitude, HERE.longitude, ["de-DE", "en-US"]);
    vi.stubGlobal(
      "fetch",
      nearResponse({
        items: [parish({ id: "near", title: "Near Parish", ...HALF_A_MILE_EAST })],
        radiusMiles: 50,
        requestedRadiusMiles: 50,
        widened: false,
      }),
    );

    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() => expect(screen.getByText(/metres away$/)).toBeInTheDocument());
    expect(screen.queryByText(/miles away$/)).not.toBeInTheDocument();
  });

  it("explains a widened radius instead of implying the requested one answered", async () => {
    stubGeolocation(39.7392, -104.9903, ["en-US"]);
    vi.stubGlobal(
      "fetch",
      nearResponse({
        items: [parish({ id: "far", title: "Far Parish", latitude: 41.88, longitude: -87.63 })],
        total: 1,
        requestedRadiusMiles: 50,
        radiusMiles: 500,
        widened: true,
      }),
    );

    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Far Parish" })).toBeTruthy());
    expect(explanation()).toHaveTextContent(
      "No parishes within 50 miles yet. Here are the nearest ones, within 500 miles.",
    );
  });

  it("says plainly when the results came from an unlimited search", async () => {
    stubGeolocation(39.7392, -104.9903, ["en-US"]);
    vi.stubGlobal(
      "fetch",
      nearResponse({
        items: [parish({ id: "rome", title: "Rome Parish", latitude: 41.9, longitude: 12.45 })],
        total: 1,
        requestedRadiusMiles: 50,
        radiusMiles: null,
        widened: true,
      }),
    );

    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Rome Parish" })).toBeTruthy());
    expect(explanation()).toHaveTextContent(
      "No parishes within 50 miles yet. Here are the nearest ones we have.",
    );
    // A thousands-of-miles distance drops the meaningless tenth.
    expect(within(cardFor("Rome Parish")).getByText(/^[\d,]+ miles away$/)).toBeInTheDocument();
  });

  it("never shows an empty list with no explanation", async () => {
    stubGeolocation(39.7392, -104.9903, ["en-US"]);
    vi.stubGlobal(
      "fetch",
      nearResponse({
        items: [],
        total: 0,
        requestedRadiusMiles: 50,
        radiusMiles: 50,
        widened: false,
      }),
    );

    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() =>
      expect(explanation()).toHaveTextContent("We don't have any parishes in the directory yet."),
    );
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    expect(screen.getByRole("button", { name: /show the full directory/i })).toBeInTheDocument();
  });

  it("asks the device for its best fix", () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    render(<ParishLocator parishes={PAGE} />);
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));

    const options = getCurrentPosition.mock.calls[0]![2] as PositionOptions;
    expect(options.enableHighAccuracy).toBe(true);
    // A cold GPS fix on a real phone regularly needs more than ten seconds,
    // and a stale cached fix would mislabel every distance on the page.
    expect(options.timeout).toBeGreaterThanOrEqual(15_000);
    expect(options.maximumAge).toBeLessThanOrEqual(30_000);
  });

  it("fails open when the near lookup errors — the directory page stays on screen", async () => {
    stubGeolocation(HERE.latitude, HERE.longitude);
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
