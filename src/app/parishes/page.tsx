import {
  FilterChips,
  LIST_PAGE_SIZE,
  ListSearch,
  ListSearchNoResults,
  Pagination,
  parsePageParam,
} from "@/components/ui";
import { countPublishedBySubtype, listParishPage } from "@/lib/data/published";
import { localizeParishes } from "@/lib/translation/localize";
import { listHref, parseSearchQuery } from "@/lib/content-shared/list-search";
import { PARISH_FILTERS, resolveParishFilter } from "@/lib/content-shared/parish";
import { getTranslator } from "@/lib/i18n/server";

import { ParishLocator } from "./ParishLocator";
import { ParishesHero } from "./ParishesHero";
import { parishLocatorLabels } from "./locator-labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parishes" };

/**
 * The stored `designation` values behind each classification chip. The
 * directory filters and counts on the indexed `subtype` column, which carries
 * the designation verbatim, so "Basilicas" has to name both stored forms and
 * "Chapels" takes the oratories too (`classifyParish` files them there): with
 * no chip naming "oratory", the 2,241 published oratories were reachable from
 * "All" alone.
 */
const PARISH_FILTER_SUBTYPES: Readonly<Record<string, readonly string[]>> = {
  parish: ["parish"],
  cathedral: ["cathedral"],
  basilica: ["major-basilica", "minor-basilica", "basilica"],
  shrine: ["shrine"],
  chapel: ["chapel", "oratory"],
};

export default async function ParishesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; q?: string | string[]; page?: string }>;
}) {
  const { class: classParam, q: rawQuery, page: pageParam } = await searchParams;
  const active = resolveParishFilter(classParam);
  const query = parseSearchQuery(rawQuery);
  // The "near me" distance line speaks the site language, and outside English
  // that language alone settles the units; the browser's region does the rest.
  const { t, locale } = await getTranslator();

  // One page of the directory, filtered and counted in SQL. The page used to
  // load every published parish and hand the whole array to a client
  // component; the directory is heading for 200,000 records, so it now ships
  // one page of projected rows and nothing else. A search matches the parish's
  // name, its city, state or country, and its postal code.
  const [result, counts] = await Promise.all([
    listParishPage({
      page: parsePageParam(pageParam),
      pageSize: LIST_PAGE_SIZE,
      q: query || null,
      class: active === "all" ? null : (PARISH_FILTER_SUBTYPES[active] ?? null),
    }),
    countPublishedBySubtype("PARISH").catch(() => ({}) as Record<string, number>),
  ]);

  // Only offer a classification chip when at least one record falls under it.
  const hasContent = (key: string): boolean =>
    (PARISH_FILTER_SUBTYPES[key] ?? []).some((value) => (counts[value] ?? 0) > 0);
  const keep = { class: active === "all" ? undefined : active };

  return (
    <div>
      <ParishesHero />

      {/* The locator renders even when this page of the directory is empty:
          "Use my location" must stay one tap away whatever the list shows. */}
      <ParishLocator
        // The same GET form as every list page: searching is a real URL, so a
        // result page can be linked, bookmarked, and crawled.
        search={
          <ListSearch
            action="/parishes"
            query={query}
            label={t("listSearch.parishes")}
            placeholder={t("listSearch.parishesPlaceholder")}
            keep={keep}
            resultCount={result.total}
            t={t}
            locale={locale}
          />
        }
        filter={
          <FilterChips
            ariaLabel="Filter by classification"
            activeKey={active}
            items={PARISH_FILTERS.filter((f) => f.key === "all" || hasContent(f.key)).map((f) => ({
              key: f.key,
              label: f.label,
              href: listHref("/parishes", {
                class: f.key === "all" ? undefined : f.key,
                q: query,
              }),
            }))}
          />
        }
        // Names in another script transliterated and countries named in
        // the reader's language (rule b), in memory: no cache lookup.
        parishes={await localizeParishes(result.items, { locale })}
        // A search reports its own count above; the directory's size is noise then.
        total={query ? undefined : result.total}
        locale={locale}
        awayTemplate={t("parishes.distanceAway")}
        labels={parishLocatorLabels(t)}
        empty={
          query ? (
            <ListSearchNoResults action="/parishes" query={query} keep={keep} t={t} />
          ) : (
            <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
              {active === "all"
                ? "The parish directory will appear here as records are approved and published through the checklist-first worker."
                : `No ${active} records are published yet.`}
            </div>
          )
        }
        pagination={
          result.items.length > 0 ? (
            <Pagination
              basePath="/parishes"
              page={result.page}
              totalPages={result.pageCount}
              searchParams={{ ...keep, q: query || undefined }}
            />
          ) : null
        }
      />
    </div>
  );
}
