import Link from "next/link";

import { SearchHighlight } from "@/components/ui";
import type { SearchResultGroup as SearchResultGroupData } from "@/lib/data/published";

/**
 * One content-type section of the /search page: a human heading ("Our Lady",
 * never MARIAN_TITLE), then a row per hit with its title, the subtitle that
 * tells the two St Johns apart, and the matched text marked. Every row links
 * to the canonical href the data layer computed — the page never rebuilds
 * routes from slugs, and never shows a slug.
 */
export function SearchResultGroup({
  group,
  query,
}: {
  group: SearchResultGroupData;
  query: string;
}) {
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="break-words font-display text-2xl text-ink">{group.label}</h2>
        <span className="vf-eyebrow shrink-0">
          {group.items.length} {group.items.length === 1 ? "result" : "results"}
        </span>
      </header>
      <ul className="vf-card divide-y divide-ink/10 rounded-sm">
        {group.items.map((item) => (
          <li key={item.id} className="px-4 py-3 sm:px-5 sm:py-4">
            <Link href={item.href} className="flex items-center justify-between gap-4">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-serif text-base text-ink sm:text-lg">
                  <SearchHighlight text={item.title} query={query} />
                </span>
                {item.subtitle ? (
                  <span className="vf-eyebrow mt-1 block break-words normal-case">
                    <SearchHighlight text={item.subtitle} query={query} />
                  </span>
                ) : null}
              </span>
              <span aria-hidden="true" className="shrink-0 text-ink-faint">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
