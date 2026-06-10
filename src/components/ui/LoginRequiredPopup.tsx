"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  message?: string;
  loginLabel?: string;
  registerLabel?: string;
  closeLabel?: string;
};

const DEFAULTS = {
  message: "An account is required to use this feature.",
  loginLabel: "Log in",
  registerLabel: "Create account",
  closeLabel: "Close",
};

export function LoginRequiredPopup({
  open,
  onClose,
  message = DEFAULTS.message,
  loginLabel = DEFAULTS.loginLabel,
  registerLabel = DEFAULTS.registerLabel,
  closeLabel = DEFAULTS.closeLabel,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Send the user back to where they were after they log in / register.
  const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
  // Navigate programmatically: a <Link> here was being unmounted by onClose in
  // the same click, which cancelled the client navigation (the links "did
  // nothing"). router.push is dispatched immediately and is unaffected.
  const go = (base: string) => {
    router.push(`${base}${next}`);
    onClose();
  };

  return (
    <div
      className="vf-login-popup-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vf-login-popup-msg"
        className="vf-login-popup"
        onPointerDown={(e) => e.stopPropagation()}
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
        <p id="vf-login-popup-msg" className="vf-login-popup-msg">
          {message}
        </p>
        <div className="vf-login-popup-actions">
          <button
            type="button"
            className="vf-login-popup-btn vf-login-popup-btn-primary"
            onClick={() => go("/login")}
          >
            {loginLabel}
          </button>
          <button type="button" className="vf-login-popup-btn" onClick={() => go("/register")}>
            {registerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
