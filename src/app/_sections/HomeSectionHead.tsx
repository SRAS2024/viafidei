import type { ReactNode } from "react";

export type HomeSectionNumber = 1 | 2 | 3 | 4;

const NUMERALS: Readonly<Record<HomeSectionNumber, string>> = {
  1: "I.",
  2: "II.",
  3: "III.",
  4: "IV.",
};

/**
 * A homepage section's numeral. The page's sections run I to IV in order, and
 * this one list is what keeps them that way. A screen reader is given the digit,
 * because a speech voice reads "I." as the pronoun and "II." as two letters.
 */
export function HomeNumeral({ n, className = "" }: { n: HomeSectionNumber; className?: string }) {
  return (
    <p className={`vf-eyebrow ${className}`.trim()}>
      <span aria-hidden="true">{NUMERALS[n]}</span>
      <span className="sr-only">{n}.</span>
    </p>
  );
}

/** A homepage section's heading: its numeral, then its title, kept together. */
export function HomeSectionHead({
  n,
  id,
  children,
}: {
  n: HomeSectionNumber;
  /** Names the section for a screen reader's landmarks. */
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="vf-section-head">
      <HomeNumeral n={n} />
      <h2 id={id} className="vf-section-title">
        {children}
      </h2>
    </div>
  );
}
