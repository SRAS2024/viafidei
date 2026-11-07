import { Fragment } from "react";

/**
 * Marks every occurrence of the query inside a result title/subtitle so a
 * reader can see WHY a row matched. Shared by the header dropdown and the
 * /search page so both highlight identically.
 *
 * Matching is plain case-insensitive substring matching on the rendered text —
 * never a regular expression built from user input, which a query containing
 * `(` or `*` would break.
 */
export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle || !text) return <>{text}</>;

  const haystack = text.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) break;
    if (idx > cursor) parts.push({ text: text.slice(cursor, idx), match: false });
    parts.push({ text: text.slice(idx, idx + needle.length), match: true });
    cursor = idx + needle.length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part.match ? <mark className="vf-mark">{part.text}</mark> : part.text}
        </Fragment>
      ))}
    </>
  );
}

/** What separates the parts of a stored subtitle: "Memorial · October 7". */
const LINE_SEPARATOR = /\s+·\s+/;

/**
 * A line of metadata as it should be spoken: a comma, which a screen reader
 * voices as a pause, where the eye gets a dot.
 */
export function spokenLine(text: string): string {
  return text.split(LINE_SEPARATOR).join(", ");
}

/**
 * A result's line of metadata, "Memorial · October 7 · Ordinary Time", with the
 * matched text marked.
 *
 * What is drawn and what is read are kept apart, because each dot and each mark
 * cuts the line into pieces that VoiceOver stops at one by one, and a word cut
 * by a mark is read in halves ("Mary", then "land"). So a screen reader gets the
 * whole line at once and the drawn line is hidden from it. A line with nothing
 * to cut is left as plain text.
 */
export function SearchMetaLine({ text, query }: { text: string; query: string }) {
  const parts = text.split(LINE_SEPARATOR);
  const needle = query.trim().toLowerCase();
  if (parts.length === 1 && (!needle || !text.toLowerCase().includes(needle))) {
    return <>{text}</>;
  }
  return (
    <>
      <span className="sr-only">{spokenLine(text)}</span>
      <span aria-hidden="true">
        {parts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 ? " · " : null}
            <SearchHighlight text={part} query={query} />
          </Fragment>
        ))}
      </span>
    </>
  );
}
