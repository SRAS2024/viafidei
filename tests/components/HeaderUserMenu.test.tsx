/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";

afterEach(() => cleanup());

describe("HeaderUserMenu", () => {
  it("shows a Log in link when signed out", () => {
    render(<HeaderUserMenu isAuthed={false} labels={{ login: "Log in" }} />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/profile/settings",
    );
    // Log out is the last item, just below Settings.
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("is a disclosure of a plain list, not a menu that promises arrow keys", () => {
    render(
      <HeaderUserMenu
        isAuthed
        labels={{ profile: "Profile", settings: "Settings", logout: "Log out" }}
        logoutAction={() => {}}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Profile" });
    expect(toggle).not.toHaveAttribute("aria-haspopup");

    fireEvent.click(toggle);
    const list = screen.getByRole("list", { name: "Profile" });
    // The button names what it opens, and the list says so out loud, because Safari
    // drops the role from a list with no markers.
    expect(list.id).toBeTruthy();
    expect(toggle).toHaveAttribute("aria-controls", list.id);
    expect(list).toHaveAttribute("role", "list");
    expect(list).toHaveClass("vf-menu");

    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Profile", "Settings", "Log out"]);
    expect(within(items[0]!).getByRole("link")).toHaveClass("vf-menu-item");
    expect(within(items[1]!).getByRole("link")).toHaveClass("vf-menu-item");
    const logout = within(items[2]!).getByRole("button");
    expect(logout).toHaveAttribute("type", "submit");
    expect(logout).toHaveClass("vf-menu-item");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    expect(document.querySelector('[role="menu"], [role="menuitem"]')).toBeNull();
  });

  describe("signed in, opened", () => {
    function opened() {
      render(
        <>
          <HeaderUserMenu
            isAuthed
            labels={{ profile: "Profile", settings: "Settings", logout: "Log out" }}
            logoutAction={() => {}}
          />
          <button type="button">Outside</button>
        </>,
      );
      const toggle = screen.getByRole("button", { name: "Profile" });
      fireEvent.click(toggle);
      return toggle;
    }

    it("hands focus back to the avatar when Escape closes it", () => {
      const toggle = opened();
      screen.getByRole("link", { name: "Settings" }).focus();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(toggle).toHaveFocus();
    });

    it("hands focus back from the log out button too", () => {
      const toggle = opened();
      screen.getByRole("button", { name: "Log out" }).focus();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(toggle).toHaveFocus();
    });

    it("leaves focus alone when Escape is pressed with focus elsewhere", () => {
      opened();
      const outside = screen.getByRole("button", { name: "Outside" });
      outside.focus();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(outside).toHaveFocus();
      expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    });

    it("closes when focus moves out of it", () => {
      opened();
      fireEvent.blur(screen.getByRole("link", { name: "Settings" }), {
        relatedTarget: screen.getByRole("button", { name: "Outside" }),
      });
      expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    });

    it("stays open when a press inside it moves focus to nothing, as in Safari", () => {
      opened();
      fireEvent.blur(screen.getByRole("link", { name: "Settings" }), { relatedTarget: null });
      expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    });

    it("stays open when Tab moves on through its own items", () => {
      opened();
      fireEvent.blur(screen.getByRole("link", { name: "Settings" }), {
        relatedTarget: screen.getByRole("button", { name: "Log out" }),
      });
      expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    });

    it("closes on a press outside it, and on following a link", () => {
      opened();
      fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
      expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Profile" }));
      const settings = screen.getByRole("link", { name: "Settings" });
      // jsdom follows a link by trying to load it, which it cannot do.
      settings.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(settings);
      expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    });
  });
});
