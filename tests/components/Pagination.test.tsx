/**
 * @vitest-environment jsdom
 */
/**
 * Server pagination (PUB-3).
 *
 * Page numbers have to be REAL URLs: the old client grid kept the page in
 * component state, so a crawler only ever saw page 1 and the browser's back
 * button lost the reader's place. These tests pin the href shape (page 1 is
 * the bare path, other params ride along) and the slice arithmetic.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { LIST_PAGE_SIZE, Pagination, pageSlice, parsePageParam } from "@/components/ui/Pagination";

afterEach(() => cleanup());

describe("parsePageParam", () => {
  it("defaults to page 1 for anything unparseable", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
    expect(parsePageParam("banana")).toBe(1);
    expect(parsePageParam("4")).toBe(4);
  });
});

describe("pageSlice", () => {
  const rows = Array.from({ length: 65 }, (_, i) => i + 1);

  it("cuts 30-item pages and reports the real total", () => {
    const first = pageSlice(rows, 1);
    expect(LIST_PAGE_SIZE).toBe(30);
    expect(first.items).toHaveLength(30);
    expect(first.items[0]).toBe(1);
    expect(first.total).toBe(65);
    expect(first.pageCount).toBe(3);

    expect(pageSlice(rows, 3).items).toEqual([61, 62, 63, 64, 65]);
  });

  it("clamps out-of-range pages instead of showing an empty grid", () => {
    // ?page=999 on a three-page list must land on the last page, not on nothing.
    expect(pageSlice(rows, 999).page).toBe(3);
    expect(pageSlice(rows, 999).items).toHaveLength(5);
    expect(pageSlice([], 1).pageCount).toBe(1);
  });
});

describe("Pagination links", () => {
  it("renders crawlable hrefs that keep the active filter", () => {
    render(
      <Pagination
        basePath="/saints"
        page={2}
        totalPages={4}
        searchParams={{ filter: "martyrs" }}
      />,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    // Page 1 is the canonical bare URL; every other page carries ?page=.
    expect(hrefs).toEqual([
      "/saints?filter=martyrs",
      "/saints?filter=martyrs&page=2",
      "/saints?filter=martyrs&page=3",
      "/saints?filter=martyrs&page=4",
    ]);
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  });

  it("renders nothing when there is a single page", () => {
    const { container } = render(<Pagination basePath="/guides" page={1} totalPages={1} />);
    expect(container).toBeEmptyDOMElement();
  });
});
