export type TimelineEventLink = { href: string; label: string; external?: boolean };

type Props = {
  title: string;
  /** Already formatted for display ("20 May 325", "325", "c. 33"). */
  date?: string;
  /** What kind of event, in sentence case ("Council", "Encyclical", "Martyrdom"…). */
  eyebrow?: string;
  location?: string;
  context?: string;
  issues?: string;
  significance?: string;
  body?: string;
  /** Related pages: document, official text, popes, saints, doctors, apparitions. */
  links?: TimelineEventLink[];
  initiallyOpen?: boolean;
  /** The row a year or a deep link landed on. */
  current?: boolean;
  /** DOM id, so a link can land on this event. */
  id?: string;
};

/**
 * One row of the Church history timeline: a native disclosure, rendered whole
 * on the server. The browser opens and closes it with no script at all, so a
 * thousand years of it costs nothing to run; a screen reader hears a disclosure
 * with the date and title; Find in Page reaches the closed text. The summary
 * shows the formatted date, the title and the kind; the details show location,
 * context, significance, an optional excerpt and the related links. No "Source:"
 * line: a reader's page shows no sources (the owner's rule). Each event's
 * citation stays in the timeline data, where the event's provenance is kept.
 *
 * The rail's marker and the chevron are drawn by the stylesheet, and the links
 * are plain anchors the page's one click handler upgrades, which keeps the page
 * light: this markup is sent twice per row, as HTML and again for hydration.
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
  initiallyOpen = false,
  current = false,
  id,
}: Props) {
  return (
    <details id={id} open={initiallyOpen} className="vf-timeline-event">
      <summary
        className={current ? "vf-timeline-summary vf-timeline-current" : "vf-timeline-summary"}
        aria-current={current ? "true" : undefined}
      >
        {date ? (
          <span className="vf-timeline-date">
            {date}
            <span className="sr-only">, </span>
          </span>
        ) : null}
        <span className="vf-timeline-title">{title}</span>
        {eyebrow ? (
          <span className="vf-timeline-kind">
            <span className="sr-only">, </span>
            {eyebrow}
          </span>
        ) : null}
      </summary>
      <div className="vf-timeline-body">
        {location ? (
          <p className="vf-timeline-fact">
            <span>Location</span>
            {` ${location}`}
          </p>
        ) : null}
        {context ? (
          <>
            <h4>Historical context</h4>
            <p>{context}</p>
          </>
        ) : null}
        {issues ? (
          <>
            <h4>Major issues addressed</h4>
            <p>{issues}</p>
          </>
        ) : null}
        {significance ? (
          <>
            <h4>Significance</h4>
            <p>{significance}</p>
          </>
        ) : null}
        {body ? <p className="vf-timeline-excerpt">{body}</p> : null}
        {links && links.length > 0 ? (
          <>
            <h4>Related</h4>
            <ul>
              {links.map((link) => (
                <li key={`${link.href}:${link.label}`}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vf-link"
                    >
                      {link.label}
                      <span aria-hidden="true"> ↗</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <a href={link.href} className="vf-link">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </details>
  );
}
