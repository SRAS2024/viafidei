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
});
