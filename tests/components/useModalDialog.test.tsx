/**
 * @vitest-environment jsdom
 */
/**
 * Where focus goes when a dialog closes. Safari focuses no button on a click, and an
 * assistive press may move no focus at all, so what has focus when the dialog opens
 * can be the page, or a landing place like <main> that stops being focusable once
 * focus leaves it. None of that is the control the reader pressed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { useModalDialog } from "@/components/ui/useModalDialog";

function Page({ openLater }: { openLater?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog({ open, onClose: () => setOpen(false) });
  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>
        Favorite
      </button>
      <input aria-label="Name" />
      {openLater ? (
        <button
          type="button"
          onClick={() => setTimeout(() => setOpen(true), 5000)}
          aria-label="Later"
        />
      ) : null}
      {open ? (
        <div ref={dialogRef} role="dialog" aria-label="Sign in" tabIndex={-1}>
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      ) : null}
    </main>
  );
}

const favorite = () => screen.getByRole("button", { name: "Favorite" });
const escape = () => fireEvent.keyDown(document, { key: "Escape" });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useModalDialog", () => {
  it("returns focus to the control pressed when nothing has focus, as after a click in Safari", () => {
    render(<Page />);
    expect(document.body).toHaveFocus();
    fireEvent.click(favorite());
    expect(screen.getByRole("dialog")).toHaveFocus();
    escape();
    expect(favorite()).toHaveFocus();
  });

  it("returns focus to the control pressed when <main> holds focus, as after the skip link", () => {
    render(<Page />);
    const main = screen.getByRole("main");
    // What the skip link does: focusable only until focus leaves it.
    main.tabIndex = -1;
    main.focus();
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
    expect(main).toHaveFocus();

    fireEvent.click(favorite());
    escape();
    expect(favorite()).toHaveFocus();
  });

  it("returns focus to the control pressed from the keyboard", () => {
    render(<Page />);
    favorite().focus();
    fireEvent.click(favorite());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(favorite()).toHaveFocus();
  });

  it("prefers what has focus for a dialog opening long after any press", () => {
    vi.useFakeTimers();
    render(<Page openLater />);
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    const field = screen.getByRole("textbox", { name: "Name" });
    field.focus();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("dialog")).toHaveFocus();
    escape();
    expect(field).toHaveFocus();
  });

  describe("closing", () => {
    /** Whether the dialog was still in the document when focus reached the control. */
    function dialogPresentWhenFocusReturns() {
      const seen: boolean[] = [];
      favorite().addEventListener("focus", () => {
        seen.push(document.querySelector('[role="dialog"]') !== null);
      });
      return seen;
    }

    it("gives focus back before the dialog leaves, so focus never falls to the page", () => {
      render(<Page />);
      const seen = dialogPresentWhenFocusReturns();
      fireEvent.click(favorite());
      escape();
      expect(seen).toEqual([true]);
      expect(favorite()).toHaveFocus();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does so for a close inside the dialog too", () => {
      render(<Page />);
      const seen = dialogPresentWhenFocusReturns();
      fireEvent.click(favorite());
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(seen).toEqual([true]);
      expect(favorite()).toHaveFocus();
    });

    it("hands the page back, inert and scroll both", () => {
      function Portalled() {
        const [open, setOpen] = useState(false);
        const dialogRef = useModalDialog({ open, onClose: () => setOpen(false) });
        return (
          <>
            <main>
              <button type="button" onClick={() => setOpen(true)}>
                Favorite
              </button>
            </main>
            {open
              ? createPortal(
                  <div ref={dialogRef} role="dialog" aria-label="Sign in" tabIndex={-1} />,
                  document.body,
                )
              : null}
          </>
        );
      }
      const { container } = render(<Portalled />);
      fireEvent.click(favorite());
      expect(container).toHaveAttribute("inert");
      expect(document.body.style.overflow).toBe("hidden");
      escape();
      expect(container).not.toHaveAttribute("inert");
      expect(document.body.style.overflow).toBe("");
      expect(favorite()).toHaveFocus();
    });

    it("stays open when Strict Mode lets go of the ref and takes it back", () => {
      let ref: (node: HTMLElement | null) => void = () => {};
      function Kept() {
        const [open, setOpen] = useState(false);
        ref = useModalDialog({ open, onClose: () => setOpen(false) });
        return (
          <main>
            <button type="button" onClick={() => setOpen(true)}>
              Favorite
            </button>
            {open ? <div ref={ref} role="dialog" aria-label="Sign in" tabIndex={-1} /> : null}
          </main>
        );
      }
      render(<Kept />);
      fireEvent.click(favorite());
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveFocus();
      // What Strict Mode does to a newly mounted element's ref in a development build.
      ref(null);
      ref(dialog);
      expect(dialog).toHaveFocus();
      expect(document.body.style.overflow).toBe("hidden");
      escape();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe("");
      expect(favorite()).toHaveFocus();
    });

    it("hands the page back when the dialog goes with its owner", () => {
      const { unmount } = render(<Page />);
      fireEvent.click(favorite());
      expect(document.body.style.overflow).toBe("hidden");
      unmount();
      expect(document.body.style.overflow).toBe("");
    });
  });

  it("falls back on the last control pressed, for a dialog opening late with nothing focused", () => {
    vi.useFakeTimers();
    render(<Page openLater />);
    const later = screen.getByRole("button", { name: "Later" });
    fireEvent.click(later);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    escape();
    expect(later).toHaveFocus();
  });
});
