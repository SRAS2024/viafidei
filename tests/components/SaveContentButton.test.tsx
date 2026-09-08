/**
 * @vitest-environment jsdom
 */
/**
 * Favouriting a PARISH, end to end from the button.
 *
 * A parish must be favouritable exactly like a prayer or a saint, and a
 * signed-out visitor who taps Favorite must get the sign-in / create-account
 * popup — not a silent no-op, and not a raw 401 string beside the button.
 *
 * The long-slug case is the one that was actually broken: the worker slugifies
 * parish names up to 80 characters, so the request body carries ids far longer
 * than any prayer or saint slug.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({
  path: "/parishes/cathedral-basilica-of-the-immaculate-conception",
}));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

const server = vi.hoisted(() => ({
  user: null as { id: string } | null,
  saved: false,
}));
vi.mock("@/lib/auth", () => ({ requireUser: async () => server.user }));
vi.mock("@/lib/data/saved", () => ({ isSaved: async () => server.saved }));

import { SaveButton } from "@/components/profile/SaveButton";
import { SAVEABLE_CONTENT, SaveContentButton } from "@/components/profile/SaveContentButton";

/** A real 80-character parish slug shape — the worker's slugify cap. */
const LONG_PARISH_SLUG =
  "katedra-polowa-wojska-polskiego-najswietszej-maryi-panny-krolowej-polski-warszaw";

let assign: ReturnType<typeof vi.fn>;
let realLocation: Location;

beforeEach(() => {
  server.user = null;
  server.saved = false;
  nav.path = "/parishes/cathedral-basilica-of-the-immaculate-conception";
  assign = vi.fn();
  // jsdom's own location.assign is "not implemented" and throws; the popup
  // deliberately uses a hard navigation, so it has to be stubbed to be observed.
  realLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...realLocation, assign },
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SaveContentButton maps PARISH like every other saveable type", () => {
  it("points PARISH at the /api/saved/parishes route and the parish saved kind", () => {
    expect(SAVEABLE_CONTENT.PARISH).toEqual({ kind: "parishes", savedKind: "parish" });
    // Every saveable type is wired the same way; parishes are not a special case.
    expect(Object.keys(SAVEABLE_CONTENT).sort()).toEqual([
      "APPARITION",
      "DEVOTION",
      "NOVENA",
      "PARISH",
      "PRAYER",
      "SAINT",
    ]);
  });

  it("renders the Favorite control for a signed-out visitor (not nothing)", async () => {
    render(await SaveContentButton({ contentType: "PARISH", slug: LONG_PARISH_SLUG }));
    const button = screen.getByRole("button", { name: "Favorite" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("shows an already-favorited parish as Favorited for a signed-in user", async () => {
    server.user = { id: "user-1" };
    server.saved = true;
    render(await SaveContentButton({ contentType: "PARISH", slug: LONG_PARISH_SLUG }));
    expect(screen.getByRole("button", { name: "Favorited" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("a signed-out tap on a parish Favorite", () => {
  it("opens the login-required popup instead of calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SaveButton
        kind="parishes"
        entityId={LONG_PARISH_SLUG}
        initiallySaved={false}
        isAuthed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("You must have an account for this action.");
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    // No request, so no 401 and no error text beside the button.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/unauthorized/i)).not.toBeInTheDocument();
  });

  it("sends the visitor back to the parish page after logging in", async () => {
    render(
      <SaveButton
        kind="parishes"
        entityId={LONG_PARISH_SLUG}
        initiallySaved={false}
        isAuthed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    fireEvent.click(await screen.findByRole("button", { name: "Log In" }));

    expect(assign).toHaveBeenCalledWith(
      "/login?next=%2Fparishes%2Fcathedral-basilica-of-the-immaculate-conception",
    );
  });

  it("offers account creation with the same return path", async () => {
    render(
      <SaveButton
        kind="parishes"
        entityId={LONG_PARISH_SLUG}
        initiallySaved={false}
        isAuthed={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create Account" }));

    expect(assign).toHaveBeenCalledWith(
      "/register?next=%2Fparishes%2Fcathedral-basilica-of-the-immaculate-conception",
    );
  });
});

describe("a signed-in tap on a parish Favorite", () => {
  it("POSTs the full slug to /api/saved/parishes and flips to Favorited", async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, text: async () => "" }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SaveButton kind="parishes" entityId={LONG_PARISH_SLUG} initiallySaved={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/saved/parishes");
    expect(init.method).toBe("POST");
    // The 80-char slug must survive untruncated — the API validates its length.
    expect(JSON.parse(String(init.body))).toEqual({ id: LONG_PARISH_SLUG });
    expect(LONG_PARISH_SLUG.length).toBe(80);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Favorited" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });

  it("unfavourites via DELETE and returns the control to Favorite", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn(
      async () => ({ ok: true, text: async () => "" }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SaveButton kind="parishes" entityId={LONG_PARISH_SLUG} initiallySaved={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Favorited" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/saved/parishes?id=${encodeURIComponent(LONG_PARISH_SLUG)}`);
    expect(init.method).toBe("DELETE");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
  });

  it("keeps the parish favorited when the removal confirm is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<SaveButton kind="parishes" entityId={LONG_PARISH_SLUG} initiallySaved={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Favorited" }));

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Favorited" })).toBeInTheDocument();
  });
});
