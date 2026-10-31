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

const LINK_CLASS = "underline decoration-ink/30 underline-offset-2 hover:text-ink";

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
    <p className="mt-10 font-serif text-xs leading-relaxed text-ink-faint">
      Text from{" "}
      <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {wikipediaEditionName(source.lang)} ({source.title})
      </a>
      ,{" "}
      <a
        href={WIKIPEDIA_LICENSE.url}
        target="_blank"
        rel="noopener noreferrer license"
        className={LINK_CLASS}
      >
        {WIKIPEDIA_LICENSE.name}
      </a>
    </p>
  );
}
