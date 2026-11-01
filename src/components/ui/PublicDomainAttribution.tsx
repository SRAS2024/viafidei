/**
 * The one line a detail page gives a public-domain source it quotes, in the
 * same place and style as the Wikipedia credit: "Text from the Catholic
 * Encyclopedia (1913), “St. Ita”, public domain" or "Text from the Roman
 * Martyrology (1916), public domain", the work linked to the page the text was
 * taken from. Renders nothing when no shown prose came from such a work.
 */

import { publicDomainTextSource } from "@/lib/content-shared/public-domain-attribution";

const LINK_CLASS = "underline decoration-ink/30 underline-offset-2 hover:text-ink";

export function PublicDomainAttribution({ payload }: { payload: Record<string, unknown> }) {
  const source = publicDomainTextSource(payload);
  if (!source) return null;
  return (
    <p className="mt-10 font-serif text-xs leading-relaxed text-ink-faint">
      Text from{" "}
      <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {source.work}
      </a>
      {source.title ? `, “${source.title}”` : null}, public domain
    </p>
  );
}
