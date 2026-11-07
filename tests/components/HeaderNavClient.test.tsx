/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeaderNavClient, type ClientNavEntry } from "@/components/layout/HeaderNavClient";
import { NavSection } from "@/components/layout/NavSection";

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
    expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("opens and closes the dropdown on toggle click", () => {
    render(<HeaderNavClient entries={entries} />);
    const toggle = screen.getByRole("button", { name: /Saints submenu/ });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Popes" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("includes the section's own page as the first item in the dropdown", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints submenu/ }));
    // The menu opens to Saints (overview) · Our Lady · Popes.
    const [, overview] = screen.getAllByRole("link", { name: "Saints" });
    expect(overview).toHaveAttribute("href", "/saints");
    expect(screen.getByRole("link", { name: "Our Lady" })).toHaveAttribute("href", "/our-lady");
    expect(screen.getByRole("link", { name: "Popes" })).toHaveAttribute("href", "/popes");
  });

  it("opens the dropdown on hover (desktop) and closes when the pointer leaves", () => {
    const { container } = render(<HeaderNavClient entries={entries} />);
    const group = container.querySelector(".relative.inline-flex") as HTMLElement;
    fireEvent.mouseEnter(group);
    expect(screen.getByRole("link", { name: "Popes" })).toBeInTheDocument();
    fireEvent.mouseLeave(group);
    expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("closes the dropdown when a menu item is chosen", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints submenu/ }));
    fireEvent.click(screen.getByRole("link", { name: "Our Lady" }));
    expect(screen.queryByRole("link", { name: "Our Lady" })).not.toBeInTheDocument();
  });

  it("closes the dropdown on Escape", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.click(screen.getByRole("button", { name: /Saints submenu/ }));
    expect(screen.getByRole("link", { name: "Popes" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("does not open on focus alone, so moving along the tabs stays short", () => {
    render(<HeaderNavClient entries={entries} />);
    fireEvent.focus(screen.getByRole("link", { name: "Saints" }));
    fireEvent.focus(screen.getByRole("button", { name: /Saints submenu/ }));
    expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
  });

  it("hands focus back to the chevron when Escape closes the menu", () => {
    render(<HeaderNavClient entries={entries} />);
    const toggle = screen.getByRole("button", { name: /Saints submenu/ });
    fireEvent.click(toggle);
    screen.getByRole("link", { name: "Popes" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("names the list it controls", () => {
    render(<HeaderNavClient entries={entries} />);
    const toggle = screen.getByRole("button", { name: /Saints submenu/ });
    fireEvent.click(toggle);
    const list = screen.getByRole("list", { name: "Saints" });
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toContainElement(list);
  });

  it("marks the parent link active when it or one of its children is the current route", () => {
    nav.path = "/popes";
    render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Saints" })).toHaveClass("vf-nav-link-active");
  });

  it("calls only the page itself the current page; a page under it is in its section", () => {
    nav.path = "/saints";
    const { unmount } = render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Saints" })).toHaveAttribute("aria-current", "page");
    unmount();
    nav.path = "/saints/saint-joseph";
    render(<HeaderNavClient entries={entries} />);
    const tab = screen.getByRole("link", { name: "Saints" });
    expect(tab).toHaveAttribute("aria-current", "true");
    expect(tab).toHaveClass("vf-nav-link-active");
  });

  it("tells a screen reader which tab is lit, on a page under one of its menu's entries", () => {
    nav.path = "/popes";
    const { unmount } = render(<HeaderNavClient entries={entries} />);
    const tab = screen.getByRole("link", { name: "Saints" });
    expect(tab).toHaveClass("vf-nav-link-active");
    expect(tab).toHaveAttribute("aria-current", "true");
    unmount();
    nav.path = "/popes/pope-leo-xiv";
    render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Saints" })).toHaveAttribute("aria-current", "true");
  });

  it("tells a screen reader which tab a page has claimed for itself", () => {
    nav.path = "/liturgy-history/ad-gentes";
    render(
      <>
        <HeaderNavClient entries={entries} />
        <NavSection href="/popes" />
      </>,
    );
    expect(screen.getByRole("link", { name: "Saints" })).toHaveAttribute("aria-current", "true");
  });

  it("marks no tab on a page outside all of them", () => {
    nav.path = "/login";
    render(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Saints" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("lights the tab a page claims for itself, where its address cannot say", () => {
    nav.path = "/liturgy-history/ad-gentes";
    const { rerender } = render(
      <>
        <HeaderNavClient entries={entries} />
        <NavSection href="/popes" />
      </>,
    );
    expect(screen.getByRole("link", { name: "Saints" })).toHaveClass("vf-nav-link-active");
    // The claim ends with the page.
    rerender(<HeaderNavClient entries={entries} />);
    expect(screen.getByRole("link", { name: "Saints" })).not.toHaveClass("vf-nav-link-active");
  });

  describe("the pointer and the chevron", () => {
    function hoverable() {
      const { container } = render(<HeaderNavClient entries={entries} />);
      return {
        group: container.querySelector(".relative.inline-flex") as HTMLElement,
        toggle: screen.getByRole("button", { name: /Saints submenu/ }),
      };
    }

    /** A mouse counts its clicks, where the keyboard and a screen reader's press do not. */
    const click = (element: HTMLElement) => fireEvent.click(element, { detail: 1 });

    it("keeps open, on the first click, a menu the same pointer has just opened", () => {
      const { group, toggle } = hoverable();
      fireEvent.mouseEnter(group);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      // The second click is the one that means close.
      click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    it("leaves open, when the pointer goes, a menu the chevron kept", () => {
      const { group, toggle } = hoverable();
      fireEvent.mouseEnter(group);
      click(toggle);
      fireEvent.mouseLeave(group);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    it("closes, on a press from the keyboard, the menu its reader has just heard is open", () => {
      const { group, toggle } = hoverable();
      fireEvent.mouseEnter(group);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    it("takes a tap on a touch screen, which reports a hover first, as a press alone", () => {
      Object.defineProperty(window, "matchMedia", {
        value: (query: string) => ({ matches: query === "(hover: none)" }),
        configurable: true,
      });
      try {
        const { group, toggle } = hoverable();
        fireEvent.mouseEnter(group);
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        fireEvent.mouseEnter(group);
        click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "false");
      } finally {
        Reflect.deleteProperty(window, "matchMedia");
      }
    });

    it("does not let a passing pointer close a menu opened from the keyboard", () => {
      const { group, toggle } = hoverable();
      fireEvent.click(toggle);
      fireEvent.mouseEnter(group);
      fireEvent.mouseLeave(group);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    describe("passing over another tab", () => {
      const twoMenus: ClientNavEntry[] = [
        ...entries,
        {
          kind: "group",
          href: "/prayers",
          key: "nav.prayers",
          label: "Prayers",
          items: [{ href: "/litanies", label: "Litanies" }],
        },
      ];

      function tabs() {
        const { container } = render(<HeaderNavClient entries={twoMenus} />);
        const [saints, prayers] = Array.from(
          container.querySelectorAll<HTMLElement>(".relative.inline-flex"),
        );
        return {
          saints: saints!,
          prayers: prayers!,
          saintsToggle: screen.getByRole("button", { name: /Saints submenu/ }),
          prayersToggle: screen.getByRole("button", { name: /Prayers submenu/ }),
        };
      }

      it("leaves a menu opened from the keyboard, and focus on a link in it", () => {
        const { prayers, saintsToggle, prayersToggle } = tabs();
        fireEvent.click(saintsToggle);
        const link = screen.getByRole("link", { name: "Popes" });
        link.focus();
        fireEvent.mouseEnter(prayers);
        expect(saintsToggle).toHaveAttribute("aria-expanded", "true");
        expect(prayersToggle).toHaveAttribute("aria-expanded", "false");
        expect(link).toHaveFocus();
        fireEvent.mouseLeave(prayers);
        expect(saintsToggle).toHaveAttribute("aria-expanded", "true");
        expect(link).toHaveFocus();
      });

      it("leaves a menu opened from the keyboard with focus still on its chevron", () => {
        const { prayers, saintsToggle, prayersToggle } = tabs();
        saintsToggle.focus();
        fireEvent.click(saintsToggle);
        fireEvent.mouseEnter(prayers);
        expect(saintsToggle).toHaveAttribute("aria-expanded", "true");
        expect(prayersToggle).toHaveAttribute("aria-expanded", "false");
      });

      it("leaves a menu that hovering opened once focus is inside it", () => {
        const { saints, prayers, saintsToggle, prayersToggle } = tabs();
        fireEvent.mouseEnter(saints);
        const link = screen.getByRole("link", { name: "Popes" });
        link.focus();
        fireEvent.mouseLeave(saints);
        expect(saintsToggle).toHaveAttribute("aria-expanded", "true");
        fireEvent.mouseEnter(prayers);
        expect(prayersToggle).toHaveAttribute("aria-expanded", "false");
        expect(link).toHaveFocus();
      });

      it("moves on from a menu that was only hovered, or clicked, as a menu bar does", () => {
        const { saints, prayers, saintsToggle, prayersToggle } = tabs();
        fireEvent.mouseEnter(saints);
        fireEvent.mouseEnter(prayers);
        expect(saintsToggle).toHaveAttribute("aria-expanded", "false");
        expect(prayersToggle).toHaveAttribute("aria-expanded", "true");
        fireEvent.mouseLeave(prayers);
        expect(prayersToggle).toHaveAttribute("aria-expanded", "false");

        click(saintsToggle);
        fireEvent.mouseEnter(prayers);
        expect(saintsToggle).toHaveAttribute("aria-expanded", "false");
        expect(prayersToggle).toHaveAttribute("aria-expanded", "true");
      });

      it("opens menus again once a menu opened from the keyboard is dismissed", () => {
        const { prayers, saintsToggle, prayersToggle } = tabs();
        fireEvent.click(saintsToggle);
        fireEvent.mouseEnter(prayers);
        expect(prayersToggle).toHaveAttribute("aria-expanded", "false");
        fireEvent.keyDown(document, { key: "Escape" });
        fireEvent.mouseLeave(prayers);
        fireEvent.mouseEnter(prayers);
        expect(prayersToggle).toHaveAttribute("aria-expanded", "true");
      });
    });
  });

  describe("focus leaving the menu", () => {
    function opened() {
      render(
        <>
          <HeaderNavClient entries={entries} />
          <button type="button">Outside</button>
        </>,
      );
      const toggle = screen.getByRole("button", { name: /Saints submenu/ });
      fireEvent.click(toggle);
      return toggle;
    }

    it("stays open when a press moves focus to nothing, as a press on a link does in Safari", () => {
      const toggle = opened();
      fireEvent.blur(toggle, { relatedTarget: null });
      expect(screen.getByRole("link", { name: "Popes" })).toBeInTheDocument();
    });

    it("stays open when a press moves focus to something around the menu", () => {
      const toggle = opened();
      fireEvent.blur(toggle, { relatedTarget: document.body });
      expect(screen.getByRole("link", { name: "Popes" })).toBeInTheDocument();
    });

    it("closes when focus really goes elsewhere", () => {
      const toggle = opened();
      fireEvent.blur(toggle, { relatedTarget: screen.getByRole("button", { name: "Outside" }) });
      expect(screen.queryByRole("link", { name: "Popes" })).not.toBeInTheDocument();
    });
  });
});
