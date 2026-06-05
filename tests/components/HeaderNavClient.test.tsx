/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeaderNavClient, type ClientNavEntry } from "@/components/layout/HeaderNavClient";

const nav = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

const entries: ClientNavEntry[] = [
  { kind: "link", href: "/", label: "Home" },
  {
    kind: "group",
    href: "/saints",
    key: "nav.saints",
    label: "Saints",
    items: [
      { href: "/our-lady", label: "Our Lady" },
      { href: "/popes", label: "Popes" },
    ],
  },
];

afterEach(() => {
  cleanup();
  nav.path = "/";
});

describe("HeaderNavClient (parent-link dropdowns)", () => {
  it("renders a parent link plus a submenu toggle, with the menu closed", () => {
    render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    // The parent tab is itself a link to its own page…
    expect(screen.getByRole("link", { name: "Saints" })).toHaveAttribute("href", "/saints");
    // …with a separate chevron button that opens the submenu.
    const toggle = screen.getByRole("button", { name: /Saints submenu/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menuitem", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("opens and closes the dropdown on toggle click", () => {
    render(<HeaderNavClient entries={entries} />);
    const toggle = screen.getByRole("button", { name: /Saints submenu/ });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Popes" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole("menuitem", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("includes the section's own page as the first item in the dropdown", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints submenu/ }));
    // The menu opens to Saints (overview) · Our Lady · Popes.
    const overview = screen.getByRole("menuitem", { name: "Saints" });
    expect(overview).toHaveAttribute("href", "/saints");
    expect(screen.getByRole("menuitem", { name: "Our Lady" })).toHaveAttribute("href", "/our-lady");
    expect(screen.getByRole("menuitem", { name: "Popes" })).toHaveAttribute("href", "/popes");
  });

  it("opens the dropdown on hover (desktop) and closes when the pointer leaves", () => {
    const { container } = render(<HeaderNavClient entries={entries} />);
    const group = container.querySelector(".relative.inline-flex") as HTMLElement;
    fireEvent.mouseEnter(group);
    expect(screen.getByRole("menuitem", { name: "Popes" })).toBeInTheDocument();
    fireEvent.mouseLeave(group);
    expect(screen.queryByRole("menuitem", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("closes the dropdown when a menu item is chosen", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints submenu/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Our Lady" }));
    expect(screen.queryByRole("menuitem", { name: "Our Lady" })).not.toBeInTheDocument();
  });

  it("closes the dropdown on Escape", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints submenu/ }));
    expect(screen.getByRole("menuitem", { name: "Popes" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menuitem", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("marks the parent link active when it or one of its children is the current route", () => {
    nav.path = "/popes";
    render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Saints" })).toHaveClass("vf-nav-link-active");
  });
});
