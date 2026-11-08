import type { ReactNode } from "react";

/** A hyphenated compound: "33-Day", "step-by-step", "1854-1858". */
const COMPOUND = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+/gu;

/**
 * The longest compound held on one line: at 200% text on a 320 phone a card title or
 * a lede still has room for about this many characters, so a longer one may break at
 * its hyphens rather than run out of its column.
 */
const LONGEST_WHOLE = 16;

/**
 * Text set with balanced wrapping, with the places it must not break kept whole and
 * not a word changed: a short hyphenated compound in a span that does not wrap ("How to
 * Make the 33- / Day Preparation" was the balance's choice), "Our Lady" joined by a
 * no-break space, and a dash kept on the line of the word before it, so no line opens
 * with one. A non-breaking hyphen character would hold the compound too, but a screen
 * reader may read it out; a span and a no-break space are read as the text they hold.
 */
export function keepPhrasesWhole(text: string): ReactNode {
  const spaced = text.replace(/\bOur Lady\b/g, "Our Lady").replace(/ ([–—])/g, " $1");
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of spaced.matchAll(COMPOUND)) {
    if (match[0].length > LONGEST_WHOLE) continue;
    const at = match.index ?? 0;
    if (at > last) parts.push(spaced.slice(last, at));
    parts.push(
      <span key={at} className="whitespace-nowrap">
        {match[0]}
      </span>,
    );
    last = at + match[0].length;
  }
  if (parts.length === 0) return spaced;
  if (last < spaced.length) parts.push(spaced.slice(last));
  return parts;
}
