"use client";

import { useState } from "react";

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
 * A section whose text cannot be verified is rendered as one compact citation
 * line ("Gospel Acclamation — Mt 11:25"), not as a paragraph-shaped placeholder.
 */
export function ReadingSections({ sections }: { sections: ReadingsViewSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="space-y-8">
      {sections.map((section, i) => (
        <ReadingSectionView key={`${section.kind}-${i}`} section={section} />
      ))}
    </div>
  );
}

function ReadingSectionView({ section }: { section: ReadingsViewSection }) {
  const [index, setIndex] = useState(0);
  const alternatives = section.alternatives.length > 0 ? section.alternatives : [];
  const chosen = alternatives[index] ?? alternatives[0] ?? null;
  const body = chosen?.body ?? section.body;

  // Citation-only: one compact line, no rule and no placeholder paragraph.
  if (!body) {
    return (
      <section>
        <p className="font-serif text-sm text-ink-soft">
          <span className="font-display text-ink">{section.label}</span>
          {section.citation ? <span className="text-ink-faint"> — {section.citation}</span> : null}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-lg text-ink">{section.label}</h2>
      <p className="mt-0.5 font-serif text-sm italic text-ink-soft">
        {chosen?.citation ?? section.citation}
      </p>
      {alternatives.length > 1 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="vf-eyebrow text-ink-faint">Either</span>
          {alternatives.map((alt, i) => (
            <button
              key={alt.citation}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              className={`rounded-sm border px-2 py-0.5 font-serif text-xs ${
                i === index
                  ? "border-ink/40 bg-ink/5 text-ink"
                  : "border-ink/15 text-ink-soft hover:border-ink/30"
              }`}
            >
              {alt.citation}
            </button>
          ))}
        </div>
      ) : null}
      {section.response?.body ? (
        <p className="mt-2 font-serif text-sm text-ink-soft">
          <span className="italic">R.</span> {section.response.body}
        </p>
      ) : null}
      <div className="vf-rule my-3" />
      <p className="whitespace-pre-line font-serif text-[1.05rem] leading-relaxed text-ink">
        {body}
      </p>
      {chosen?.note ? (
        <p className="mt-2 font-serif text-xs text-ink-faint">{chosen.note}</p>
      ) : null}
    </section>
  );
}
