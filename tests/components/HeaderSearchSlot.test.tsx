/**
 * @vitest-environment jsdom
 */
/**
 * The homepage has no search bar.
 *
 * The only search on "/" was the header's site search — the icon in the
 * desktop tab row and the bar pinned under the mobile header — and the owner
 * asked for it to come off the main page. Every other page keeps it. The
 * header lives in the root layout, which the App Router does not re-render
 * between pages, so the choice is made in the browser from the current path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { createTranslator } from "@/lib/i18n/translator";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en"), locale: "en" }),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({}) }));
vi.mock("@/lib/data/profile", () => ({ getProfileForUser: async () => null }));
vi.mock("@/app/_actions/auth", () => ({ logoutAction: vi.fn() }));

import { Header } from "@/components/layout/Header";
import { HeaderSearchSlot, isSearchlessPath } from "@/components/layout/HeaderSearchSlot";

beforeEach(() => {
  pathname = "/";
});
afterEach(() => cleanup());

/** The site search's collapsed icon button, one per layout (desktop + mobile). */
const searchToggles = () => screen.queryAllByRole("button", { name: "Search the site" });

describe("HeaderSearchSlot", () => {
  it("is empty on the homepage", () => {
    render(
      <HeaderSearchSlot>
        <p>search</p>
      </HeaderSearchSlot>,
    );
    expect(screen.queryByText("search")).not.toBeInTheDocument();
  });

  it.each(["/prayers", "/saints", "/search", "/parishes", "/sacraments"])(
    "keeps the search on %s",
    (path) => {
      pathname = path;
      render(
        <HeaderSearchSlot>
          <p>search</p>
        </HeaderSearchSlot>,
      );
      expect(screen.getByText("search")).toBeInTheDocument();
    },
  );

  it("treats only the root path as the homepage", () => {
    expect(isSearchlessPath("/")).toBe(true);
    expect(isSearchlessPath("/prayers")).toBe(false);
    expect(isSearchlessPath(null)).toBe(false);
  });
});

describe("Header", () => {
  it("shows no search bar on the homepage, desktop or mobile", async () => {
    render(await Header());
    expect(searchToggles()).toHaveLength(0);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    // The rest of the header is untouched.
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  });

  it("keeps the site search on every other page", async () => {
    pathname = "/prayers";
    render(await Header());
    // One toggle in the desktop row, one in the bar under the mobile header.
    expect(searchToggles()).toHaveLength(2);
  });

  it("names the site search apart from a page's own search and its button", async () => {
    // Open on /search, both landmarks were "Search", and in a list of buttons the
    // icon that opens this search could not be told from a form's submit button.
    pathname = "/search";
    render(await Header());
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
    fireEvent.click(searchToggles()[0]);
    expect(screen.getByRole("search", { name: "Search the site" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search the site" })).toBeInTheDocument();
    expect(screen.queryByRole("search", { name: "Search" })).not.toBeInTheDocument();
  });
});
