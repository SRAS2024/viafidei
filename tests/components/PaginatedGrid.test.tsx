/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PaginatedGrid, pageSizeForWidth } from "@/components/ui/PaginatedGrid";

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w });
}

function items(n: number) {
  return Array.from({ length: n }, (_, i) => <div key={i}>Item {i + 1}</div>);
}

afterEach(() => cleanup());

describe("PaginatedGrid", () => {
  it("uses the responsive page sizes (mobile 10 / tablet 30 / desktop 25)", () => {
    expect(pageSizeForWidth(500)).toBe(10);
    expect(pageSizeForWidth(800)).toBe(30);
    expect(pageSizeForWidth(1280)).toBe(25);
  });

  it("mobile: shows 10 per page with numbered boxes, and paging loads the next batch", () => {
    setWidth(500);
    render(<PaginatedGrid items={items(23)} />);

    // Page 1 → items 1..10 shown, 11 not yet.
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 10")).toBeInTheDocument();
    expect(screen.queryByText("Item 11")).not.toBeInTheDocument();

    // 23 items / 10 = 3 pages.
    const boxes = screen.getAllByRole("button");
    expect(boxes.map((b) => b.textContent)).toEqual(["1", "2", "3"]);
    expect(boxes[0]).toHaveAttribute("aria-current", "page");

    // Page 2 → items 11..20.
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Item 11")).toBeInTheDocument();
    expect(screen.getByText("Item 20")).toBeInTheDocument();
    expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  });

  it("desktop: 25 per page → a single page of 23 shows no pagination", () => {
    setWidth(1280);
    render(<PaginatedGrid items={items(23)} />);
    expect(screen.getByText("Item 23")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("tablet: 30 per page", () => {
    setWidth(800);
    render(<PaginatedGrid items={items(31)} />);
    expect(screen.getByText("Item 30")).toBeInTheDocument();
    expect(screen.queryByText("Item 31")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["1", "2"]);
  });
});
