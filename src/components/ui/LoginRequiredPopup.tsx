"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalDialog } from "./useModalDialog";

/** The popup's words, when the control that opens it gives none of its own. */
export type LoginRequiredLabels = {
  message: string;
  loginLabel: string;
  registerLabel: string;
  closeLabel: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  message?: string;
  loginLabel?: string;
  registerLabel?: string;
  closeLabel?: string;
};

const LoginRequiredLabelsContext = createContext<LoginRequiredLabels>({
  message: "An account is required to use this feature.",
  loginLabel: "Log in",
  registerLabel: "Create account",
  closeLabel: "Close",
});

/**
 * The popup's words in the reader's language, given once by the root layout, as the
 * Share button's are: the controls that open it are client components with no
 * translator of their own.
 */
export function LoginRequiredLabelsProvider({
  labels,
  children,
}: {
  labels: LoginRequiredLabels;
  children: ReactNode;
}) {
  return (
    <LoginRequiredLabelsContext.Provider value={labels}>
      {children}
    </LoginRequiredLabelsContext.Provider>
  );
}

export function LoginRequiredPopup({
  open,
  onClose,
  message: givenMessage,
  loginLabel: givenLoginLabel,
  registerLabel: givenRegisterLabel,
  closeLabel: givenCloseLabel,
}: Props) {
  const words = useContext(LoginRequiredLabelsContext);
  const message = givenMessage ?? words.message;
  const loginLabel = givenLoginLabel ?? words.loginLabel;
  const registerLabel = givenRegisterLabel ?? words.registerLabel;
  const closeLabel = givenCloseLabel ?? words.closeLabel;
  const pathname = usePathname();
  const loginRef = useRef<HTMLButtonElement>(null);
  const pressedBackdrop = useRef(false);
  const messageId = useId();

  const dialogRef = useModalDialog({ open, onClose, initialFocusRef: loginRef });

  if (!open || typeof document === "undefined") return null;

  // Send the user back to where they were after they log in / register.
  const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
  // Hard navigation: both a <Link> (unmounted by onClose in the same click) and
  // router.push (cancelled when this popup unmounts, or swallowed by an ancestor
  // card link) "did nothing". window.location.assign is a browser-level
  // navigation that no unmount or competing handler can cancel — and logging in
  // is a full context switch anyway. Mirrors AccountRequiredButton's authed path.
  const go = (e: React.MouseEvent, base: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== "undefined") window.location.assign(`${base}${next}`);
  };

  // Portalled to <body> so it paints above the sticky header; see ConfirmDialog.
  return createPortal(
    // Backdrop dismiss-on-click, as in ConfirmDialog, and not on the press: the press goes
    // on to move focus to the page after this has handed it back to the control that
    // opened the popup. Only a press that began out here counts, so a selection dragged
    // out of the message does not dismiss it. Escape is the keyboard's way, in
    // useModalDialog, however focus is placed.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="vf-modal-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseDown={(e) => {
        // Focus stays in the dialog while the press lasts, in case it ends elsewhere.
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={messageId}
        tabIndex={-1}
        className="vf-modal vf-modal-narrow"
        onPointerDown={(e) => {
          pressedBackdrop.current = false;
          e.stopPropagation();
        }}
      >
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="vf-login-popup-close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        <p id={messageId} className="vf-modal-body vf-modal-message">
          {message}
        </p>
        <div className="vf-modal-actions vf-modal-actions-stacked">
          <button
            ref={loginRef}
            type="button"
            className="vf-btn vf-btn-primary"
            onClick={(e) => go(e, "/login")}
          >
            {loginLabel}
          </button>
          <button type="button" className="vf-btn vf-btn-ghost" onClick={(e) => go(e, "/register")}>
            {registerLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
