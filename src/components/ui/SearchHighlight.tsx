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
          {part.match ? (
            <mark className="rounded-sm bg-ink/10 px-0.5 text-ink">{part.text}</mark>
          ) : (
            part.text
          )}
        </Fragment>
      ))}
    </>
  );
}
