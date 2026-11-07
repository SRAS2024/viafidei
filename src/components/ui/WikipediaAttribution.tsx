/**
 * The one line a detail page owes Wikipedia when it quotes an article:
 * "Text from Wikipedia (Hildegard Burjan), CC BY-SA 4.0", linking the article
 * and the licence. CC BY-SA requires that credit; the site shows no other
 * source lists, so this stays a single small line at the foot of the page and
 * renders nothing when no shown prose came from Wikipedia.
 */

import {
  WIKIPEDIA_LICENSE,
  wikipediaEditionName,
  wikipediaTextSource,
} from "@/lib/content-shared/wikipedia-attribution";

export function WikipediaAttribution({
  contentType,
  payload,
}: {
  contentType: string;
  payload: Record<string, unknown>;
}) {
  const source = wikipediaTextSource(contentType, payload);
  if (!source) return null;
  return (
    <p className="vf-fineprint">
      Text from{" "}
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        {wikipediaEditionName(source.lang)} ({source.title})
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {/* Between two links, a screen reader would stop on the comma alone. */}
      <span aria-hidden="true">, </span>
      <a
        href={WIKIPEDIA_LICENSE.url}
        target="_blank"
        rel="noopener noreferrer license"
        className="whitespace-nowrap"
      >
        {WIKIPEDIA_LICENSE.name}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
