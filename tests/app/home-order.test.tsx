/**
 * @vitest-environment jsdom
 */
/**
 * The homepage's order: welcome, Begin Here with New to the Faith, the day's
 * readings and prayer and saints, the featured prayers, then the mission.
 * Roman numerals run I to IV with nothing missing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/data/published", () => ({ listFeaturedPrayers: async () => [] }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (key: string) => key }),
}));
const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
const sessionCredentialsCurrent = vi.fn();
vi.mock("@/lib/auth/user", () => ({
  sessionCredentialsCurrent: (...args: unknown[]) => sessionCredentialsCurrent(...args),
}));

import HomePage from "@/app/page";

beforeEach(() => {
  // The parts of "Today" fetch after mount; the order does not depend on them.
  globalThis.fetch = vi.fn(async () => new Response("{}", { status: 500 })) as typeof fetch;
  getSession.mockReset();
  getSession.mockResolvedValue({});
  sessionCredentialsCurrent.mockReset();
  sessionCredentialsCurrent.mockResolvedValue(true);
});
afterEach(() => cleanup());

/** The text a sighted reader sees: the screen reader's digits are not part of it. */
function numerals(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".vf-eyebrow [aria-hidden='true']")].map(
    (el) => el.textContent ?? "",
  );
}

function headings(): string[] {
  return screen
    .getAllByRole("heading")
    .map((el) => `${el.tagName.toLowerCase()} ${el.textContent}`);
}

describe("the homepage's sections", () => {
  it("run in the owner's order, with a heading structure to match", async () => {
    render(await HomePage());

    expect(headings().slice(0, 7)).toEqual([
      "h1 home.title",
      "h2 home.quickLinks.title",
      "h3 home.newcomer.title",
      expect.stringMatching(/^h2 /), // The date, once the device has been read.
      "h3 Today's Scripture Readings",
      "h3 Prayer of the Day",
      "h3 Today's Feast Day Saints",
    ]);
    const rest = headings().slice(7);
    expect(rest[0]).toBe("h2 home.featured.title");
    expect(rest.slice(-3)).toEqual([
      "h2 brand.tagline",
      "h3 home.mission.title",
      "h3 home.catholic.title",
    ]);
  });

  it("give every numeral a title of its own", async () => {
    const { container } = render(await HomePage());
    const heads = [...container.querySelectorAll(".vf-section-head")];
    expect(heads).toHaveLength(4);
    for (const head of heads) expect(head.querySelector("h2")).not.toBeNull();
  });

  it("number I to IV with nothing missing", async () => {
    const { container } = render(await HomePage());
    expect(numerals(container)).toEqual(["I.", "II.", "III.", "IV."]);
  });

  it("gives a screen reader each numeral as a digit", async () => {
    const { container } = render(await HomePage());
    expect(
      [...container.querySelectorAll(".vf-eyebrow .sr-only")].map((el) => el.textContent),
    ).toEqual(["1.", "2.", "3.", "4."]);
  });

  it("name each section for a screen reader's landmarks", async () => {
    render(await HomePage());
    const names = screen.getAllByRole("region").map((el) => el.getAttribute("aria-labelledby"));
    expect(names).toEqual([
      "home-begin-title",
      "home-today-title",
      "home-featured-title",
      "home-way-title",
    ]);
    expect(screen.getByRole("region", { name: "brand.tagline" })).toBeInTheDocument();
  });

  it("put Begin Here and New to the Faith in one section", async () => {
    render(await HomePage());
    const section = screen.getByRole("region", { name: "home.quickLinks.title" });

    expect(
      within(section).getByRole("heading", { name: "home.newcomer.title" }),
    ).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "nav.spiritualLife" })).toHaveAttribute(
      "href",
      "/spiritual-life",
    );
    const list = within(section).getByRole("list", { name: "home.quickLinks.title" });
    // Said out loud, because Safari drops the role along with the markers.
    expect(list).toHaveAttribute("role", "list");
    expect(within(list).getAllByRole("link")).toHaveLength(5);
    expect(within(list).getByRole("link", { name: "home.ql.parish" })).toHaveAttribute(
      "href",
      "/parishes",
    );
  });

  it("open with the two primary actions, filled then outlined", async () => {
    render(await HomePage());
    const explore = screen.getByRole("link", { name: "home.ctaExplore" });
    const join = screen.getByRole("link", { name: "home.ctaJoin" });

    expect(explore).toHaveClass("vf-btn-primary");
    expect(join).toHaveClass("vf-btn-ghost");
    expect(join).toHaveAttribute("href", "/register");
    expect(explore.compareDocumentPosition(join)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("do not ask a reader who is signed in to create a profile", async () => {
    getSession.mockResolvedValue({ role: "USER", userId: "u1" });
    render(await HomePage());
    expect(screen.queryByRole("link", { name: "home.ctaJoin" })).not.toBeInTheDocument();
    const profile = screen.getByRole("link", { name: "home.ctaProfile" });
    expect(profile).toHaveAttribute("href", "/profile");
    expect(profile).toHaveClass("vf-btn-ghost");
  });

  // The header says Log in for such a browser, and /profile would only send it there.
  it("do not offer a profile to a reader whose sign-in a password reset has ended", async () => {
    getSession.mockResolvedValue({ role: "USER", userId: "u1", credentialVersion: "old" });
    sessionCredentialsCurrent.mockResolvedValue(false);
    render(await HomePage());
    expect(sessionCredentialsCurrent).toHaveBeenCalledWith(
      expect.objectContaining({ credentialVersion: "old" }),
    );
    expect(screen.queryByRole("link", { name: "home.ctaProfile" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "home.ctaJoin" })).toBeInTheDocument();
  });

  it("leave the sign-in standing when the lookup itself fails, as the header does", async () => {
    getSession.mockResolvedValue({ role: "USER", userId: "u1" });
    sessionCredentialsCurrent.mockRejectedValue(new Error("connection lost"));
    render(await HomePage());
    expect(screen.getByRole("link", { name: "home.ctaProfile" })).toBeInTheDocument();
  });

  it("treat an administrator's session as no reader's profile", async () => {
    getSession.mockResolvedValue({ role: "ADMIN", userId: "a1" });
    render(await HomePage());
    expect(screen.getByRole("link", { name: "home.ctaJoin" })).toBeInTheDocument();
  });

  it("still render when the session cookie cannot be read", async () => {
    getSession.mockRejectedValue(new Error("bad seal"));
    render(await HomePage());
    expect(screen.getByRole("link", { name: "home.ctaJoin" })).toBeInTheDocument();
  });
});
