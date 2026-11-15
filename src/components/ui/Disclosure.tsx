"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Accessible disclosure (dropdown) used for guide prayers and novena days:
 * a title row with a chevron that expands to reveal the full content. One look
 * everywhere: the same label, title, border and spacing, and expanded prayer
 * text at full prayer size. Keeps guides and novenas concise while still
 * providing every prayer in order.
 */
export function Disclosure({
  title,
  eyebrow,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  /**
   * Shown to the right of the title while the disclosure is open (a novena day's
   * pray-along button). It is its own button beside the toggle, never inside it, and
   * comes after it in reading order: the day, then its megaphone, then its prayer.
   */
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-controls={panelId}
      className="vf-disclosure-trigger"
    >
      <span className="min-w-0">
        {eyebrow ? <span className="vf-disclosure-label">{eyebrow}</span> : null}
        <span className="vf-disclosure-title">{title}</span>
      </span>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="vf-disclosure-chevron"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  // The toggle always sits in the same wrapper, so opening the panel (which brings the
  // action in) never remounts it: keyboard and VoiceOver focus stay on it.
  return (
    <div className="vf-disclosure">
      <div className="vf-disclosure-head">
        {trigger}
        {open && action ? <div className="vf-disclosure-action">{action}</div> : null}
      </div>
      {open ? (
        <div id={panelId} className="vf-disclosure-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
