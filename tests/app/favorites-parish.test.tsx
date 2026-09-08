/**
 * @vitest-environment jsdom
 */
/**
 * /profile/favorites must treat a favorited PARISH exactly like a favorited
 * prayer or saint: it shows up in the list, it is counted by the Parishes
 * filter, its link goes to the parish page, and removing it calls the parish
 * save route and drops the count.
 *
 * This covers the page (which fans out to listSavedParishes and maps the rows)
 * and the browser (filter, counts, remove) together, because the bug that
 * matters — parishes missing from one of the two — is invisible from either
 * side alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const server = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  parishes: [] as Array<{ id: string; slug: string; title: string; savedAt: Date }>,
  prayers: [] as Array<{ id: string; slug: string; title: string; savedAt: Date }>,
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  usePathname: () => "/profile/favorites",
}));

// The "@/components/ui" barrel re-exports PublishedDetail, which pulls the
// Prisma client in; the page only needs PageHero here.
vi.mock("@/components/ui", () => ({
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/lib/auth", () => ({ requireUser: async () => server.user }));

vi.mock("@/lib/data/saved", () => ({
  listSavedPrayers: async () => server.prayers,
  listSavedSaints: async () => [],
  listSavedApparitions: async () => [],
  listSavedDevotions: async () => [],
  listSavedNovenas: async () => [],
  listSavedParishes: async () => server.parishes,
}));

import FavoritesPage from "@/app/profile/favorites/page";
import { FavoritesBrowser, type FavoriteItem } from "@/app/profile/favorites/FavoritesBrowser";

const PARISH_SLUG = "cathedral-basilica-of-the-immaculate-conception-denver";

const PARISH_ITEM: FavoriteItem = {
  id: "fav-parish",
  contentType: "PARISH",
  kind: "parishes",
  slug: PARISH_SLUG,
  title: "Cathedral Basilica of the Immaculate Conception",
  href: `/parishes/${PARISH_SLUG}`,
  typeLabel: "Parish",
  savedAt: "2026-02-02T00:00:00.000Z",
};

const PRAYER_ITEM: FavoriteItem = {
  id: "fav-prayer",
  contentType: "PRAYER",
  kind: "prayers",
  slug: "the-memorare",
  title: "The Memorare",
  href: "/prayers/the-memorare",
  typeLabel: "Prayer",
  savedAt: "2026-02-01T00:00:00.000Z",
};

beforeEach(() => {
  server.user = { id: "user-1" };
  server.parishes = [
    {
      id: "fav-parish",
      slug: PARISH_SLUG,
      title: "Cathedral Basilica of the Immaculate Conception",
      savedAt: new Date("2026-02-02T00:00:00.000Z"),
    },
  ];
  server.prayers = [
    {
      id: "fav-prayer",
      slug: "the-memorare",
      title: "The Memorare",
      savedAt: new Date("2026-02-01T00:00:00.000Z"),
    },
  ];
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the favorites page includes saved parishes", () => {
  it("lists a saved parish with the Parish label and a link to the parish page", async () => {
    render(await FavoritesPage());

    const heading = screen.getByRole("heading", {
      name: "Cathedral Basilica of the Immaculate Conception",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("a")).toHaveAttribute("href", `/parishes/${PARISH_SLUG}`);
    expect(screen.getByText("Parish")).toBeInTheDocument();
    // Other types still render alongside it.
    expect(screen.getByText("The Memorare")).toBeInTheDocument();
  });

  it("filters down to Parishes and counts them", async () => {
    render(await FavoritesPage());

    fireEvent.click(screen.getByRole("button", { name: "Filter favorites by type" }));
    const parishOption = screen.getByRole("option", { name: /Parishes/ });
    expect(parishOption).toHaveTextContent("1");
    fireEvent.click(parishOption);

    expect(screen.getByText("Cathedral Basilica of the Immaculate Conception")).toBeInTheDocument();
    expect(screen.queryByText("The Memorare")).not.toBeInTheDocument();
  });

  it("names parishes in the empty state so they don't read as un-favouritable", async () => {
    server.parishes = [];
    server.prayers = [];
    render(await FavoritesPage());
    expect(screen.getByText(/or parish to save it here/i)).toBeInTheDocument();
  });
});

describe("removing a favorited parish", () => {
  it("DELETEs the parish save route and drops the Parishes count to zero", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<FavoritesBrowser items={[PARISH_ITEM, PRAYER_ITEM]} />);

    const card = screen
      .getByText("Cathedral Basilica of the Immaculate Conception")
      .closest("div.vf-card") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/saved/parishes?id=${encodeURIComponent(PARISH_SLUG)}`,
      { method: "DELETE" },
    );

    await waitFor(() =>
      expect(
        screen.queryByText("Cathedral Basilica of the Immaculate Conception"),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter favorites by type" }));
    expect(screen.getByRole("option", { name: /Parishes/ })).toHaveTextContent("0");
    expect(screen.getByRole("option", { name: /^All/ })).toHaveTextContent("1");
  });
});
