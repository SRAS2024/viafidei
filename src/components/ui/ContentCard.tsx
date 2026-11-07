import Link from "next/link";
import type { ReactNode } from "react";

export interface ContentCardProps {
  href: string;
  /** The item's name: always the first and largest thing on the card. */
  title: string;
  /** The card's heading level; "h2" under a page's h1, "h3" under a section's h2. */
  titleAs?: "h2" | "h3";
  /** The language of the title when it differs from the page's. */
  lang?: string;
  /** Short lines under the title, in order: a type, a patronage, a feast day, years. */
  meta?: ReadonlyArray<string | null | undefined>;
  /** How many lines each meta line may run to. Default 2. */
  metaLines?: number;
  /** A thematic sentence that belongs under the title (a novena's intention). */
  theme?: string | null;
  /** The description preview. */
  summary?: string | null;
  /** The quiet action on the card's bottom line ("Open"). */
  action?: string | null;
  /** Controls that are not the card's own link (a directions button). */
  children?: ReactNode;
}

/** Roughly how many characters of title type fit one line of a three-column card. */
const TITLE_CHARS_PER_LINE = 32;

/**
 * Lines of description to show beside a title of this length. A two-line title
 * gives up one line of description and a three-line title two, so a row's cards
 * come out the same height: one unusually long neighbouring title does not leave
 * blank space in the others, and their actions still share a line.
 */
export function summaryLinesFor(title: string, wanted = 4): number {
  const titleLines = Math.max(1, Math.ceil(title.trim().length / TITLE_CHARS_PER_LINE));
  return Math.max(2, wanted + 1 - titleLines);
}

/**
 * One item in a collection: prayers, saints, guides, novenas, popes and the rest
 * all share this shape.
 *
 * The title's link stretches over the whole card (`.vf-entry-link::after`), so
 * the card is one big target while a screen reader hears a link with the item's
 * name, then its metadata and description as ordinary text. That is also what
 * lets a card hold a real control such as Get directions: a button nested in a
 * link is invalid HTML.
 */
export function ContentCard({
  href,
  title,
  titleAs: Heading = "h2",
  lang,
  meta,
  metaLines = 2,
  theme,
  summary,
  action,
  children,
}: ContentCardProps) {
  const lines = (meta ?? []).filter((line): line is string => !!line && !!line.trim());
  return (
    <article className="vf-entry">
      <Heading className="vf-entry-title">
        <Link href={href} className="vf-entry-link" lang={lang}>
          {title}
        </Link>
      </Heading>
      {lines.map((line, i) => (
        <p
          key={`${i}:${line}`}
          className="vf-entry-meta vf-clamp"
          style={{ "--clamp": metaLines } as React.CSSProperties}
        >
          {line}
        </p>
      ))}
      {theme ? <p className="vf-entry-theme">{theme}</p> : null}
      {summary ? (
        <p
          className="vf-entry-summary vf-clamp"
          style={{ "--clamp": summaryLinesFor(title) } as React.CSSProperties}
        >
          {summary}
        </p>
      ) : null}
      {children}
      {action ? (
        <p className="vf-entry-action" aria-hidden="true">
          {action} <span>→</span>
        </p>
      ) : null}
    </article>
  );
}
