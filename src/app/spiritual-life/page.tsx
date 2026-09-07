import {
  FilterChips,
  LIST_PAGE_SIZE,
  PageHero,
  Pagination,
  PublishedList,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { SPIRITUAL_FILTERS } from "@/lib/content-shared/spiritual-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { countPublishedBySubtype, listPublished } from "@/lib/data/published";

/**
 * The stored `practiceKind` values behind each chip. `PublishedContent.subtype`
 * carries `practiceKind`, so chip presence is an indexed count rather than a
 * scan. Mirrors SPIRITUAL_FILTERS in content-shared/spiritual-categories.ts.
 */
const SPIRITUAL_FILTER_SUBTYPES: Readonly<Record<string, readonly string[]>> = {
  prayer: ["contemplative_prayer", "lectio_divina", "examen"],
  penance: ["fasting", "almsgiving", "mortification", "stations_of_the_cross"],
  pilgrimage: ["pilgrimage"],
  discernment: ["discernment", "vocation", "spiritual_direction"],
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Life" };

export default async function SpiritualLifePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { t } = await getTranslator();
  const { filter, page: pageParam } = await searchParams;
  const selected = resolvePayloadFilter(SPIRITUAL_FILTERS, filter);
  // Practice cards show the practice's summary from the payload, so the type
  // (a small, closed catalogue) is read whole and paged here.
  const [all, counts] = await Promise.all([
    listPublished("SPIRITUAL_PRACTICE"),
    countPublishedBySubtype("SPIRITUAL_PRACTICE").catch(() => ({}) as Record<string, number>),
  ]);
  const practices = applyPayloadFilter(SPIRITUAL_FILTERS, all, selected.key);
  const page = pageSlice(practices, parsePageParam(pageParam), LIST_PAGE_SIZE);

  // Only offer a category chip when at least one practice falls under it. The
  // indexed `practiceKind` counts answer that without scanning the payloads.
  const present = new Set<string>();
  for (const f of SPIRITUAL_FILTERS) {
    if (f.key === "all") continue;
    // Counts first (indexed); the payload check is the fail-open half — a
    // stored value this map has not learned yet must never HIDE a chip that
    // has published content behind it.
    if (
      SPIRITUAL_FILTER_SUBTYPES[f.key]?.some((v) => (counts[v] ?? 0) > 0) ||
      all.some((p) => f.matches(p.payload))
    ) {
      present.add(f.key);
    }
  }

  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />
      <FilterChips
        ariaLabel="Filter practices by kind"
        activeKey={selected.key}
        className="mt-8 mb-6"
        items={SPIRITUAL_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/spiritual-life" : `/spiritual-life?filter=${f.key}`,
        }))}
      />
      {page.items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No practices in this category yet.
        </div>
      ) : (
        <>
          {/* The eyebrow is the humanised practice kind — never `lectio_divina`. */}
          <PublishedList
            items={page.items}
            baseHref="/spiritual-life"
            eyebrowField="practiceKind"
          />
          <Pagination
            basePath="/spiritual-life"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ filter: selected.key === "all" ? undefined : selected.key }}
          />
        </>
      )}
    </div>
  );
}
