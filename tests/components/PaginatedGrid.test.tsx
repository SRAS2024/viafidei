/**
 * @vitest-environment jsdom
 */
/**
 * PaginatedGrid is now a PURE grid: pagination moved to the server (PUB-3), so
 * every list page asks the database for one page and renders crawlable
 * `?page=` links with <Pagination> beneath the grid. The old client version
 * received every published row, sliced it in the browser, and kept the page in
 * component state — so a crawler only ever saw page 1 and the first paint
 * showed 10 cards before re-flowing to 25.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PaginatedGrid } from "@/components/ui/PaginatedGrid";

function items(n: number) {
  return Array.from({ length: n }, (_, i) => <div key={i}>Item {i + 1}</div>);
}

afterEach(() => cleanup());

describe("PaginatedGrid", () => {
  it("renders exactly the items it is given — the server decided the page", () => {
    render(<PaginatedGrid items={items(30)} />);
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 30")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(30);
  });

  it("holds no page state of its own — no pagination buttons are rendered", () => {
    render(<PaginatedGrid items={items(120)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // Nothing is hidden client-side: all 120 given items are in the document.
    expect(screen.getAllByRole("listitem")).toHaveLength(120);
  });

  it("renders an empty grid without crashing", () => {
    render(<PaginatedGrid items={[]} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
