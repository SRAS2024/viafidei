/**
 * @vitest-environment jsdom
 */
/**
 * Sticky rows, in-page jumps and tall menus all measure from --header-h, so it has
 * to be the header's real height, whatever made the header that tall.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { HeaderHeight } from "@/components/layout/HeaderHeight";

function stubObserver() {
  const seen: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        seen.push({ callback, disconnect: this.disconnect });
      }
    },
  );
  return seen;
}

function page(height: number) {
  return (
    <header
      className="vf-header"
      ref={(node) => {
        if (node) node.getBoundingClientRect = () => ({ height }) as DOMRect;
      }}
    >
      <HeaderHeight />
    </header>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--header-h");
});

describe("HeaderHeight", () => {
  it("writes what the header measures to the root, each time it changes", () => {
    const observers = stubObserver();
    render(page(118));
    expect(observers).toHaveLength(1);
    observers[0].callback([], {} as ResizeObserver);
    expect(document.documentElement.style.getPropertyValue("--header-h")).toBe("118px");
  });

  it("leaves the stylesheet's value in place once it is gone", () => {
    const observers = stubObserver();
    const { unmount } = render(page(118));
    observers[0].callback([], {} as ResizeObserver);
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--header-h")).toBe("");
  });

  it("does nothing where a browser cannot observe it: the stylesheet's value stands", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(page(118));
    expect(document.documentElement.style.getPropertyValue("--header-h")).toBe("");
  });
});
