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
 * only once the visitor has actually located themselves, in the site's
 * language, metric outside English and in miles only for US English.
 *
 * And it must ASK. The owner tapped "Use my location" and was told location
 * was declined without ever seeing the iPhone's Allow sheet. Every tap now
 * calls the device from inside the tap, whatever happened before; a refusal
 * says where this platform keeps the switch and offers Try again; a slow or
 * missing fix gets one coarser retry before anything is shown.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ParishLocator } from "@/app/parishes/ParishLocator";
import { parishLocatorLabels } from "@/app/parishes/locator-labels";
import type { ParishListItem } from "@/lib/data/published";
import type { Locale } from "@/lib/i18n/locales";
import { createTranslator } from "@/lib/i18n/translator";

const LABELS = parishLocatorLabels(createTranslator("en"));

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

/** Chicago, a parish about half a mile due east of it, and one about 780 ft east. */
const HERE = { latitude: 41.88, longitude: -87.63 };
const HALF_A_MILE_EAST = { latitude: 41.88, longitude: -87.62027 };
const A_SHORT_WALK_EAST = { latitude: 41.88, longitude: -87.62713 };

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type Props = Partial<Parameters<typeof ParishLocator>[0]>;

/** The locator as /parishes renders it, with the English labels. */
function renderLocator(props: Props = {}) {
  return render(<ParishLocator parishes={PAGE} labels={LABELS} {...props} />);
}

const locateButton = () => screen.getByRole("button", { name: /use my location/i });
const tapLocate = () => fireEvent.click(locateButton());

function stubGeolocation(lat: number, lon: number, languages?: string[]) {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: lat, longitude: lon } } as GeolocationPosition),
  );
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition }, languages });
  return getCurrentPosition;
}

/** A GeolocationPositionError as a browser hands it over. */
function geoError(code: 1 | 2 | 3): GeolocationPositionError {
  return {
    code,
    message: "",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

/**
 * A device whose answers are scripted per call: each entry is what the next
 * `getCurrentPosition` does. "hang" never calls back, like a sheet left open.
 */
type Answer = 1 | 2 | 3 | "fix" | "hang";
function stubDevice(
  answers: Answer[],
  opts: { userAgent?: string; permission?: "granted" | "prompt" | "denied" | "throws" } = {},
) {
  const pending: Array<() => void> = [];
  const getCurrentPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback | null) => {
      const answer = answers.shift() ?? "hang";
      if (answer === "hang") {
        pending.push(() =>
          success({
            coords: { latitude: HERE.latitude, longitude: HERE.longitude },
          } as GeolocationPosition),
        );
        return;
      }
      if (answer === "fix") {
        success({ coords: { ...HERE } } as GeolocationPosition);
        return;
      }
      error?.(geoError(answer));
    },
  );
  const query = vi.fn(async () => {
    if (opts.permission === "throws") throw new TypeError("geolocation is not a permission name");
    return { state: opts.permission };
  });
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition },
    languages: ["en-US"],
    userAgent: opts.userAgent ?? UA.mac,
    ...(opts.permission ? { permissions: { query } } : {}),
  });
  return { getCurrentPosition, query, pending };
}

/** The shape /api/parishes/near now answers with. */
function nearResponse(body: Record<string, unknown>) {
  return vi.fn(async () => ({ ok: true, json: async () => body }));
}

/**
 * Locate from Chicago on a browser with these languages, with the API
 * answering `items` inside the requested radius.
 */
async function locateWith(
  languages: string[],
  props: { locale?: Locale; awayTemplate?: string } = {},
  items: ParishListItem[] = [parish({ id: "near", title: "Near Parish", ...HALF_A_MILE_EAST })],
) {
  stubGeolocation(HERE.latitude, HERE.longitude, languages);
  vi.stubGlobal(
    "fetch",
    nearResponse({ items, requestedRadiusMiles: 50, radiusMiles: 50, widened: false }),
  );
  renderLocator(props);
  tapLocate();
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: items[0]!.title })).toBeInTheDocument(),
  );
}

/** The props /parishes passes for a site language. */
const siteLanguage = (locale: Locale) => ({
  locale,
  awayTemplate: createTranslator(locale)("parishes.distanceAway"),
});

const cardFor = (name: string) =>
  screen.getByRole("heading", { name }).closest("article") as HTMLElement;

/**
 * The sentence under the button. It is one paragraph whose text is broken up
 * by the "Show the full directory" control, so it is read whole rather than
 * matched node by node.
 */
const explanation = () =>
  screen.getByRole("button", { name: /show the full directory/i }).closest("p") as HTMLElement;

const status = () => screen.getByRole("status");
const tryAgainButton = () => screen.queryByRole("button", { name: "Try again" });

describe("ParishLocator", () => {
  it("renders the server's page of parishes", () => {
    renderLocator({ total: 1030 });
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
    renderLocator({ parishes: [parish({ id: "x", title: "X", distanceMiles: 3 })] });
    expect(screen.queryByText(/away$/)).not.toBeInTheDocument();
  });

  it("speaks the site language on the button", () => {
    renderLocator({ labels: parishLocatorLabels(createTranslator("es")) });
    expect(screen.getByRole("button", { name: "Usar mi ubicación" })).toBeInTheDocument();
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

    renderLocator({ total: 1030 });
    tapLocate();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Near Parish" })).toBeTruthy());
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/api/parishes/near?lat=41.88&lng=-87.63");
    expect(url).toContain("radiusMiles=50");

    // The whole directory is NOT sorted in the browser — only what the API returned.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(within(cardFor("Near Parish")).getByText("0.5 mi away")).toBeInTheDocument();
    expect(explanation()).toHaveTextContent("The parishes nearest you, within 50 miles.");
  });

  it("puts the distance in that parish's card, right below its name", async () => {
    await locateWith(["en-US"], {}, [
      parish({
        id: "near",
        title: "Near Parish",
        city: "Chicago",
        state: "Illinois",
        ...HALF_A_MILE_EAST,
      }),
    ]);

    const card = cardFor("Near Parish");
    const heading = within(card).getByRole("heading", { name: "Near Parish" });
    const away = within(card).getByText("0.5 mi away");
    const place = within(card).getByText(/Chicago, Illinois/);
    // DOCUMENT_POSITION_FOLLOWING: the name, then the distance, then the rest of the card.
    expect(heading.compareDocumentPosition(away) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(away.compareDocumentPosition(place) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A small secondary line, not a second title.
    expect(away.closest("h1, h2, h3")).toBeNull();
  });

  it.each([
    // The site language picks the words; outside English it also settles the units.
    ["pt", ["en-US"], "A 800 m de distância"],
    ["es", ["es-US"], "A 800 m de distancia"],
    ["de", ["de-DE"], "800 m entfernt"],
    ["zh", ["zh-CN"], "距您800米"],
    // English reads miles only for US English; which English is the browser's.
    ["en", ["en-US", "en"], "0.5 mi away"],
    ["en", ["en-GB", "en"], "800 m away"],
    ["en", ["en-IE"], "800 m away"],
    // A German browser in Chicago reading the English page: metric, not the coordinate's miles.
    ["en", ["de-DE", "en-US"], "800 m away"],
    // The same reader on Firefox, whose list is "de, en-US, en": the appended
    // en-US is a fallback language, not the reader's region.
    ["en", ["de", "en-US", "en"], "800 m away"],
  ] as const)("on a %s page with a %j browser the line reads %j", async (site, browser, line) => {
    await locateWith([...browser], siteLanguage(site));
    expect(within(cardFor("Near Parish")).getByText(line)).toBeInTheDocument();
  });

  it("rounds a short walk to the nearest hundred feet or hundred metres", async () => {
    const walk = [parish({ id: "walk", title: "Walk Parish", ...A_SHORT_WALK_EAST })];
    await locateWith(["en-US"], siteLanguage("en"), walk);
    expect(within(cardFor("Walk Parish")).getByText("800 ft away")).toBeInTheDocument();
    cleanup();

    await locateWith(["en-GB"], siteLanguage("en"), walk);
    expect(within(cardFor("Walk Parish")).getByText("200 m away")).toBeInTheDocument();
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

    renderLocator();
    tapLocate();
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

    renderLocator();
    tapLocate();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Rome Parish" })).toBeTruthy());
    expect(explanation()).toHaveTextContent(
      "No parishes within 50 miles yet. Here are the nearest ones we have.",
    );
    // A thousands-of-miles distance drops the meaningless tenth.
    expect(within(cardFor("Rome Parish")).getByText(/^[\d,]+ mi away$/)).toBeInTheDocument();
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

    renderLocator();
    tapLocate();
    await waitFor(() =>
      expect(explanation()).toHaveTextContent("We don't have any parishes in the directory yet."),
    );
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    expect(screen.getByRole("button", { name: /show the full directory/i })).toBeInTheDocument();
  });

  it("goes back to the directory when asked", async () => {
    await locateWith(["en-US"]);
    fireEvent.click(screen.getByRole("button", { name: /show the full directory/i }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "A Parish",
      "B Basilica",
    ]);
  });

  it("asks the device for its best fix first", () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    renderLocator();
    tapLocate();

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

    renderLocator();
    tapLocate();

    await waitFor(() => expect(status()).toHaveTextContent(/couldn't load parishes near you/i));
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    // Another tap can fix a lookup that failed once.
    expect(tryAgainButton()).toBeInTheDocument();
  });

  it("shows the page's empty message when this page of the directory has no parishes", () => {
    renderLocator({ parishes: [], empty: <p>No parishes match “zzz”.</p> });
    expect(screen.getByText("No parishes match “zzz”.")).toBeInTheDocument();
    // …and "Use my location" is still there to tap.
    expect(locateButton()).toBeInTheDocument();
  });
});

describe("ParishLocator — asking the device", () => {
  it("asks inside the tap itself, before anything is awaited", () => {
    const { getCurrentPosition, query } = stubDevice(["hang"], { permission: "prompt" });
    renderLocator();
    tapLocate();
    // Synchronously: iOS shows its Allow sheet only for a request made during
    // the user's gesture, so no Permissions API round trip may come first.
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent("Finding parishes near you…");
    // The button keeps its name, so focus never lands on a renamed control.
    expect(locateButton()).toBeEnabled();
  });

  it("asks the device again on every tap, even straight after a refusal", async () => {
    const { getCurrentPosition } = stubDevice([1, 1, "hang"], { permission: "denied" });
    renderLocator();

    tapLocate();
    await waitFor(() => expect(status()).toHaveTextContent(/blocking location for this site/i));
    // The button is still there and still works: nothing was remembered.
    expect(locateButton()).toBeEnabled();
    tapLocate();
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(2));
    tapLocate();
    expect(getCurrentPosition).toHaveBeenCalledTimes(3);
  });

  it("never consults the Permissions API before asking, even when it says denied", () => {
    const { getCurrentPosition, query } = stubDevice(["hang"], { permission: "denied" });
    renderLocator();
    tapLocate();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });

  it("says the browser has the site blocked when the Permissions API says denied", async () => {
    const { query } = stubDevice([1], { permission: "denied", userAgent: UA.mac });
    renderLocator();
    tapLocate();

    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Your browser is blocking location for this site, so it couldn't ask you.",
      ),
    );
    expect(query).toHaveBeenCalledWith({ name: "geolocation" });
    expect(status()).toHaveTextContent("How to turn location on");
    expect(status()).toHaveTextContent(/location or lock icon in the address bar/);
    expect(tryAgainButton()).toBeInTheDocument();
    // The directory stays on screen.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  it.each([
    ["prompt", "a sheet the visitor turned down"],
    ["granted", "a browser that allows the site while the device itself is off"],
    ["throws", "a Permissions API that refuses the query"],
  ] as const)(
    "says the device did not share when the Permissions API says %s (%s)",
    async (permission) => {
      stubDevice([1], { permission });
      renderLocator();
      tapLocate();
      await waitFor(() =>
        expect(status()).toHaveTextContent("Your device didn't share its location."),
      );
      expect(tryAgainButton()).toBeInTheDocument();
    },
  );

  it("says the device did not share on a browser with no Permissions API", async () => {
    stubDevice([1]);
    renderLocator();
    tapLocate();
    await waitFor(() =>
      expect(status()).toHaveTextContent("Your device didn't share its location."),
    );
  });

  it.each([
    [
      "iPhone Safari",
      UA.iphoneSafari,
      [
        "Open Settings › Privacy & Security › Location Services, make sure it's on, then tap Safari Websites and choose While Using the App.",
        "In Safari, tap aA in the address bar › Website Settings › Location, and choose Ask or Allow.",
      ],
    ],
    [
      "iPhone Chrome",
      UA.iphoneChrome,
      [
        "Open Settings › Privacy & Security › Location Services, make sure it's on, then tap the browser or app you're using and choose While Using the App.",
      ],
    ],
    [
      "Android",
      UA.android,
      [
        "Tap the icon to the left of the web address › Permissions › Location, and choose Allow.",
        "Make sure Location is turned on in your phone's quick settings.",
      ],
    ],
    [
      "a desktop browser",
      UA.mac,
      [
        "Click the location or lock icon in the address bar and allow location for this site.",
        expect.stringContaining("System Settings › Privacy & Security › Location Services"),
      ],
    ],
  ])("gives %s its own steps to turn location back on", async (_name, userAgent, steps) => {
    stubDevice([1], { permission: "denied", userAgent });
    renderLocator();
    tapLocate();
    await waitFor(() => expect(within(status()).getByRole("list")).toBeInTheDocument());
    const items = within(within(status()).getByRole("list"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(items).toEqual(steps);
  });

  it("Try again asks the device afresh and keeps keyboard focus on the locate button", async () => {
    const { getCurrentPosition } = stubDevice([1, "hang"], { permission: "denied" });
    renderLocator();
    tapLocate();
    await waitFor(() => expect(tryAgainButton()).toBeInTheDocument());

    fireEvent.click(tryAgainButton()!);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(locateButton()).toHaveFocus();
    // The refusal is gone while the device is asked again.
    expect(status()).not.toHaveTextContent(/blocking location/);
    expect(tryAgainButton()).not.toBeInTheDocument();
  });

  it("retries a timeout once, coarser and more patient, before saying anything", async () => {
    const { getCurrentPosition } = stubDevice([3, "fix"]);
    vi.stubGlobal(
      "fetch",
      nearResponse({
        items: [parish({ id: "near", title: "Near Parish", ...HALF_A_MILE_EAST })],
        requestedRadiusMiles: 50,
        radiusMiles: 50,
        widened: false,
      }),
    );
    renderLocator();
    tapLocate();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Near Parish" })).toBeTruthy());
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    const first = getCurrentPosition.mock.calls[0]![2] as PositionOptions;
    const retry = getCurrentPosition.mock.calls[1]![2] as PositionOptions;
    expect(first.enableHighAccuracy).toBe(true);
    expect(retry.enableHighAccuracy).toBe(false);
    expect(retry.timeout).toBeGreaterThan(first.timeout!);
    // No error was ever shown for the first, slow attempt.
    expect(tryAgainButton()).not.toBeInTheDocument();
  });

  it("retries an unavailable position once the same way", async () => {
    const { getCurrentPosition } = stubDevice([2, "fix"]);
    vi.stubGlobal(
      "fetch",
      nearResponse({ items: [], requestedRadiusMiles: 50, radiusMiles: 50, widened: false }),
    );
    renderLocator();
    tapLocate();
    await waitFor(() => expect(explanation()).toBeInTheDocument());
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect((getCurrentPosition.mock.calls[1]![2] as PositionOptions).enableHighAccuracy).toBe(
      false,
    );
  });

  it("explains a second timeout and offers Try again — and retries only once", async () => {
    const { getCurrentPosition } = stubDevice([3, 3]);
    renderLocator();
    tapLocate();
    await waitFor(() =>
      expect(status()).toHaveTextContent("Your device took too long to find your location."),
    );
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(tryAgainButton()).toBeInTheDocument();
    // A timeout is not a refusal: no settings steps.
    expect(within(status()).queryByRole("list")).not.toBeInTheDocument();
  });

  it("explains a position that stays unavailable", async () => {
    stubDevice([2, 2]);
    renderLocator();
    tapLocate();
    await waitFor(() =>
      expect(status()).toHaveTextContent("Your device couldn't work out where you are right now."),
    );
    expect(tryAgainButton()).toBeInTheDocument();
  });

  it("treats a refusal on the retry as a refusal", async () => {
    stubDevice([3, 1], { permission: "denied" });
    renderLocator();
    tapLocate();
    await waitFor(() => expect(status()).toHaveTextContent(/blocking location for this site/));
  });

  it("survives a geolocation call that throws", async () => {
    const getCurrentPosition = vi.fn(() => {
      throw new Error("not allowed in this frame");
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    renderLocator();
    tapLocate();
    await waitFor(() =>
      expect(status()).toHaveTextContent("Your device couldn't work out where you are right now."),
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  it("drops an answer that arrives for a tap the visitor has already replaced", async () => {
    // First tap: the sheet is left open. Second tap: a refusal. Then the first
    // request finally answers — it must not overwrite what the visitor sees.
    const { pending } = stubDevice(["hang", 1], { permission: "denied" });
    const fetchMock = nearResponse({ items: [], requestedRadiusMiles: 50, radiusMiles: 50 });
    vi.stubGlobal("fetch", fetchMock);
    renderLocator();
    tapLocate();
    tapLocate();
    await waitFor(() => expect(status()).toHaveTextContent(/blocking location/));

    await act(async () => pending[0]!());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent(/blocking location/);
  });

  it("says so, without asking, on a page served over plain http", () => {
    const { getCurrentPosition } = stubDevice(["fix"]);
    vi.stubGlobal("isSecureContext", false);
    renderLocator();
    tapLocate();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent("Location only works on a secure connection.");
    // Tapping again cannot change that, so no Try again — but the button stays.
    expect(tryAgainButton()).not.toBeInTheDocument();
    expect(locateButton()).toBeInTheDocument();
  });

  it("says so on a browser with no geolocation at all", () => {
    vi.stubGlobal("navigator", { languages: ["en-US"] });
    renderLocator();
    tapLocate();
    expect(status()).toHaveTextContent("This browser can't share your location.");
    expect(tryAgainButton()).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });
});
