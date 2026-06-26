/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { ShareButton } from "@/components/ui/ShareButton";

afterEach(() => {
  cleanup();
  // Reset the share/clipboard shims between tests.
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
});

function defineNavigator(prop: string, value: unknown) {
  Object.defineProperty(navigator, prop, { value, configurable: true, writable: true });
}

describe("ShareButton", () => {
  it("renders the 'Share' label with the sketched share glyph to its left", () => {
    render(<ShareButton title="The Memorare" />);
    const button = screen.getByRole("button", { name: /share the memorare/i });
    expect(button).toHaveTextContent("Share");
    // The box-with-upward-arrow glyph is an inline SVG.
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("uses the native share sheet when the Web Share API is available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    defineNavigator("share", share);

    render(<ShareButton title="The Memorare" text="A prayer to Our Lady" />);
    screen.getByRole("button", { name: /share/i }).click();

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0][0];
    expect(data.title).toBe("The Memorare");
    expect(data.text).toBe("A prayer to Our Lady");
    expect(typeof data.url).toBe("string");
  });

  it("falls back to copying the link and confirms when no share API exists", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    defineNavigator("clipboard", { writeText });

    render(<ShareButton title="The Memorare" />);
    const button = screen.getByRole("button", { name: /share/i });
    button.click();

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).toHaveTextContent(/link copied/i));
  });
});
