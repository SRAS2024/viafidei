import {
  FilterChips,
  LIST_PAGE_SIZE,
  PageHero,
  Pagination,
  PublishedList,
  pageSlice,
  parsePageParam,
} from "@/components/ui";
import { LITURGICAL_FILTERS } from "@/lib/content-shared/liturgical-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { countPublishedBySubtype, listPublished } from "@/lib/data/published";

/**
 * The stored `kind` values behind each chip. `PublishedContent.subtype` carries
 * a LITURGICAL row's `kind`, so chip presence is an indexed count rather than a
 * scan. Mirrors LITURGICAL_FILTERS in content-shared/liturgical-categories.ts.
 */
const LITURGICAL_FILTER_SUBTYPES: Readonly<Record<string, readonly string[]>> = {
  feasts: ["feast", "solemnity"],
  memorials: ["memorial", "optional_memorial"],
  seasons: ["liturgical_season", "liturgical_year"],
  "mass-rites": ["mass_structure", "marriage_rite", "funeral_rite", "ordination_rite"],
  explained: ["council_event", "symbolism", "glossary_term"],
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgy" };

export default async function LiturgyPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { t } = await getTranslator();
  const { filter, page: pageParam } = await searchParams;
  const selected = resolvePayloadFilter(LITURGICAL_FILTERS, filter);
  // Liturgy cards show the entry's summary from the payload, so the type is
  // read whole and paged here.
  const [all, counts] = await Promise.all([
    listPublished("LITURGICAL"),
    countPublishedBySubtype("LITURGICAL").catch(() => ({}) as Record<string, number>),
  ]);
  const items = applyPayloadFilter(LITURGICAL_FILTERS, all, selected.key);
  const page = pageSlice(items, parsePageParam(pageParam), LIST_PAGE_SIZE);

  // Only offer a category chip when at least one item falls under it — the
  // indexed `kind` counts, not a scan of every published payload.
  const present = new Set<string>();
  for (const f of LITURGICAL_FILTERS) {
    if (f.key === "all") continue;
    // Counts first (indexed); the payload check is the fail-open half — a
    // stored value this map has not learned yet must never HIDE a chip that
    // has published content behind it.
    if (
      LITURGICAL_FILTER_SUBTYPES[f.key]?.some((v) => (counts[v] ?? 0) > 0) ||
      all.some((i) => f.matches(i.payload))
    ) {
      present.add(f.key);
    }
  }

  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgy")}
        title={t("liturgy.title")}
        subtitle={t("liturgy.subtitle")}
      />
      <FilterChips
        ariaLabel="Filter liturgy by kind"
        activeKey={selected.key}
        className="mt-8 mb-6"
        items={LITURGICAL_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/liturgy" : `/liturgy?filter=${f.key}`,
        }))}
      />
      {page.items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No liturgy entries in this category yet.
        </div>
      ) : (
        <>
          {/* The eyebrow is the humanised kind — never `liturgical_season`. */}
          <PublishedList items={page.items} baseHref="/liturgy-history" eyebrowField="kind" />
          <Pagination
            basePath="/liturgy"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ filter: selected.key === "all" ? undefined : selected.key }}
          />
        </>
      )}
    </div>
  );
}
