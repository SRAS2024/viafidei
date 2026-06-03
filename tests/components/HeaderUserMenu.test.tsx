/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";

afterEach(() => cleanup());

describe("HeaderUserMenu", () => {
  it("shows a Log in link when signed out", () => {
    render(<HeaderUserMenu isAuthed={false} labels={{ login: "Log in" }} />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a Profile / Settings / Log out dropdown when signed in", () => {
    render(
      <HeaderUserMenu
        isAuthed
        labels={{ profile: "Profile", settings: "Settings", logout: "Log out" }}
        logoutAction={() => {}}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Profile" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/profile/settings",
    );
    // Log out is the last item, just below Settings.
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menuitem", { name: "Settings" })).not.toBeInTheDocument();
  });
});
