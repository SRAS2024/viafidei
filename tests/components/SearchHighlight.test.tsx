/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { SearchHighlight, SearchMetaLine, spokenLine } from "@/components/ui/SearchHighlight";

afterEach(() => cleanup());

function marks(container: HTMLElement): string[] {
  return [...container.querySelectorAll("mark")].map((m) => m.textContent ?? "");
}

describe("SearchHighlight", () => {
  it("marks the matched span, preserving the original casing", () => {
    const { container } = render(<SearchHighlight text="Anima Christi" query="ani" />);
    expect(marks(container)).toEqual(["Ani"]);
    expect(container.textContent).toBe("Anima Christi");
  });

  it("marks every occurrence", () => {
    const { container } = render(<SearchHighlight text="Mary, Mother of Mary" query="mary" />);
    expect(marks(container)).toEqual(["Mary", "Mary"]);
    expect(container.textContent).toBe("Mary, Mother of Mary");
  });

  it("leaves the text alone when nothing matches", () => {
    const { container } = render(<SearchHighlight text="Te Deum" query="rosary" />);
    expect(marks(container)).toEqual([]);
    expect(container.textContent).toBe("Te Deum");
  });

  it("treats regex metacharacters as literal text, never as a pattern", () => {
    // A query of "(" used to be able to blow up a RegExp-based highlighter.
    const { container } = render(
      <SearchHighlight text="Salve Regina (Hail Holy Queen)" query="(" />,
    );
    expect(marks(container)).toEqual(["("]);
    expect(container.textContent).toBe("Salve Regina (Hail Holy Queen)");
  });

  it("renders the plain text for an empty query", () => {
    const { container } = render(<SearchHighlight text="Te Deum" query="   " />);
    expect(marks(container)).toEqual([]);
    expect(container.textContent).toBe("Te Deum");
  });
});

describe("spokenLine", () => {
  it("turns the dots between a line's parts into commas", () => {
    expect(spokenLine("Memorial · October 7 · Ordinary Time")).toBe(
      "Memorial, October 7, Ordinary Time",
    );
  });

  it("leaves a line with no separator, and a dot inside a word, alone", () => {
    expect(spokenLine("A prayer of thanksgiving")).toBe("A prayer of thanksgiving");
    expect(spokenLine("l·l")).toBe("l·l");
  });
});

describe("SearchMetaLine", () => {
  it("gives a screen reader the whole line and hides the drawn pieces from it", () => {
    const { container } = render(
      <SearchMetaLine text="How to pray the Rosary · 8 steps" query="rosary" />,
    );
    const [spoken, drawn] = [...container.children];
    expect(spoken).toHaveClass("sr-only");
    expect(spoken.textContent).toBe("How to pray the Rosary, 8 steps");
    expect(drawn).toHaveAttribute("aria-hidden", "true");
    expect(drawn.textContent).toBe("How to pray the Rosary · 8 steps");
    expect(marks(container)).toEqual(["Rosary"]);
  });

  it("keeps a word cut by a mark whole for a screen reader", () => {
    const { container } = render(<SearchMetaLine text="Baltimore, Maryland" query="mary" />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("Baltimore, Maryland");
    expect(marks(container)).toEqual(["Mary"]);
  });

  it("draws a line with dots and no match, still without the dots for a screen reader", () => {
    const { container } = render(<SearchMetaLine text="Solemnity · March 25" query="rosary" />);
    expect(container.querySelector(".sr-only")?.textContent).toBe("Solemnity, March 25");
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "Solemnity · March 25",
    );
  });

  it("is plain text when there is nothing to cut", () => {
    const { container } = render(<SearchMetaLine text="Angelic salutation" query="rosary" />);
    expect(container.children).toHaveLength(0);
    expect(container.textContent).toBe("Angelic salutation");
  });

  it("is plain text for an empty query", () => {
    const { container } = render(<SearchMetaLine text="Angelic salutation" query="  " />);
    expect(container.children).toHaveLength(0);
  });
});
