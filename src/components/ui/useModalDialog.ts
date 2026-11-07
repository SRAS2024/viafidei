"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Options = {
  open: boolean;
  onClose: () => void;
  /** The element with role="dialog". */
  dialogRef: RefObject<HTMLElement | null>;
  /** Where focus lands when the dialog opens; the dialog itself when absent. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * What every modal on the site owes a keyboard or screen-reader user. Focus
 * moves into the dialog so VoiceOver reads it, Tab stays inside it, the page
 * behind goes inert so the cursor cannot wander out of it, Escape closes it, and
 * focus returns to the control that opened it.
 *
 * Safari does not focus a button on click, so `document.activeElement` alone
 * would lose the opener there; the last activated control is remembered too.
 */
export function useModalDialog({ open, onClose, dialogRef, initialFocusRef }: Options) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lastActivated = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function remember(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>("button, a[href], [tabindex]");
      if (control && !control.closest('[role="dialog"]')) lastActivated.current = control;
    }
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    const opener =
      active instanceof HTMLElement && active !== document.body ? active : lastActivated.current;

    const dialog = dialogRef.current;
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

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const child of inerted) child.removeAttribute("inert");
      if (opener?.isConnected) opener.focus();
    };
    // Runs per opening: the refs are stable and onClose is read through its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
