import {
  FilterChips,
  LIST_PAGE_SIZE,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
  PublishedList,
  entryPayload,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import {
  GUIDE_FILTERS,
  GUIDE_FILTER_SUBTYPES,
  guideEyebrow,
} from "@/lib/content-shared/guide-categories";
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { countPublishedBySubtype, listPublished } from "@/lib/data/published";
import { getTranslator } from "@/lib/i18n/server";
import { localizeItems } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guides" };

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = resolvePayloadFilter(GUIDE_FILTERS, filter);
  // Guide cards show the guide's own `summary`, which the payload-free
  // projection does not carry, so the catalogue (bounded at ~100 guides) is
  // still read whole and paged here — only one page of cards is rendered.
  const [all, counts] = await Promise.all([
    listPublished("GUIDE"),
    countPublishedBySubtype("GUIDE").catch(() => ({}) as Record<string, number>),
  ]);
  const guides = applyPayloadFilter(GUIDE_FILTERS, all, selected.key);
  // Searched by title, the kind on the card ("Lent", "Confession") and the summary.
  const visible = query
    ? rankBySearch(guides, query, (g) => publishedSearchFields(g, [guideEyebrow(g.payload)]))
    : guides;
  const page = pageSlice(visible, parsePageParam(pageParam), LIST_PAGE_SIZE);
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  // Only offer a category chip when at least one guide falls under it. The
  // indexed `kind` counts answer most chips without a scan; the chips whose
  // membership also depends on `category`/`sacramentKey` fall back to the
  // payload, which is already loaded here.
  const hasContent = (key: string): boolean =>
    (GUIDE_FILTER_SUBTYPES[key] ?? []).some((value) => (counts[value] ?? 0) > 0) ||
    all.some((g) => GUIDE_FILTERS.find((f) => f.key === key)?.matches(g.payload));

  return (
    <div>
      <PageHero
        eyebrow="How to pray & practice"
        title="Guides"
        subtitle="Step-by-step guides to the Rosary, the Divine Mercy Chaplet, Confession, and the spiritual life — steps first, then each prayer in a dropdown."
      />
      <ListSearch
        action="/guides"
        query={query}
        label={t("listSearch.guides")}
        keep={keep}
        resultCount={visible.length}
        t={t}
        locale={locale}
      />
      <FilterChips
        ariaLabel="Filter guides by kind"
        activeKey={selected.key}
        className="mb-6"
        items={GUIDE_FILTERS.filter((f) => f.key === "all" || hasContent(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: listHref("/guides", { filter: f.key === "all" ? undefined : f.key, q: query }),
        }))}
      />
      {page.items.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/guides" query={query} keep={keep} t={t} />
        ) : (
          <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
            No guides in this category yet.
          </div>
        )
      ) : (
        <>
          {/* The eyebrow is the human label for the guide's kind — never the
              stored enum (`lent_preparation`, `rcia`, `general`). */}
          <PublishedList
            items={await localizeItems(page.items, { depth: "card" })}
            baseHref="/guides"
            eyebrowFor={(item) => guideEyebrow(entryPayload(item))}
          />
          <Pagination
            basePath="/guides"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ ...keep, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}
