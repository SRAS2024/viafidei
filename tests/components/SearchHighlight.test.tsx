/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { SearchHighlight } from "@/components/ui/SearchHighlight";

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
