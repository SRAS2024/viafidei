"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How long after a press a dialog opening is taken to be that press's doing. */
const JUST_PRESSED_MS = 1000;

type Options = {
  open: boolean;
  onClose: () => void;
  /** Where focus lands when the dialog opens; the dialog itself when absent. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * What every modal on the site owes a keyboard or screen-reader user. Focus
 * moves into the dialog so VoiceOver reads it, Tab stays inside it, the page
 * behind goes inert so the cursor cannot wander out of it, Escape closes it, and
 * focus returns to the control that opened it.
 *
 * That control is the one just pressed, whatever then has focus: Safari does not
 * focus a button on click, and an assistive press may move no focus at all, so
 * `document.activeElement` can be the page or a landing place like <main> that stops
 * being focusable the moment the dialog takes focus. It is the fallback, for a dialog
 * that opens later than the press, and the last control pressed is the last resort.
 *
 * Focus goes back before the dialog leaves the document. Taking away the element that
 * has focus drops focus to the page, and VoiceOver is told so however soon focus moves
 * on. An effect's cleanup is too late for that, a layout effect's too: React runs those
 * after removing what the render took away. It lets go of a ref just before, so that is
 * the moment used, and the ref this returns goes on the element with role="dialog".
 */
export function useModalDialog({ open, onClose, initialFocusRef }: Options) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;
  const lastPress = useRef<{ control: HTMLElement; at: number } | null>(null);
  const dialogElement = useRef<HTMLElement | null>(null);
  const release = useRef<(() => void) | null>(null);

  const dialogRef = useCallback((node: HTMLElement | null) => {
    dialogElement.current = node;
    // Strict Mode also lets go of a ref and takes it back, with the dialog still open.
    if (!node && !openRef.current) release.current?.();
  }, []);

  useEffect(() => {
    function remember(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (control && !control.closest('[role="dialog"]')) {
        lastPress.current = { control, at: Date.now() };
      }
    }
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const press = lastPress.current;
    const active = document.activeElement;
    const focused = active instanceof HTMLElement && active.matches(FOCUSABLE) ? active : null;
    const opener =
      (press && Date.now() - press.at < JUST_PRESSED_MS ? press.control : null) ??
      focused ??
      press?.control ??
      null;

    const dialog = dialogElement.current;
    (initialFocusRef?.current ?? dialog)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const stops = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (stops.length === 0) {
        event.preventDefault();
        return;
      }
      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The dialog is portalled to <body>, so everything else on the page is one of
    // its siblings there.
    const inerted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child.contains(dialog) || child.hasAttribute("inert")) continue;
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
      child.setAttribute("inert", "");
      inerted.push(child);
    }

    let released = false;
    release.current = () => {
      if (released) return;
      released = true;
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const child of inerted) child.removeAttribute("inert");
      if (opener?.isConnected) opener.focus();
    };
    // For a dialog that goes without its ref being let go first, with its owner say.
    return release.current;
    // Runs per opening: the refs are stable and onClose is read through its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return dialogRef;
}
