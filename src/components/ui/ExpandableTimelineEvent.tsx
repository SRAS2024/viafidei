"use client";

import { useState, useId } from "react";

type Props = {
  title: string;
  date?: string;
  location?: string;
  context?: string;
  issues?: string;
  significance?: string;
  body?: string;
  initiallyOpen?: boolean;
};

/**
 * Expandable timeline event used in the Church history timeline.
 *
 * Mirrors the ExpandablePrayer pattern: arrow points right when collapsed,
 * arrow points down when expanded. Each section (context, issues addressed,
 * significance) renders if provided.
 */
export function ExpandableTimelineEvent({
  title,
  date,
  location,
  context,
  issues,
  significance,
  body,
  initiallyOpen = false,
}: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  return (
    <div className="vf-timeline-event">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="vf-timeline-trigger"
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
        <span className="vf-timeline-title">
          {date ? <span className="vf-timeline-date">{date}</span> : null}
          <span>{title}</span>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="vf-timeline-body" role="region" aria-label={title}>
          {location ? (
            <p className="vf-timeline-meta">
              <span className="vf-timeline-meta-label">Location</span>
              <span>{location}</span>
            </p>
          ) : null}
          {context ? (
            <div className="vf-timeline-section">
              <h4 className="vf-timeline-section-title">Historical context</h4>
              <p className="vf-timeline-section-body">{context}</p>
            </div>
          ) : null}
          {issues ? (
            <div className="vf-timeline-section">
              <h4 className="vf-timeline-section-title">Major issues addressed</h4>
              <p className="vf-timeline-section-body">{issues}</p>
            </div>
          ) : null}
          {significance ? (
            <div className="vf-timeline-section">
              <h4 className="vf-timeline-section-title">Significance</h4>
              <p className="vf-timeline-section-body">{significance}</p>
            </div>
          ) : null}
          {body ? (
            <div className="vf-timeline-section">
              <p className="vf-timeline-section-body whitespace-pre-wrap">{body}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
