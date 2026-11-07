/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { FilterChips } from "@/components/ui/FilterChips";

afterEach(() => cleanup());

describe("FilterChips", () => {
  it("stops naming a choice whose page never comes, so the trigger tells the truth", () => {
    vi.useFakeTimers();
    try {
      render(
        <FilterChips
          ariaLabel="Filter saints by category"
          activeKey="all"
          items={[
            { key: "all", label: "All", href: "/saints" },
            { key: "martyrs", label: "Martyrs", href: "/saints?filter=martyrs" },
            { key: "virgins", label: "Virgins", href: "/saints?filter=virgins" },
            { key: "popes", label: "Popes", href: "/saints?filter=popes" },
            { key: "doctors", label: "Doctors", href: "/saints?filter=doctors" },
          ]}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Filter saints by category: All" }));
      fireEvent.click(screen.getByRole("link", { name: "Martyrs" }));
      const trigger = screen.getByRole("button", { name: "Filter saints by category: Martyrs" });
      expect(trigger).toHaveFocus();
      act(() => vi.advanceTimersByTime(9_000));
      expect(trigger).toHaveAccessibleName("Filter saints by category: Martyrs");
      act(() => vi.advanceTimersByTime(2_000));
      expect(trigger).toHaveAccessibleName("Filter saints by category: All");
      expect(trigger).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders link chips with hrefs and marks the active one with aria-current (selection stays visible)", () => {
    render(
      <FilterChips
        ariaLabel="Filter prayers by category"
        activeKey="marian"
        items={[
          { key: "__all__", label: "All", href: "/prayers" },
          { key: "marian", label: "Marian", href: "/prayers?filter=marian" },
          { key: "liturgical", label: "Liturgical", href: "/prayers?filter=liturgical" },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Filter prayers by category" });
    const links = within(group).getAllByRole("link");
    // Every option is rendered (never hidden behind a dropdown), including
    // while one is selected.
    expect(links).toHaveLength(3);
    const marian = screen.getByRole("link", { name: "Marian" });
    expect(marian).toHaveAttribute("href", "/prayers?filter=marian");
    expect(marian).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it("renders button chips in client mode, reflects selection with aria-pressed, and fires onSelect", () => {
    const onSelect = vi.fn();
    render(
      <FilterChips
        ariaLabel="Filter timeline by theme"
        activeKey="all"
        onSelect={onSelect}
        items={[
          { key: "all", label: "All" },
          { key: "councils", label: "Councils" },
        ]}
      />,
    );
    const all = screen.getByRole("button", { name: "All" });
    const councils = screen.getByRole("button", { name: "Councils" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(councils).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(councils);
    expect(onSelect).toHaveBeenCalledWith("councils");
  });

  it("renders an optional trailing count inside the chip", () => {
    const onSelect = vi.fn();
    render(
      <FilterChips
        ariaLabel="Filter favorites by type"
        activeKey="ALL"
        onSelect={onSelect}
        items={[
          { key: "ALL", label: "All", count: 3 },
          { key: "PRAYER", label: "Prayers", count: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /All/ })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /Prayers/ })).toHaveTextContent("1");
  });

  it("keeps three or fewer filters as inline chips (no dropdown)", () => {
    render(
      <FilterChips
        ariaLabel="Filter rites by family"
        activeKey="all"
        items={[
          { key: "all", label: "All", href: "/rites" },
          { key: "latin", label: "Latin", href: "/rites?filter=latin" },
          { key: "eastern", label: "Eastern", href: "/rites?filter=eastern" },
        ]}
      />,
    );
    // All chips visible inline; no collapsed trigger.
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("collapses to a dropdown when there are more than three filters", () => {
    render(
      <FilterChips
        ariaLabel="Filter saints by category"
        activeKey="all"
        items={[
          { key: "all", label: "All", href: "/saints" },
          { key: "martyrs", label: "Martyrs", href: "/saints?filter=martyrs" },
          { key: "popes", label: "Popes", href: "/saints?filter=popes" },
          { key: "bishops", label: "Bishops", href: "/saints?filter=bishops" },
          { key: "virgins", label: "Virgins", href: "/saints?filter=virgins" },
        ]}
      />,
    );
    // Only the trigger button shows, and it names the choice in effect; options
    // are hidden until opened.
    const trigger = screen.getByRole("button", { name: "Filter saints by category: All" });
    expect(trigger).toHaveTextContent("Filter");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("link")).toHaveLength(0);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Plain links in a named list, which a screen reader reads as what they are.
    expect(screen.getByRole("list", { name: "Filter saints by category" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the active filter on the trigger and links its option to the reset (deselect)", () => {
    render(
      <FilterChips
        ariaLabel="Filter saints by category"
        activeKey="martyrs"
        items={[
          { key: "all", label: "All", href: "/saints" },
          { key: "martyrs", label: "Martyrs", href: "/saints?filter=martyrs" },
          { key: "popes", label: "Popes", href: "/saints?filter=popes" },
          { key: "bishops", label: "Bishops", href: "/saints?filter=bishops" },
          { key: "virgins", label: "Virgins", href: "/saints?filter=virgins" },
        ]}
      />,
    );
    // The trigger fills with the active filter (blue) and shows its label.
    const trigger = screen.getByRole("button", { name: "Filter saints by category: Martyrs" });
    expect(trigger).toHaveTextContent("Martyrs");
    expect(trigger.className).toContain("vf-filter-active");

    fireEvent.click(trigger);
    // Re-selecting the active filter deselects → its option points at the reset.
    const martyrs = screen.getByRole("link", { name: "Martyrs" });
    expect(martyrs).toHaveAttribute("href", "/saints");
    expect(martyrs).toHaveAttribute("aria-current", "page");
    // A different filter selects normally.
    expect(screen.getByRole("link", { name: "Popes" })).toHaveAttribute(
      "href",
      "/saints?filter=popes",
    );
  });

  it("client-mode dropdown: selecting fires onSelect, re-selecting the active deselects to resetKey", () => {
    const onSelect = vi.fn();
    render(
      <FilterChips
        ariaLabel="Filter favorites by type"
        activeKey="PRAYER"
        resetKey="ALL"
        onSelect={onSelect}
        items={[
          { key: "ALL", label: "All" },
          { key: "PRAYER", label: "Prayers" },
          { key: "SAINT", label: "Saints" },
          { key: "DEVOTION", label: "Devotions" },
          { key: "NOVENA", label: "Novenas" },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Filter favorites by type: Prayers" });
    expect(trigger).toHaveTextContent("Prayers");

    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Prayers" })).toHaveAttribute("aria-pressed", "true");
    // Choosing another filter selects it.
    fireEvent.click(screen.getByRole("button", { name: "Saints" }));
    expect(onSelect).toHaveBeenCalledWith("SAINT");

    // Re-open and click the active filter → deselect to the reset key.
    fireEvent.click(screen.getByRole("button", { name: "Filter favorites by type: Prayers" }));
    fireEvent.click(screen.getByRole("button", { name: "Prayers" }));
    expect(onSelect).toHaveBeenCalledWith("ALL");
  });

  describe("the dropdown's panel", () => {
    const items = [
      { key: "all", label: "All", href: "/saints" },
      { key: "martyrs", label: "Martyrs", href: "/saints?filter=martyrs" },
      { key: "popes", label: "Popes", href: "/saints?filter=popes" },
      { key: "bishops", label: "Bishops", href: "/saints?filter=bishops" },
      { key: "virgins", label: "Virgins", href: "/saints?filter=virgins" },
    ];
    const name = (label: string) => `Filter saints by category: ${label}`;

    function filter(activeKey = "all") {
      return (
        <FilterChips ariaLabel="Filter saints by category" activeKey={activeKey} items={items} />
      );
    }

    // jsdom follows a link by trying to load it, which it cannot do.
    beforeEach(() => {
      document.addEventListener("click", stopLoading);
    });
    afterEach(() => {
      document.removeEventListener("click", stopLoading);
      Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      Reflect.deleteProperty(window, "matchMedia");
    });
    function stopLoading(event: Event) {
      event.preventDefault();
    }

    it("keeps its list role, which Safari would drop with the markers", () => {
      render(filter());
      fireEvent.click(screen.getByRole("button", { name: name("All") }));
      expect(screen.getByRole("list", { name: "Filter saints by category" })).toHaveAttribute(
        "role",
        "list",
      );
    });

    it("takes its height from the window rather than a fixed one", () => {
      render(filter());
      fireEvent.click(screen.getByRole("button", { name: name("All") }));
      const panel = screen.getByRole("list", { name: "Filter saints by category" });
      expect(panel).toHaveClass("vf-filter-panel");
      expect(panel.className).not.toMatch(/max-h-/);
    });

    it("brings itself into view when opened, moving only as far as it must", async () => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        value: scrollIntoView,
        configurable: true,
      });
      render(filter());
      fireEvent.click(screen.getByRole("button", { name: name("All") }));
      // Not in the frame the panel first paints, where WebKit stops a smooth move short.
      expect(scrollIntoView).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" }),
      );
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it("does so at once under Reduce Motion, without moving smoothly", () => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        value: scrollIntoView,
        configurable: true,
      });
      Object.defineProperty(window, "matchMedia", {
        value: (query: string) => ({ matches: query.includes("reduce") }),
        configurable: true,
      });
      render(filter());
      fireEvent.click(screen.getByRole("button", { name: name("All") }));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });

    it("gives focus back to a trigger that already names the choice", () => {
      const { rerender } = render(filter());
      const trigger = screen.getByRole("button", { name: name("All") });
      const namesWhenFocused: Array<string | null> = [];
      trigger.addEventListener("focus", () => {
        namesWhenFocused.push(trigger.getAttribute("aria-label"));
      });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("link", { name: "Martyrs" }));

      // Before the new page has arrived, the name is already true.
      expect(namesWhenFocused).toEqual([name("Martyrs")]);
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveClass("vf-filter-active");

      // The same trigger, when the page arrives with the filter it asked for.
      rerender(filter("martyrs"));
      expect(screen.getByRole("button", { name: name("Martyrs") })).toBe(trigger);
      expect(trigger).toHaveFocus();
    });

    it("follows the page again after a move it did not start, such as Back", () => {
      const { rerender } = render(filter());
      fireEvent.click(screen.getByRole("button", { name: name("All") }));
      fireEvent.click(screen.getByRole("link", { name: "Martyrs" }));
      rerender(filter("martyrs"));
      rerender(filter("all"));
      expect(screen.getByRole("button", { name: name("All") })).toBeInTheDocument();
    });

    it("leaves the name alone for a modified click, which opens another tab", () => {
      render(filter());
      const trigger = screen.getByRole("button", { name: name("All") });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("link", { name: "Martyrs" }), { metaKey: true });
      expect(trigger).toHaveAttribute("aria-label", name("All"));
    });

    it("gives focus back on Escape", () => {
      render(filter());
      const trigger = screen.getByRole("button", { name: name("All") });
      fireEvent.click(trigger);
      screen.getByRole("link", { name: "Martyrs" }).focus();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(trigger).toHaveFocus();
      expect(screen.queryByRole("link", { name: "Martyrs" })).not.toBeInTheDocument();
    });

    describe("closing in a window too short for trigger and panel together", () => {
      const scrollIntoView = vi.fn();
      beforeEach(() => {
        scrollIntoView.mockClear();
        Object.defineProperty(Element.prototype, "scrollIntoView", {
          value: scrollIntoView,
          configurable: true,
        });
        // Under Reduce Motion the panel's own move has happened by the time it opens.
        Object.defineProperty(window, "matchMedia", {
          value: (query: string) => ({ matches: query.includes("reduce") }),
          configurable: true,
        });
      });

      it("brings a trigger holding focus back from under the header", () => {
        render(filter());
        const trigger = screen.getByRole("button", { name: name("All") });
        fireEvent.click(trigger);
        trigger.focus();
        scrollIntoView.mockClear();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("link", { name: "Martyrs" })).not.toBeInTheDocument();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
        expect(scrollIntoView.mock.contexts[0]).toBe(trigger);
      });

      it("leaves the page where it is when a press elsewhere closes the panel", () => {
        render(
          <>
            {filter()}
            <button type="button">Outside</button>
          </>,
        );
        const outside = screen.getByRole("button", { name: "Outside" });
        fireEvent.click(screen.getByRole("button", { name: name("All") }));
        outside.focus();
        scrollIntoView.mockClear();
        fireEvent.pointerDown(outside);
        expect(screen.queryByRole("link", { name: "Martyrs" })).not.toBeInTheDocument();
        expect(scrollIntoView).not.toHaveBeenCalled();
      });
    });

    it("stays open when a press moves focus to something around it, as in Safari", () => {
      render(filter());
      fireEvent.click(screen.getByRole("button", { name: name("All") }));
      fireEvent.focusIn(document.body);
      expect(screen.getByRole("link", { name: "Martyrs" })).toBeInTheDocument();
    });

    it("closes when focus really moves elsewhere, or a press lands outside", () => {
      render(
        <>
          {filter()}
          <button type="button">Outside</button>
        </>,
      );
      const trigger = screen.getByRole("button", { name: name("All") });
      const outside = screen.getByRole("button", { name: "Outside" });
      fireEvent.click(trigger);
      fireEvent.focusIn(outside);
      expect(screen.queryByRole("link", { name: "Martyrs" })).not.toBeInTheDocument();
      fireEvent.click(trigger);
      fireEvent.pointerDown(outside);
      expect(screen.queryByRole("link", { name: "Martyrs" })).not.toBeInTheDocument();
    });
  });
});
