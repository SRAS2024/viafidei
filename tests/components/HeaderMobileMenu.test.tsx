/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

vi.mock("next/navigation", () => ({
  usePathname: () => "/prayers",
}));

import { HeaderMobileMenu } from "@/components/layout/HeaderMobileMenu";

const LABELS = {
  open: "Open menu",
  close: "Close menu",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/prayers", label: "Prayers" },
  { href: "/saints", label: "Saints" },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HeaderMobileMenu", () => {
  it("renders the toggle button with the open label and aria-controls when closed", () => {
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={null}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
      />,
    );
    const toggle = screen.getByRole("button", { name: LABELS.open });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "vf-mobile-menu");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
  });

  it("opens on click, flips aria-expanded, and reveals the navigation panel", async () => {
    const user = userEvent.setup();
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={null}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
      />,
    );
    const toggle = screen.getByRole("button", { name: LABELS.open });
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName(LABELS.close);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();
  });

  it("renders one link per navItem with the matching href", async () => {
    const user = userEvent.setup();
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={null}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
      />,
    );
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const links = within(nav).getAllByRole("link");
    // exactly one link per nav entry (no extras when signInItem=null and no auth actions)
    expect(links).toHaveLength(NAV.length);
    expect(links[0]).toHaveAttribute("href", "/");
    expect(links[1]).toHaveAttribute("href", "/prayers");
    expect(links[2]).toHaveAttribute("href", "/saints");
  });

  it("marks the active route with aria-current=page", async () => {
    const user = userEvent.setup();
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={null}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
      />,
    );
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    const prayersLink = screen.getByRole("link", { name: "Prayers" });
    expect(prayersLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={null}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
      />,
    );
    const toggle = screen.getByRole("button", { name: LABELS.open });
    await user.click(toggle);
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the sign-in link below the divider when supplied", async () => {
    const user = userEvent.setup();
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={{ href: "/login", label: "Sign in" }}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
      />,
    );
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("shows the settings link when showSettings is true", async () => {
    const user = userEvent.setup();
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={null}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
        showSettings
        settingsLabel="Settings"
      />,
    );
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/profile/settings",
    );
  });

  it("renders form-button actions as submit buttons inside their own POST form", async () => {
    const user = userEvent.setup();
    render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={null}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
        authedActions={[{ type: "form-button", action: "/api/auth/logout", label: "Sign out" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(signOut.tagName).toBe("BUTTON");
    expect(signOut).toHaveAttribute("type", "submit");
    const form = signOut.closest("form");
    expect(form).toHaveAttribute("action", "/api/auth/logout");
    expect(form).toHaveAttribute("method", "post");
  });

  it("has no obvious accessibility violations in the open state", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HeaderMobileMenu
        navItems={NAV}
        signInItem={{ href: "/login", label: "Sign in" }}
        openLabel={LABELS.open}
        closeLabel={LABELS.close}
      />,
    );
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
