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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { LIST_PAGE_SIZE, Pagination, pageSlice, parsePageParam } from "@/components/ui/Pagination";
import { MAX_PAGE_NUMBER } from "@/lib/content-shared/list-page";
import { createTranslator } from "@/lib/i18n/translator";

const t = createTranslator("en");

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

  it("reads the first value when the parameter repeats", () => {
    expect(parsePageParam(["3", "9"])).toBe(3);
    expect(parsePageParam([])).toBe(1);
  });

  it("never lets a number through that would overflow the database's offset", () => {
    for (const huge of ["300000000000000000", "99999999999999999999", "1e400"]) {
      const page = parsePageParam(huge);
      expect(page * LIST_PAGE_SIZE).toBeLessThan(2 ** 53);
      expect(page * 100).toBeLessThan(2 ** 31);
    }
    expect(parsePageParam("99999999999999999999")).toBe(MAX_PAGE_NUMBER);
  });
});

describe("pageSlice", () => {
  const rows = Array.from({ length: 77 }, (_, i) => i + 1);

  it("cuts 36-item pages and reports the real total", () => {
    const first = pageSlice(rows, 1);
    expect(LIST_PAGE_SIZE).toBe(36);
    expect(first.items).toHaveLength(36);
    expect(first.items[0]).toBe(1);
    expect(first.total).toBe(77);
    expect(first.pageCount).toBe(3);

    expect(pageSlice(rows, 3).items).toEqual([73, 74, 75, 76, 77]);
  });

  it("fills every column layout evenly, so a full page never strands a card", () => {
    for (const columns of [2, 3, 4]) {
      expect(LIST_PAGE_SIZE % columns).toBe(0);
    }
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
        t={t}
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
    const { container } = render(<Pagination t={t} basePath="/guides" page={1} totalPages={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says its words in the reader's language", () => {
    render(<Pagination t={createTranslator("es")} basePath="/saints" page={2} totalPages={3} />);
    const nav = screen.getByRole("navigation", { name: "Paginación" });
    expect(within(nav).getByRole("link", { name: "Página 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("link", { name: /^Page / })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("keeps the name a page gives it, for telling two lists' pagers apart", () => {
    render(
      <Pagination
        t={createTranslator("es")}
        label="Páginas de apariciones"
        basePath="/our-lady"
        page={1}
        totalPages={2}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Páginas de apariciones" })).toBeInTheDocument();
  });
});

describe("turning a page", () => {
  // jsdom follows a link by trying to load it, which it cannot do.
  const stopLoading = (event: Event) => event.preventDefault();
  beforeEach(() => {
    window.history.replaceState({}, "", "/saints");
    document.addEventListener("click", stopLoading);
  });
  afterEach(() => {
    document.removeEventListener("click", stopLoading);
  });

  function List({ page }: { page: number }) {
    return (
      <main>
        <h1>Saints</h1>
        <ul role="list" aria-label="saints" className="vf-grid">
          <li>Saint Peter</li>
        </ul>
        <Pagination t={t} basePath="/saints" page={page} totalPages={3} />
      </main>
    );
  }

  /** The router's part of a page turn: the address, then the new page's props. */
  function arrive(rerender: (ui: React.ReactElement) => void, url: string, ui: React.ReactElement) {
    window.history.pushState({}, "", url);
    rerender(ui);
  }

  it("lands focus where the new items start, once the new page has committed", () => {
    const { rerender } = render(<List page={1} />);
    const link = screen.getByRole("link", { name: "Page 2" });
    link.focus();
    fireEvent.click(link);
    expect(link).toHaveFocus();

    arrive(rerender, "/saints?page=2", <List page={2} />);
    expect(screen.getByRole("list", { name: "saints" })).toHaveFocus();
  });

  it("does not leave the list focusable afterwards, or a click in it would take focus", () => {
    const { rerender } = render(<List page={1} />);
    fireEvent.click(screen.getByRole("link", { name: "Page 2" }));
    arrive(rerender, "/saints?page=2", <List page={2} />);
    const list = screen.getByRole("list", { name: "saints" });
    expect(list).toHaveAttribute("tabindex", "-1");
    list.blur();
    expect(list).not.toHaveAttribute("tabindex");
  });

  it("leaves focus alone when Back or Forward changes the page", () => {
    const { rerender } = render(<List page={2} />);
    const link = screen.getByRole("link", { name: "Page 1" });
    link.focus();
    arrive(rerender, "/saints", <List page={1} />);
    expect(link).toHaveFocus();
  });

  it("leaves focus alone for a modified click, which opens another tab", () => {
    const { rerender } = render(<List page={1} />);
    const link = screen.getByRole("link", { name: "Page 2" });
    link.focus();
    fireEvent.click(link, { metaKey: true });
    arrive(rerender, "/saints?page=2", <List page={2} />);
    expect(link).toHaveFocus();
  });

  it("does nothing for a press on the page already showing", () => {
    const { rerender } = render(<List page={1} />);
    const link = screen.getByRole("link", { name: "Page 1" });
    link.focus();
    fireEvent.click(link);
    arrive(rerender, "/saints?page=2", <List page={2} />);
    expect(link).toHaveFocus();
  });

  describe("when the page is slow to come", () => {
    function WithField({ page }: { page: number }) {
      return (
        <>
          <input aria-label="Search saints" />
          <List page={page} />
        </>
      );
    }
    const field = () => screen.getByRole("textbox", { name: "Search saints" });
    const list = () => screen.getByRole("list", { name: "saints" });

    it("leaves focus with a reader who has gone on to something else", () => {
      const { rerender } = render(<WithField page={1} />);
      const link = screen.getByRole("link", { name: "Page 2" });
      link.focus();
      fireEvent.click(link);
      field().focus();
      arrive(rerender, "/saints?page=2", <WithField page={2} />);
      expect(field()).toHaveFocus();
      expect(list()).not.toHaveAttribute("tabindex");
    });

    it("leaves focus on another link in the pager, Tabbed to while waiting", () => {
      const { rerender } = render(<WithField page={1} />);
      const link = screen.getByRole("link", { name: "Page 2" });
      link.focus();
      fireEvent.click(link);
      const next = screen.getByRole("link", { name: "Page 3" });
      next.focus();
      arrive(rerender, "/saints?page=2", <WithField page={2} />);
      expect(next).toHaveFocus();
    });

    it("still lands when the press moved no focus, as an assistive press may not", () => {
      const { rerender } = render(<WithField page={1} />);
      field().focus();
      fireEvent.click(screen.getByRole("link", { name: "Page 2" }));
      arrive(rerender, "/saints?page=2", <WithField page={2} />);
      expect(list()).toHaveFocus();
    });

    it("still lands when focus has fallen to the page, as a press does in Safari", () => {
      const { rerender } = render(<WithField page={1} />);
      const link = screen.getByRole("link", { name: "Page 2" });
      link.focus();
      fireEvent.click(link);
      link.blur();
      expect(document.body).toHaveFocus();
      arrive(rerender, "/saints?page=2", <WithField page={2} />);
      expect(list()).toHaveFocus();
    });

    it("lands on the next turn after one it left alone", () => {
      const { rerender } = render(<WithField page={1} />);
      const link = screen.getByRole("link", { name: "Page 2" });
      link.focus();
      fireEvent.click(link);
      field().focus();
      arrive(rerender, "/saints?page=2", <WithField page={2} />);
      expect(field()).toHaveFocus();

      const again = screen.getByRole("link", { name: "Page 3" });
      again.focus();
      fireEvent.click(again);
      arrive(rerender, "/saints?page=3", <WithField page={3} />);
      expect(list()).toHaveFocus();
    });
  });

  it("lands on the heading when the items stand under one", () => {
    function Sectioned({ page }: { page: number }) {
      return (
        <main>
          <section>
            <div className="vf-section-head">
              <h2>Mass and rites</h2>
            </div>
            <ul role="list" className="vf-grid">
              <li>
                <h3>The Rite of Baptism</h3>
              </li>
            </ul>
          </section>
          <Pagination t={t} basePath="/saints" page={page} totalPages={3} />
        </main>
      );
    }
    const { rerender } = render(<Sectioned page={1} />);
    fireEvent.click(screen.getByRole("link", { name: "Page 2" }));
    arrive(rerender, "/saints?page=2", <Sectioned page={2} />);
    expect(screen.getByRole("heading", { name: "Mass and rites" })).toHaveFocus();
  });

  it("with two lists on a page, lands on the list whose pager was pressed", () => {
    function Two({ first, second }: { first: number; second: number }) {
      return (
        <main>
          <ul role="list" aria-label="titles" className="vf-grid">
            <li>A title</li>
          </ul>
          <Pagination t={t} label="Titles" basePath="/our-lady" page={first} totalPages={3} />
          <ul role="list" aria-label="apparitions" className="vf-grid">
            <li>An apparition</li>
          </ul>
          <Pagination
            t={t}
            label="Apparitions"
            basePath="/our-lady"
            pageParam="apage"
            page={second}
            totalPages={3}
          />
        </main>
      );
    }
    window.history.replaceState({}, "", "/our-lady");
    const { rerender } = render(<Two first={1} second={1} />);
    const apparitions = screen.getByRole("navigation", { name: "Apparitions" });
    fireEvent.click(apparitions.querySelector('a[aria-label="Page 2"]')!);
    arrive(rerender, "/our-lady?apage=2", <Two first={1} second={2} />);
    expect(screen.getByRole("list", { name: "apparitions" })).toHaveFocus();
  });
});
