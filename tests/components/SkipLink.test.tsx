/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SkipLink } from "@/components/layout/SkipLink";

describe("SkipLink", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/saints");
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(cleanup);

  function withMain() {
    render(
      <>
        <SkipLink label="Skip to content" />
        <main id="main-content">
          <button type="button">Saint Joseph</button>
        </main>
      </>,
    );
    return {
      link: screen.getByRole("link", { name: "Skip to content" }),
      main: document.getElementById("main-content")!,
    };
  }

  it("is a plain link to the main content, for a reader with no script", () => {
    const { link } = withMain();
    expect(link.getAttribute("href")).toBe("#main-content");
  });

  // Next ignores a Back onto a history entry it did not make: after one more page, Back
  // would change the address to this page's #main-content and leave that page on screen.
  it("moves the focus to the main content without the jump's history entry", () => {
    const { link, main } = withMain();
    const entries = window.history.length;
    const followed = fireEvent.click(link);
    expect(followed).toBe(false);
    expect(document.activeElement).toBe(main);
    expect(window.location.hash).toBe("");
    expect(window.history.length).toBe(entries);
    expect(main.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("leaves the main content unfocusable once the focus moves on", () => {
    const { link, main } = withMain();
    fireEvent.click(link);
    expect(main.getAttribute("tabindex")).toBe("-1");
    screen.getByRole("button", { name: "Saint Joseph" }).focus();
    expect(main.hasAttribute("tabindex")).toBe(false);
  });
});
