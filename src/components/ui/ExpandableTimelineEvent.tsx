"use client";

import Link from "next/link";
import { useState, useId } from "react";

export type TimelineEventLink = { href: string; label: string; external?: boolean };

type Props = {
  title: string;
  /** Already formatted for display ("20 May 325", "325", "c. 33"). */
  date?: string;
  /** Kind badge ("Council", "Encyclical", "Martyrdom"…). */
  eyebrow?: string;
  location?: string;
  context?: string;
  issues?: string;
  significance?: string;
  body?: string;
  /** Related pages: document, official text, popes, saints, doctors, apparitions. */
  links?: TimelineEventLink[];
  /** The one authoritative source for a static event. */
  citation?: string;
  initiallyOpen?: boolean;
  /** DOM id for jump-to-era scrolling. */
  id?: string;
};

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

/**
 * Expandable timeline event used in the Church history timeline.
 *
 * Mirrors the ExpandablePrayer pattern: arrow points right when collapsed,
 * arrow points down when expanded. The trigger shows the formatted date, a
 * kind badge and the title; the body shows location, context, significance,
 * an optional excerpt, a "Related" chip row and the source citation.
 */
export function ExpandableTimelineEvent({
  title,
  date,
  eyebrow,
  location,
  context,
  issues,
  significance,
  body,
  links,
  citation,
  initiallyOpen = false,
  id,
}: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  return (
    <div
      id={id}
      className="vf-timeline-event"
      // Long lists (hundreds of rows) only lay out what is on screen.
      style={{ contentVisibility: "auto", containIntrinsicSize: "64px" }}
    >
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
          {date || eyebrow ? (
            <span className="vf-timeline-date flex flex-wrap items-center gap-x-2 gap-y-1">
              {date ? <span>{date}</span> : null}
              {eyebrow ? (
                <span className="rounded-sm bg-ink/5 px-1.5 py-0.5 text-[0.6rem] tracking-[0.14em] text-ink-soft">
                  {eyebrow}
                </span>
              ) : null}
            </span>
          ) : null}
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
          {links && links.length > 0 ? (
            <div className="vf-timeline-section">
              <h4 className="vf-timeline-section-title">Related</h4>
              <ul className="flex flex-wrap gap-2" aria-label={`Related to ${title}`}>
                {links.map((link) => {
                  const cls =
                    "inline-flex items-center gap-1 rounded-sm border border-transparent bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-liturgical text-ink-soft transition hover:bg-ink/10 hover:text-ink";
                  return (
                    <li key={`${link.href}:${link.label}`}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cls}
                        >
                          {link.label}
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : (
                        <Link href={link.href} className={cls}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {citation ? (
            <p className="mt-3 font-sans text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
              Source:{" "}
              <a
                href={citation}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink/30 underline-offset-2 hover:text-ink"
              >
                {hostOf(citation)}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
