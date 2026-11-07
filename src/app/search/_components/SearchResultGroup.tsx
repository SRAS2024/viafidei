import Link from "next/link";

import { SearchHighlight } from "@/components/ui";
import type { SearchResultGroup as SearchResultGroupData } from "@/lib/data/published";

/**
 * One content-type section of the /search page: a human heading ("Our Lady",
 * never MARIAN_TITLE), then a row per hit with its title and the subtitle that
 * tells the two St Johns apart, the matched text marked. A row's own type shows
 * only where it differs from the heading (a Litany among Prayers). Every row
 * links to the canonical href the data layer computed — the page never rebuilds
 * routes from slugs, and never shows a slug.
 *
 * The title's link stretches over its row, so the whole row is the target while
 * a screen reader hears a heading with the item's name, then its details.
 */
export function SearchResultGroup({
  group,
  query,
}: {
  group: SearchResultGroupData;
  query: string;
}) {
  return (
    <section className="vf-result-group">
      <div className="vf-result-head">
        <h2 className="vf-subhead">{group.label}</h2>
        <p className="vf-result-count">
          {group.items.length} {group.items.length === 1 ? "result" : "results"}
        </p>
      </div>
      <ul className="vf-result-list">
        {group.items.map((item) => {
          const meta = [
            item.typeLabel && item.typeLabel !== group.label ? item.typeLabel : null,
            item.subtitle,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={item.id} className="vf-result">
              <h3 className="vf-result-title">
                <Link href={item.href} className="vf-entry-link">
                  <SearchHighlight text={item.title} query={query} />
                </Link>
              </h3>
              {meta ? (
                <p className="vf-entry-meta">
                  <SearchHighlight text={meta} query={query} />
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
