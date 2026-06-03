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
    key: "nav.group.holyPeople",
    label: "Saints & Holy People",
    items: [
      { href: "/saints", label: "Saints" },
      { href: "/popes", label: "Popes" },
    ],
  },
];

afterEach(() => {
  cleanup();
  nav.path = "/";
});

describe("HeaderNavClient (desktop dropdowns)", () => {
  it("renders top-level links and group buttons, with menus closed", () => {
    render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    const group = screen.getByRole("button", { name: /Saints & Holy People/ });
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("opens and closes the dropdown on click", () => {
    render(<HeaderNavClient entries={entries} />);
    const group = screen.getByRole("button", { name: /Saints & Holy People/ });

    fireEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Popes" })).toBeInTheDocument();

    fireEvent.click(group);
    expect(screen.queryByRole("menuitem", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("closes the dropdown when a menu item is chosen", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints & Holy People/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Saints" }));
    expect(screen.queryByRole("menuitem", { name: "Saints" })).not.toBeInTheDocument();
  });

  it("closes the dropdown on Escape", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints & Holy People/ }));
    expect(screen.getByRole("menuitem", { name: "Popes" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menuitem", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("marks a group active when one of its children is the current route", () => {
    nav.path = "/popes";
    render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("button", { name: /Saints & Holy People/ })).toHaveClass(
      "vf-nav-link-active",
    );
  });
});
