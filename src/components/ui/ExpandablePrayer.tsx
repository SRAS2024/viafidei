"use client";

import { useState, useId } from "react";

type Props = {
  title: string;
  body: string;
  initiallyOpen?: boolean;
};

/**
 * Expandable prayer block used inside guides (e.g. praying the rosary).
 *
 * Collapsed: shows the prayer title with a right-pointing arrow.
 * Expanded: shows the title with a down-pointing arrow and the prayer text.
 *
 * Tapping the title or the arrow toggles state. Keyboard activation works
 * because the trigger is a real <button>.
 */
export function ExpandablePrayer({ title, body, initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  return (
    <div className="vf-expandable">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="vf-expandable-trigger"
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
          className={`vf-expandable-arrow ${open ? "vf-expandable-arrow-open" : ""}`}
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span className="vf-expandable-title">{title}</span>
      </button>
      {open ? (
        <div id={panelId} className="vf-expandable-body" role="region" aria-label={title}>
          <p className="whitespace-pre-wrap">{body}</p>
        </div>
      ) : null}
    </div>
  );
}
