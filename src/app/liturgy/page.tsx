import {
  FilterChips,
  LIST_PAGE_SIZE,
  ListControls,
  ListSearch,
  ListSearchNoResults,
  PageHero,
  Pagination,
  PublishedList,
  entryPayload,
  pageSlice,
  parsePageParam,
  type PublishedListEntry,
} from "@/components/ui";
import { formatEnumValue } from "@/lib/content-shared/field-presenters";
import { LITURGICAL_FILTERS } from "@/lib/content-shared/liturgical-categories";
import {
  LITURGY_SECTIONS,
  groupLiturgySections,
  sortLiturgyForDisplay,
} from "@/lib/content-shared/liturgy-order";
import {
  listHref,
  parseSearchQuery,
  publishedSearchFields,
  rankBySearch,
} from "@/lib/content-shared/list-search";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { countPublishedBySubtype, listPublished } from "@/lib/data/published";
import { localizeItems } from "@/lib/translation/localize";

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

/**
 * Stored kinds that are filing terms, not names a reader would give the entry:
 * Ash Wednesday is no "Liturgical season", nor the Rite of Baptism a "Mass
 * structure". A title and its section already say what these are.
 */
const KINDS_WITH_NO_LABEL: ReadonlySet<string> = new Set([
  "liturgical_season",
  "liturgical_year",
  "mass_structure",
  "marriage_rite",
  "funeral_rite",
  "ordination_rite",
]);

/** The rank or kind under a title, humanised: never the stored value. */
function kindLabel(payload: Record<string, unknown>): string | undefined {
  const kind = payload.kind;
  if (typeof kind !== "string" || !kind.trim() || KINDS_WITH_NO_LABEL.has(kind)) return undefined;
  return formatEnumValue("kind", kind);
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgy" };

export default async function LiturgyPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; q?: string | string[] }>;
}) {
  const { t, locale } = await getTranslator();
  const { filter, page: pageParam, q: rawQuery } = await searchParams;
  const query = parseSearchQuery(rawQuery);
  const selected = resolvePayloadFilter(LITURGICAL_FILTERS, filter);
  // Liturgy cards show the entry's summary from the payload, so the type is
  // read whole and paged here.
  const [all, counts] = await Promise.all([
    listPublished("LITURGICAL"),
    countPublishedBySubtype("LITURGICAL").catch(() => ({}) as Record<string, number>),
  ]);
  const items = applyPayloadFilter(LITURGICAL_FILTERS, sortLiturgyForDisplay(all), selected.key);
  const visible = query ? rankBySearch(items, query, (i) => publishedSearchFields(i)) : items;
  const page = pageSlice(visible, parsePageParam(pageParam), LIST_PAGE_SIZE);
  const keep = { filter: selected.key === "all" ? undefined : selected.key };

  // Only offer a category chip when at least one item falls under it — the
  // indexed `kind` counts, not a scan of every published payload. The chips run
  // in the same order as the page's sections.
  const present = new Set<string>();
  for (const f of LITURGY_SECTIONS) {
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
  const chips = [
    { key: "all", label: resolvePayloadFilter(LITURGICAL_FILTERS, "all").label },
    ...LITURGY_SECTIONS.filter((f) => present.has(f.key)),
  ];

  const cards = await localizeItems(page.items, { depth: "card" });
  // The whole collection reads section by section. A filter is one section, and
  // a search is its best matches first, so neither needs headings.
  const sections = selected.key === "all" && !query ? groupLiturgySections(cards) : null;
  const listProps = {
    baseHref: "/liturgy-history",
    eyebrowFor: (item: PublishedListEntry) => kindLabel(entryPayload(item)),
    action: t("common.open"),
  };

  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgy")}
        title={t("liturgy.title")}
        subtitle={t("liturgy.subtitle")}
      />
      <ListControls>
        <ListSearch
          action="/liturgy"
          query={query}
          label={t("listSearch.liturgy")}
          keep={keep}
          resultCount={visible.length}
          t={t}
          locale={locale}
        />
        <FilterChips
          ariaLabel="Filter liturgy by kind"
          activeKey={selected.key}
          items={chips.map((f) => ({
            key: f.key,
            label: f.label,
            href: listHref("/liturgy", { filter: f.key === "all" ? undefined : f.key, q: query }),
          }))}
        />
      </ListControls>
      {page.items.length === 0 ? (
        query ? (
          <ListSearchNoResults action="/liturgy" query={query} keep={keep} t={t} />
        ) : (
          <div className="vf-card rounded-sm px-6 py-8 text-center font-serif text-ink-soft">
            No liturgy entries in this category yet.
          </div>
        )
      ) : (
        <>
          {sections ? (
            <div className="vf-stack-section">
              {sections.map((section) => (
                <section key={section.key}>
                  {section.label ? (
                    <div className="vf-section-head">
                      <h2 className="vf-section-title">{section.label}</h2>
                    </div>
                  ) : null}
                  <PublishedList items={section.items} titleAs="h3" {...listProps} />
                </section>
              ))}
            </div>
          ) : (
            <PublishedList items={cards} {...listProps} />
          )}
          <Pagination
            basePath="/liturgy"
            page={page.page}
            totalPages={page.pageCount}
            searchParams={{ ...keep, q: query || undefined }}
          />
        </>
      )}
    </div>
  );
}
