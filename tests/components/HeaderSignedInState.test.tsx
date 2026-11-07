/**
 * @vitest-environment jsdom
 */
/**
 * The header says whether the reader is signed in on every page. Going by the cookie alone,
 * a browser whose sign-in a password reset had ended still showed the avatar and its menu
 * while every page it led to answered with the log in form.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { createTranslator } from "@/lib/i18n/translator";

const { current, getProfileForUser } = vi.hoisted(() => ({
  current: vi.fn(),
  getProfileForUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/prayers",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: createTranslator("en"), locale: "en" }),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ role: "USER", userId: "u1", credentialVersion: "old" }),
}));
vi.mock("@/lib/auth/user", () => ({ sessionCredentialsCurrent: current }));
vi.mock("@/lib/data/profile", () => ({ getProfileForUser }));
vi.mock("@/app/_actions/auth", () => ({ logoutAction: vi.fn() }));

import { Header } from "@/components/layout/Header";

const loginLinks = () => screen.queryAllByRole("link", { name: "Log in" });
const accountMenus = () => document.querySelectorAll('header button[aria-controls="vf-user-menu"]');

beforeEach(() => {
  current.mockReset();
  getProfileForUser.mockReset().mockResolvedValue(null);
});
afterEach(() => cleanup());

describe("Header, for a browser holding a session cookie", () => {
  it("shows the account while the sign-in is current", async () => {
    current.mockResolvedValue(true);
    render(await Header());
    expect(current).toHaveBeenCalledWith(expect.objectContaining({ credentialVersion: "old" }));
    expect(loginLinks()).toHaveLength(0);
    expect(accountMenus()).toHaveLength(1);
    expect(getProfileForUser).toHaveBeenCalledWith("u1");
  });

  it("says log in once a password reset has ended the sign-in", async () => {
    current.mockResolvedValue(false);
    render(await Header());
    expect(loginLinks().length).toBeGreaterThan(0);
    expect(accountMenus()).toHaveLength(0);
    // Not even the account's picture is looked up for it.
    expect(getProfileForUser).not.toHaveBeenCalled();
  });

  it("leaves the sign-in standing when the lookup itself fails", async () => {
    current.mockRejectedValue(new Error("connection lost"));
    render(await Header());
    expect(loginLinks()).toHaveLength(0);
    expect(accountMenus()).toHaveLength(1);
  });
});
