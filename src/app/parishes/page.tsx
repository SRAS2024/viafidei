import { FilterChips, LIST_PAGE_SIZE, PageHero, Pagination, parsePageParam } from "@/components/ui";
import { countPublishedBySubtype, listParishPage } from "@/lib/data/published";
import { PARISH_FILTERS, resolveParishFilter } from "@/lib/content-shared/parish";

import { ParishLocator } from "./ParishLocator";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parishes" };

/**
 * The stored `designation` values behind each classification chip. The
 * directory filters and counts on the indexed `subtype` column, which carries
 * the designation verbatim, so "Basilicas" has to name both stored forms.
 */
const PARISH_FILTER_SUBTYPES: Readonly<Record<string, readonly string[]>> = {
  parish: ["parish"],
  cathedral: ["cathedral"],
  basilica: ["major-basilica", "minor-basilica", "basilica"],
  shrine: ["shrine"],
};

export default async function ParishesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; q?: string; page?: string }>;
}) {
  const { class: classParam, q: rawQuery, page: pageParam } = await searchParams;
  const active = resolveParishFilter(classParam);
  const query = (rawQuery ?? "").trim();

  // One page of the directory, filtered and counted in SQL. The page used to
  // load every published parish and hand the whole array to a client
  // component; the directory is heading for 200,000 records, so it now ships
  // thirty projected rows and nothing else.
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

  const chipParams = (key: string) => {
    const params = new URLSearchParams();
    if (key !== "all") params.set("class", key);
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `/parishes?${qs}` : "/parishes";
  };

  return (
    <div>
      <PageHero
        eyebrow="Find a parish"
        title="Parishes"
        subtitle="Catholic parishes, shrines, cathedrals, and basilicas — use your location to find the nearest."
      />

      {/* A plain GET form: searching is a real URL, so a result page can be
          linked, bookmarked, and crawled. */}
      <form method="get" action="/parishes" className="mb-6 flex justify-center gap-2">
        {active === "all" ? null : <input type="hidden" name="class" value={active} />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name"
          aria-label="Search parishes by name"
          className="w-full max-w-sm rounded-sm border border-ink/20 bg-paper-bright px-3 py-1.5 font-serif text-sm text-ink placeholder:text-ink-faint"
        />
        <button type="submit" className="vf-btn">
          Search
        </button>
      </form>

      <FilterChips
        ariaLabel="Filter by classification"
        activeKey={active}
        className="mb-6"
        items={PARISH_FILTERS.filter((f) => f.key === "all" || hasContent(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: chipParams(f.key),
        }))}
      />

      {result.items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          {query
            ? `No parishes match “${query}”.`
            : active === "all"
              ? "The parish directory will appear here as records are approved and published through the checklist-first worker."
              : `No ${active} records are published yet.`}
        </div>
      ) : (
        <>
          <ParishLocator parishes={result.items} total={result.total} />
          <Pagination
            basePath="/parishes"
            page={result.page}
            totalPages={result.pageCount}
            searchParams={{ class: active === "all" ? undefined : active, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}
