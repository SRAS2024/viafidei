/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { FilterChips } from "@/components/ui/FilterChips";

afterEach(() => cleanup());

describe("FilterChips", () => {
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
    expect(screen.queryByRole("listbox")).toBeNull();
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
    // Only the trigger button shows; options are hidden until opened.
    const trigger = screen.getByRole("button", { name: "Filter saints by category" });
    expect(trigger).toHaveTextContent("Filter");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(5);
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
    const trigger = screen.getByRole("button", { name: "Filter saints by category" });
    expect(trigger).toHaveTextContent("Martyrs");
    expect(trigger.className).toContain("vf-filter-active");

    fireEvent.click(trigger);
    // Re-selecting the active filter deselects → its option points at the reset.
    const martyrs = screen.getByRole("option", { name: "Martyrs" });
    expect(martyrs).toHaveAttribute("href", "/saints");
    expect(martyrs).toHaveAttribute("aria-selected", "true");
    // A different filter selects normally.
    expect(screen.getByRole("option", { name: "Popes" })).toHaveAttribute(
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
    const trigger = screen.getByRole("button", { name: "Filter favorites by type" });
    expect(trigger).toHaveTextContent("Prayers");

    fireEvent.click(trigger);
    // Choosing another filter selects it.
    fireEvent.click(screen.getByRole("option", { name: "Saints" }));
    expect(onSelect).toHaveBeenCalledWith("SAINT");

    // Re-open and click the active filter → deselect to the reset key.
    fireEvent.click(screen.getByRole("button", { name: "Filter favorites by type" }));
    fireEvent.click(screen.getByRole("option", { name: "Prayers" }));
    expect(onSelect).toHaveBeenCalledWith("ALL");
  });
});
