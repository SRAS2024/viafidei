import Link from "next/link";

import { SearchHighlight, SearchMetaLine } from "@/components/ui/SearchHighlight";
import { translateTypeLabel } from "@/lib/content-shared/content-type-labels";
import { tPlural } from "@/lib/i18n/plural";
import type { Translator } from "@/lib/i18n/translator";
import type { SearchResultGroup as SearchResultGroupData } from "@/lib/data/published";

/**
 * One section of the /search page: a human heading ("Our Lady", never
 * MARIAN_TITLE), then a row per hit with its title and the subtitle that tells
 * the two St Johns apart, the matched text marked. Every row links to the
 * canonical href the data layer computed — the page never rebuilds routes from
 * slugs, and never shows a slug.
 *
 * The title's link stretches over its row, so the whole row is the target while
 * a screen reader hears a heading with the item's name, then its details. The
 * link's name is written out rather than left to its text: where a line wraps
 * just before a <mark>, WebKit drops the space and names the link "of theRosary".
 *
 * The rows of one group can run across pages, because results are ranked as one
 * list. So the count says how many of the group's results are here.
 */
export function SearchResultGroup({
  group,
  query,
  t,
  locale,
}: {
  group: SearchResultGroupData;
  query: string;
  t: Translator;
  locale?: string;
}) {
  const shown = group.items.length;
  const count =
    group.total === null
      ? null
      : group.total > shown
        ? tPlural(t, locale, "search.groupShown", group.total, { shown })
        : tPlural(t, locale, "search.groupResults", shown);
  return (
    <section className="vf-result-group">
      <div className="vf-result-head">
        <h2 className="vf-subhead">{translateTypeLabel(group.label, t)}</h2>
        {count ? <p className="vf-result-count">{count}</p> : null}
      </div>
      {/* role="list": Safari drops a list's role where its markers are removed. */}
      <ul role="list" className="vf-result-list">
        {group.items.map((item) => (
          <li key={item.id} className="vf-result">
            <h3 className="vf-result-title">
              <Link href={item.href} aria-label={item.title} className="vf-entry-link">
                <SearchHighlight text={item.title} query={query} />
              </Link>
            </h3>
            {item.subtitle ? (
              <p className="vf-entry-meta">
                <SearchMetaLine text={item.subtitle} query={query} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
