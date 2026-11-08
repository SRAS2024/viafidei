"use client";

import { useState } from "react";

import type { ReadingLayout } from "@/lib/content-shared/lectionary";

import type { ReadingsViewSection } from "./readings-view";

/**
 * The day's readings.
 *
 * Two rules from the accuracy posture are visible here:
 *   - where the Lectionary offers a choice ("Jn 1:1-18 or Jn 1:1-5, 9-14") BOTH
 *     readings are available behind a toggle, rather than one being silently
 *     dropped;
 *   - where the citation reads only part of a verse the Douay-Rheims verse is
 *     shown whole, and the page says so.
 * A section whose text cannot be verified is rendered as its heading and citation,
 * not as a paragraph-shaped placeholder.
 */
/** The section's own sentences, in the page's language. */
export interface ReadingSectionWords {
  douayMisses: string;
  /** "Read it at {source}". */
  readItAt: string;
  newTab: string;
}

const ENGLISH_WORDS: ReadingSectionWords = {
  douayMisses:
    "The Douay-Rheims numbers this passage differently from the Lectionary, so its text is not shown here.",
  readItAt: "Read it at {source}",
  newTab: "(opens in a new tab)",
};

export function ReadingSections({
  sections,
  sourceUrl,
  sourceName,
  words = ENGLISH_WORDS,
}: {
  sections: ReadingsViewSection[];
  sourceUrl?: string;
  sourceName?: string;
  words?: ReadingSectionWords;
}) {
  if (sections.length === 0) return null;
  return (
    <div className="vf-readings">
      {sections.map((section, i) => (
        <ReadingSectionView
          // The citation is part of the key: moving to another Mass starts over on the
          // new reading's first choice, not on whichever was chosen in the last one.
          key={`${section.kind}-${i}-${section.citation}`}
          section={section}
          sourceUrl={sourceUrl}
          sourceName={sourceName}
          words={words}
        />
      ))}
    </div>
  );
}

/** A response line ("R. Blessed be the Lord") in a stored psalm, set the same every time. */
const RESPONSE_LINE = /^R\.\s*/;

function PsalmResponse({ text }: { text: string }) {
  return (
    <span className="vf-prayer-line vf-prayer-response">
      <abbr title="Response">R.</abbr> {text}
    </span>
  );
}

/** The text of a reading: stanzas of verse or paragraphs of prose, same words either way. */
function ReadingText({ layout, body }: { layout: ReadingLayout | null; body: string }) {
  if (layout?.form === "verse") {
    return (
      <div className="vf-prayer">
        {layout.stanzas.map((stanza, s) => (
          <p key={s} className="vf-prayer-stanza">
            {stanza.map((line, l) =>
              RESPONSE_LINE.test(line) ? (
                <PsalmResponse key={l} text={line.replace(RESPONSE_LINE, "")} />
              ) : (
                <span key={l} className="vf-prayer-line">
                  {line}
                </span>
              ),
            )}
          </p>
        ))}
      </div>
    );
  }
  const paragraphs = layout?.form === "prose" ? layout.paragraphs : [body];
  return (
    <div className="vf-reading">
      {paragraphs.map((paragraph, p) => (
        <p key={p}>{paragraph}</p>
      ))}
    </div>
  );
}

function ReadingSectionView({
  section,
  sourceUrl,
  sourceName,
  words,
}: {
  section: ReadingsViewSection;
  sourceUrl?: string;
  sourceName?: string;
  words: ReadingSectionWords;
}) {
  const [index, setIndex] = useState(0);
  const alternatives = section.alternatives;
  const chosen = alternatives[index] ?? alternatives[0] ?? null;
  const body = chosen ? chosen.body : section.body;
  const reference = chosen?.reference ?? section.reference;
  // An acclamation is a line, so without its text it is nothing but its citation.
  // A reading missing its text is a gap the page owes an explanation for.
  const missesReading = !body && section.kind !== "ACCLAMATION";
  const hasChoice = alternatives.length > 1;

  return (
    <section className="vf-detail-section vf-reading-section">
      <h2 className={`${body || hasChoice ? "vf-subhead" : "vf-subhead-sm"} text-ink`}>
        {section.label}
      </h2>
      {/* Choosing another reading changes this line, so a screen reader says which. */}
      <p className="vf-reading-ref" aria-live={hasChoice ? "polite" : undefined}>
        {reference}
      </p>

      {hasChoice ? (
        <div
          className="vf-choice vf-reading-either"
          role="group"
          aria-label={`Choose the ${section.label}`}
        >
          <p className="vf-choice-label" aria-hidden="true">
            Either
          </p>
          {/* Without markers Safari drops a list's role, so it is said out loud. */}
          <ul className="vf-choice-options" role="list">
            {alternatives.map((alt, i) => (
              <li key={alt.citation}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-pressed={i === index}
                  className={`vf-chip ${i === index ? "vf-filter-active" : ""}`.trim()}
                >
                  {alt.reference}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.response?.body ? (
        <p className="vf-prayer vf-reading-response">
          <PsalmResponse text={section.response.body} />
        </p>
      ) : null}

      {body ? <ReadingText layout={chosen ? chosen.layout : section.layout} body={body} /> : null}

      {missesReading ? (
        <p className="vf-fineprint vf-reading-note">
          {words.douayMisses}
          {sourceUrl ? (
            <>
              {" "}
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                {words.readItAt.replace("{source}", sourceName ?? "the source")}
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> {words.newTab}</span>
              </a>
              .
            </>
          ) : null}
        </p>
      ) : chosen?.note ? (
        <p className="vf-fineprint vf-reading-note">{chosen.note}</p>
      ) : null}
    </section>
  );
}
