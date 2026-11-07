/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

import { TitleKeeper } from "@/components/layout/TitleKeeper";

/** React's own <title>, the way it inserts one: ahead of every other. */
function reactTitle(text: string): HTMLTitleElement {
  const title = document.createElement("title");
  title.textContent = text;
  document.head.insertBefore(title, document.head.querySelector("title"));
  return title;
}

beforeEach(() => {
  document.head.innerHTML = "";
});

afterEach(() => cleanup());

describe("TitleKeeper", () => {
  it("leaves the page's own title in charge", async () => {
    reactTitle("Saints · Via Fidei");
    render(<TitleKeeper />);
    expect(document.title).toBe("Saints · Via Fidei");
    const next = reactTitle("Saints · page 2 of 53 · Via Fidei");
    expect(document.title).toBe("Saints · page 2 of 53 · Via Fidei");
    next.remove();
    expect(document.title).toBe("Saints · Via Fidei");
  });

  it("holds the last title in the moment the page's own is gone", async () => {
    const first = reactTitle("Saints · page 2 of 53 · Via Fidei");
    render(<TitleKeeper />);
    await waitFor(() =>
      expect(document.querySelector("title[itemprop]")?.textContent).not.toBe(""),
    );
    first.remove();
    // Read at once: Next's route announcer reads it in the same task.
    expect(document.title).toBe("Saints · page 2 of 53 · Via Fidei");
    reactTitle("Saints · Via Fidei");
    expect(document.title).toBe("Saints · Via Fidei");
  });

  it("follows every change of title, and never holds a blank one", async () => {
    const first = reactTitle("One");
    render(<TitleKeeper />);
    first.textContent = "Two";
    const keeper = document.querySelector("title[itemprop]");
    await waitFor(() => expect(keeper?.textContent).toBe("Two"));
    first.textContent = "";
    await new Promise((resolve) => setTimeout(resolve));
    expect(keeper?.textContent).toBe("Two");
  });

  it("carries the attribute that tells React not to adopt it", () => {
    render(<TitleKeeper />);
    expect(document.querySelector("title")).toHaveAttribute("itemprop");
  });

  it("goes away with the layout", () => {
    const { unmount } = render(<TitleKeeper />);
    unmount();
    expect(document.querySelector("title")).toBeNull();
  });
});
