"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

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
  loginLabel: "Sign in",
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
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="vf-login-popup-backdrop"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vf-login-popup-msg"
        className="vf-login-popup"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p id="vf-login-popup-msg" className="vf-login-popup-msg">
          {message}
        </p>
        <div className="vf-login-popup-links">
          <Link href="/login" className="vf-login-popup-link" onClick={onClose}>
            {loginLabel}
          </Link>
          <span aria-hidden="true" className="vf-login-popup-sep">
            ·
          </span>
          <Link href="/register" className="vf-login-popup-link" onClick={onClose}>
            {registerLabel}
          </Link>
        </div>
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
      </div>
    </div>
  );
}
