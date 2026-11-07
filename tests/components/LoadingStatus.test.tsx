/**
 * @vitest-environment jsdom
 */
/**
 * What a screen reader is told while a placeholder shows. In the WebKit Safari uses,
 * VoiceOver announces a live region whose words change, and nothing at all for one
 * that arrives already holding them, which is how a client navigation put this one in
 * place. So a status made in the browser starts empty and is filled a moment later; one
 * sent with the page holds its words from the first byte.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { LOADING_SPOKEN_AFTER_MS, LoadingStatus } from "@/components/ui/LoadingStatus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("a loading status sent with the page", () => {
  it("holds its words from the first byte", () => {
    expect(renderToString(<LoadingStatus>Cargando el calendario…</LoadingStatus>)).toBe(
      '<p role="status" class="sr-only">Cargando el calendario…</p>',
    );
  });

  it("keeps them, with nothing to mend, when the page is hydrated", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LoadingStatus>Loading the calendar…</LoadingStatus>);
    document.body.append(container);
    const errors = vi.spyOn(console, "error");
    await act(async () => {
      hydrateRoot(container, <LoadingStatus>Loading the calendar…</LoadingStatus>);
    });
    expect(container.querySelector('[role="status"]')).toHaveTextContent("Loading the calendar…");
    expect(errors).not.toHaveBeenCalled();
  });
});

describe("a loading status made in the browser", () => {
  it("starts empty, and says its words when the wait goes on", () => {
    vi.useFakeTimers();
    render(<LoadingStatus>Loading the calendar…</LoadingStatus>);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("sr-only");
    expect(status).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(LOADING_SPOKEN_AFTER_MS - 1));
    expect(status).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(1));
    expect(status).toHaveTextContent("Loading the calendar…");
  });

  it("is never filled across the frame it was put in, which VoiceOver would not announce", () => {
    expect(LOADING_SPOKEN_AFTER_MS).toBeGreaterThanOrEqual(100);
  });

  it("says nothing of a wait that ends first", () => {
    vi.useFakeTimers();
    const { unmount } = render(<LoadingStatus>Loading the calendar…</LoadingStatus>);
    const errors = vi.spyOn(console, "error");
    unmount();
    act(() => vi.advanceTimersByTime(LOADING_SPOKEN_AFTER_MS * 2));
    expect(errors).not.toHaveBeenCalled();
  });
});
