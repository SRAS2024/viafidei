/**
 * @vitest-environment jsdom
 */
/**
 * The list search's field and its "Clear search". The field stays in the page while
 * the browser navigates, and clearing a search leaves focus on it, empty, rather than
 * dropping it to the top of the document with the link that was pressed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ClearSearchLink, ListSearchField } from "@/components/ui/ListSearchField";
import { ListSearch, ListSearchNoResults } from "@/components/ui/ListSearch";
import { createTranslator } from "@/lib/i18n/translator";

// A link that does what next/link does with a click: the caller's handler, then a stop.
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        props.onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

const t = createTranslator("en");

describe("ListSearchField", () => {
  it("shows the search in effect without a script having to run first", () => {
    render(<ListSearchField id="f" query="joseph" placeholder="Search saints" />);
    const field = screen.getByRole("searchbox");
    expect(field).toHaveValue("joseph");
    expect(field).toHaveAttribute("name", "q");
    expect(field).toHaveAttribute("placeholder", "Search saints");
  });

  it("stays the same field when the search changes, and shows the new search", () => {
    const { rerender } = render(<ListSearchField id="f" query="joseph" placeholder="Search" />);
    const field = screen.getByRole("searchbox");
    field.focus();
    rerender(<ListSearchField id="f" query="" placeholder="Search" />);
    expect(screen.getByRole("searchbox")).toBe(field);
    expect(field).toHaveFocus();
    expect(field).toHaveValue("");
  });

  it("leaves alone what the reader is typing when the search has not changed", () => {
    const { rerender } = render(<ListSearchField id="f" query="joseph" placeholder="Search" />);
    const field = screen.getByRole("searchbox");
    fireEvent.change(field, { target: { value: "josephine" } });
    rerender(<ListSearchField id="f" query="joseph" placeholder="Search" />);
    expect(field).toHaveValue("josephine");
  });

  /** A page's search arriving while a reader is typing the next. */
  function typeThenArrive(focused: boolean) {
    const { rerender } = render(<ListSearchField id="f" query="joseph" placeholder="Search" />);
    const field = screen.getByRole("searchbox");
    field.focus();
    fireEvent.input(field, { target: { value: "mary" } });
    if (!focused) field.blur();
    rerender(<ListSearchField id="f" query="" placeholder="Search" />);
    return { field, rerender };
  }

  it("keeps the letters a reader has typed when a new search arrives", () => {
    const { field } = typeThenArrive(true);
    expect(field).toHaveValue("mary");
    expect(field).toHaveFocus();
  });

  it("keeps them through a search the reader submitted and went on typing after", () => {
    const { rerender } = render(<ListSearchField id="f" query="" placeholder="Search" />);
    const field = screen.getByRole("searchbox");
    field.focus();
    fireEvent.input(field, { target: { value: "mary mag" } });
    rerender(<ListSearchField id="f" query="mary" placeholder="Search" />);
    expect(field).toHaveValue("mary mag");
  });

  it("writes the search in once the reader has left the field", () => {
    const { field } = typeThenArrive(false);
    expect(field).toHaveValue("");
  });

  it("writes in the next search once the last one has caught up with the typing", () => {
    const { field, rerender } = typeThenArrive(true);
    rerender(<ListSearchField id="f" query="mary" placeholder="Search" />);
    expect(field).toHaveValue("mary");
    // Back, with nothing typed since.
    rerender(<ListSearchField id="f" query="joseph" placeholder="Search" />);
    expect(field).toHaveValue("joseph");
  });
});

describe("ClearSearchLink", () => {
  function setup() {
    render(
      <>
        <input id="field" type="search" defaultValue="joseph" />
        <ClearSearchLink href="/saints" fieldId="field">
          Clear search
        </ClearSearchLink>
      </>,
    );
    return { link: screen.getByRole("link"), field: screen.getByRole("searchbox") };
  }

  it("sends focus to the field, already empty, so nothing reads the old search out", () => {
    const { link, field } = setup();
    link.focus();
    fireEvent.click(link);
    expect(field).toHaveFocus();
    expect(field).toHaveValue("");
  });

  it("stays put for a click that opens elsewhere", () => {
    const { link, field } = setup();
    link.focus();
    fireEvent.click(link, { metaKey: true });
    expect(link).toHaveFocus();
    expect(field).toHaveValue("joseph");
  });
});

describe("ListSearch", () => {
  it("aims Clear search at its own field", () => {
    render(
      <ListSearch action="/saints" query="joseph" label="Search saints" resultCount={3} t={t} />,
    );
    const field = screen.getByRole("searchbox");
    fireEvent.click(screen.getByRole("link", { name: "Clear search" }));
    expect(field).toHaveFocus();
    expect(field).toHaveValue("");
  });

  it("aims the no-results card's Clear search at the field too", () => {
    render(
      <>
        <ListSearch action="/saints" query="zzz" label="Search saints" resultCount={0} t={t} />
        <ListSearchNoResults action="/saints" query="zzz" t={t} />
      </>,
    );
    const field = screen.getByRole("searchbox");
    fireEvent.click(screen.getByRole("link", { name: "Clear search" }));
    expect(field).toHaveFocus();
  });

  it("lets a long query with no spaces wrap inside the card", () => {
    const query = "a".repeat(100);
    render(<ListSearchNoResults action="/saints" query={query} t={t} />);
    expect(screen.getByText(new RegExp(query))).toHaveClass("[overflow-wrap:anywhere]");
  });
});
