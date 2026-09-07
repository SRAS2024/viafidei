import {
  FilterChips,
  LIST_PAGE_SIZE,
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
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { countPublishedBySubtype, listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guides" };

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter, page: pageParam } = await searchParams;
  const selected = resolvePayloadFilter(GUIDE_FILTERS, filter);
  // Guide cards show the guide's own `summary`, which the payload-free
  // projection does not carry, so the catalogue (bounded at ~100 guides) is
  // still read whole and paged here — only one page of cards is rendered.
  const [all, counts] = await Promise.all([
    listPublished("GUIDE"),
    countPublishedBySubtype("GUIDE").catch(() => ({}) as Record<string, number>),
  ]);
  const guides = applyPayloadFilter(GUIDE_FILTERS, all, selected.key);
  const page = pageSlice(guides, parsePageParam(pageParam), LIST_PAGE_SIZE);

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
      <FilterChips
        ariaLabel="Filter guides by kind"
        activeKey={selected.key}
        className="mt-8 mb-6"
        items={GUIDE_FILTERS.filter((f) => f.key === "all" || hasContent(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/guides" : `/guides?filter=${f.key}`,
        }))}
      />
      {page.items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No guides in this category yet.
        </div>
      ) : (
        <>
          {/* The eyebrow is the human label for the guide's kind — never the
              stored enum (`lent_preparation`, `rcia`, `general`). */}
          <PublishedList
            items={page.items}
            baseHref="/guides"
            eyebrowFor={(item) => guideEyebrow(entryPayload(item))}
          />
          <Pagination
            basePath="/guides"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ filter: selected.key === "all" ? undefined : selected.key }}
          />
        </>
      )}
    </div>
  );
}
