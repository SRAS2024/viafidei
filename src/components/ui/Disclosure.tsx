"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Accessible disclosure (dropdown) used for guide prayers and novena days:
 * a title row with a chevron that expands to reveal the full content. Keeps
 * guides and novenas concise while still providing every prayer in order.
 */
export function Disclosure({
  title,
  eyebrow,
  defaultOpen = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="vf-card overflow-hidden rounded-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-ink/5"
      >
        <span className="min-w-0">
          {eyebrow ? <span className="vf-eyebrow block">{eyebrow}</span> : null}
          <span className="font-display text-lg text-ink">{title}</span>
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
          className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <div
          id={panelId}
          className="border-t border-ink/10 px-5 py-4 font-serif leading-relaxed text-ink"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
