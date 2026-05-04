"use client";

import { useState } from "react";
import { LoginRequiredPopup } from "./LoginRequiredPopup";

type Props = {
  isAuthed: boolean;
  children: React.ReactNode;
  className?: string;
  /** Where to send authenticated users when they activate the action. */
  href?: string;
  /** Optional onClick for authenticated users. Ignored when href is set. */
  onClick?: () => void;
  type?: "button" | "submit";
  ariaLabel?: string;
  message?: string;
  loginLabel?: string;
  registerLabel?: string;
};

export function AccountRequiredButton({
  isAuthed,
  children,
  className,
  href,
  onClick,
  type = "button",
  ariaLabel,
  message,
  loginLabel,
  registerLabel,
}: Props) {
  const [showPrompt, setShowPrompt] = useState(false);

  function handleActivate(e: React.MouseEvent) {
    if (!isAuthed) {
      e.preventDefault();
      setShowPrompt(true);
      return;
    }
    if (href) {
      window.location.assign(href);
      return;
    }
    if (onClick) onClick();
  }

  return (
    <>
      <button type={type} aria-label={ariaLabel} onClick={handleActivate} className={className}>
        {children}
      </button>
      <LoginRequiredPopup
        open={showPrompt}
        onClose={() => setShowPrompt(false)}
        message={message}
        loginLabel={loginLabel}
        registerLabel={registerLabel}
      />
    </>
  );
}
