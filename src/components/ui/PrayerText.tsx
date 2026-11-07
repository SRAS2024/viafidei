import { Children, Fragment, type ReactNode } from "react";

import {
  parsePrayerText,
  type PrayerLine,
  type PrayerLineKind,
  type PrayerRun,
} from "@/lib/content-shared/prayer-format";

export type PrayerHeadingLevel = 2 | 3 | 4 | 5 | 6;

/**
 * A prayer's full text, set as prayer: stanzas with their line breaks, wrapped
 * lines hanging so each verse still reads as one, the people's part quieter and
 * in the same treatment everywhere, and instructions and notes in a smaller,
 * plainer voice than the words that are said. What each line is comes from
 * `parsePrayerText`, which never changes a word.
 *
 * It reads in order to a screen reader: the words as stored, one line at a time,
 * and nothing added. The printed signs that are not words ("*", "+") stay on the
 * page and are hidden from it, and a " / " that only stood for a line break is
 * the line break. A part's name ("First Decade.") is a real heading when the page
 * says at what level (`headingLevel`), so a chaplet can be walked by its decades.
 *
 * Latin and Greek pass `preserve`: `translate="no"` keeps device translation off
 * text that must stay verbatim, and anything else says "yes", because a prayer can
 * open inside one that says "no" and would inherit it. `lang` is the language the
 * text is written in, so a screen reader pronounces it in that language.
 *
 * `renderText` and `afterStanza` are how `PrayerLinkedText` turns the prayers the
 * text names into links, and opens them right under the stanza that names them.
 */
export function PrayerText({
  text,
  lang,
  preserve = false,
  headingLevel,
  className = "",
  renderText,
  afterStanza,
}: {
  text: string;
  lang?: string;
  preserve?: boolean;
  /** The level for the names of a prayer's parts. Without it they are set as text. */
  headingLevel?: PrayerHeadingLevel;
  className?: string;
  /** Renders a stretch of words, given its stanza and line. Plain text by default. */
  renderText?: (text: string, stanzaIndex: number, kind: PrayerLineKind) => ReactNode;
  /**
   * Renders what follows a stanza, given its index and whether it is the last. All
   * of it sits side by side in one parent, so an element whose key stays the same
   * stays mounted when it moves to another stanza's place, keyboard focus included.
   */
  afterStanza?: (stanzaIndex: number, isLast: boolean) => ReactNode;
}) {
  const stanzas = parsePrayerText(text);
  return (
    <div
      className={`vf-prayer ${className}`.trim()}
      lang={lang}
      translate={preserve ? "no" : "yes"}
    >
      {stanzas.flatMap((stanza, stanzaIndex) => {
        const words: Words = (run, kind) => (renderText ? renderText(run, stanzaIndex, kind) : run);
        // A part's name opens its stanza; a stanza may open with a number and a name.
        const firstLine = stanza.lines.findIndex((line) => line.kind !== "heading");
        const headings = firstLine < 0 ? stanza.lines : stanza.lines.slice(0, firstLine);
        const lines = firstLine < 0 ? [] : stanza.lines.slice(firstLine);
        const after = afterStanza?.(stanzaIndex, stanzaIndex === stanzas.length - 1);
        return [
          ...headings.map((heading, i) => (
            <PrayerHeading
              key={`heading-${stanzaIndex}-${i}`}
              line={heading}
              level={headingLevel}
              words={words}
            />
          )),
          lines.length > 0 ? (
            <p key={`stanza-${stanzaIndex}`} className="vf-prayer-stanza">
              {lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 ? "\n" : null}
                  <PrayerLineText line={line} words={words} />
                </Fragment>
              ))}
            </p>
          ) : null,
          ...Children.toArray(after),
        ];
      })}
    </div>
  );
}

type Words = (text: string, kind: PrayerLineKind) => ReactNode;

function PrayerHeading({
  line,
  level,
  words,
}: {
  line: PrayerLine;
  level?: PrayerHeadingLevel;
  words: Words;
}) {
  const Tag = level ? (`h${level}` as const) : "p";
  return <Tag className="vf-prayer-heading">{renderRuns(line, words)}</Tag>;
}

const LINE_CLASS: Record<PrayerLine["kind"], string> = {
  spoken: "vf-prayer-line",
  heading: "vf-prayer-line",
  versicle: "vf-prayer-line",
  response: "vf-prayer-line vf-prayer-response",
  rubric: "vf-prayer-line vf-prayer-rubric",
  note: "vf-prayer-line vf-prayer-note",
};

function PrayerLineText({ line, words }: { line: PrayerLine; words: Words }) {
  const classes = [
    LINE_CLASS[line.kind],
    line.markerHangs ? "vf-prayer-marked" : "",
    line.continuation ? "vf-prayer-continued" : "",
    line.prose ? "vf-prayer-prose" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes}>
      {line.marker ? (
        // One string: the space sits inside the marker, so a hanging marker's column
        // stays exact, copied text keeps it, and a screen reader meets no empty stop.
        <span className={line.markerHangs ? "vf-prayer-marker" : "vf-prayer-label"}>
          {`${line.marker} `}
        </span>
      ) : null}
      {renderRuns(line, words)}
    </span>
  );
}

function renderRuns(line: PrayerLine, words: Words): ReactNode {
  return line.runs.map((run, i) => <Fragment key={i}>{renderRun(run, line, words)}</Fragment>);
}

/** A run that differs from its line gets its own span; one that matches it needs none. */
function renderRun(run: PrayerRun, line: PrayerLine, words: Words): ReactNode {
  if (run.role === "separator") return null;
  if (run.role === "symbol") {
    return (
      <span className="vf-prayer-symbol" aria-hidden="true">
        {run.text}
      </span>
    );
  }
  const text = words(run.text, line.kind);
  if (run.role === "response" && line.kind !== "response") {
    return <span className="vf-prayer-response">{text}</span>;
  }
  if (run.role === "rubric" && line.kind !== "rubric") {
    return <span className="vf-prayer-rubric">{text}</span>;
  }
  if (run.role === "note" && line.kind !== "note") {
    return <span className="vf-prayer-reference">{text}</span>;
  }
  return text;
}
