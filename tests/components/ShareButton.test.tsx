/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { ShareButton, ShareLabelsProvider } from "@/components/ui/ShareButton";

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

  it("shares ONLY the url + title (never text) so iOS sends just the rich link card", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    defineNavigator("share", share);

    render(<ShareButton title="The Memorare" text="A prayer to Our Lady" />);
    screen.getByRole("button", { name: /share/i }).click();

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0][0];
    expect(data.title).toBe("The Memorare");
    expect(typeof data.url).toBe("string");
    // `text` must NOT be shared: iOS Messages renders it as a separate bubble on
    // top of the Open Graph link preview. Omitting it leaves only the link card.
    expect(data.text).toBeUndefined();
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

  describe("for a reader who cannot see the button", () => {
    it("keeps a status region on the page from the start, so that a change is announced", () => {
      render(<ShareButton title="The Memorare" />);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("says the link was copied there, and focus stays on the button", async () => {
      defineNavigator("clipboard", { writeText: vi.fn().mockResolvedValue(undefined) });
      render(<ShareButton title="The Memorare" />);
      const button = screen.getByRole("button", { name: /share the memorare/i });
      button.focus();
      button.click();
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Link copied"));
      expect(button).toHaveFocus();
      expect(button).toBeEnabled();
    });

    it("says so when the copy is refused, and throws nothing", async () => {
      const refused = new DOMException("refused", "NotAllowedError");
      defineNavigator("clipboard", { writeText: vi.fn().mockRejectedValue(refused) });
      render(<ShareButton title="The Memorare" />);
      screen.getByRole("button", { name: /share/i }).click();
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Could not copy the link"),
      );
    });

    it("says so when there is no clipboard to copy to", async () => {
      render(<ShareButton title="The Memorare" />);
      screen.getByRole("button", { name: /share/i }).click();
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Could not copy the link"),
      );
    });

    it("says nothing when the reader dismisses the share sheet", async () => {
      const dismissed = new DOMException("dismissed", "AbortError");
      const share = vi.fn().mockRejectedValue(dismissed);
      const writeText = vi.fn().mockResolvedValue(undefined);
      defineNavigator("share", share);
      defineNavigator("clipboard", { writeText });
      render(<ShareButton title="The Memorare" />);
      screen.getByRole("button", { name: /share/i }).click();
      await waitFor(() => expect(share).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(writeText).not.toHaveBeenCalled();
    });

    it("keeps focus while the share sheet is up, and does not open a second one", async () => {
      let finish: () => void = () => {};
      const share = vi.fn().mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      defineNavigator("share", share);
      render(<ShareButton title="The Memorare" />);
      const button = screen.getByRole("button", { name: /share/i });
      button.focus();
      button.click();
      button.click();
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
      expect(button).toBeEnabled();
      expect(button).toHaveFocus();
      finish();
      await waitFor(() => expect(button).toHaveFocus());
    });

    it("announces a second copy too", async () => {
      defineNavigator("clipboard", { writeText: vi.fn().mockResolvedValue(undefined) });
      render(<ShareButton title="The Memorare" />);
      const status = screen.getByRole("status");
      const seen: string[] = [];
      new MutationObserver(() => seen.push(status.textContent ?? "")).observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      const button = screen.getByRole("button", { name: /share/i });
      button.click();
      await waitFor(() => expect(status).toHaveTextContent("Link copied"));
      button.click();
      await waitFor(() => expect(seen.filter((text) => text === "Link copied")).toHaveLength(2));
    });
  });

  it("speaks the reader's language, given once by the root layout", async () => {
    defineNavigator("clipboard", { writeText: vi.fn().mockResolvedValue(undefined) });
    render(
      <ShareLabelsProvider
        labels={{
          share: "Compartir",
          shareItem: "Compartir {title}",
          copied: "Enlace copiado",
          failed: "No se pudo copiar el enlace",
        }}
      >
        <ShareButton title="$& La Memorare" />
      </ShareLabelsProvider>,
    );
    // A title is text, whatever it holds: never a replacement pattern.
    const button = screen.getByRole("button", { name: "Compartir $& La Memorare" });
    expect(button).toHaveTextContent("Compartir");
    button.click();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Enlace copiado"));
  });
});
