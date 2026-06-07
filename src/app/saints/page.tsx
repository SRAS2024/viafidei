import { FilterChips, PageHero, PublishedList } from "@/components/ui";
import { compareSaintsChronologically, saintEyebrow } from "@/lib/content-shared/saints";
import { SAINT_FILTERS } from "@/lib/content-shared/saint-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saints" };

export default async function SaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { t } = await getTranslator();
  const { filter } = await searchParams;
  const selected = resolvePayloadFilter(SAINT_FILTERS, filter);
  const all = await listPublished("SAINT");
  const items = applyPayloadFilter(SAINT_FILTERS, all, selected.key);

  // Only offer a category chip when at least one saint falls under it.
  const present = new Set<string>();
  for (const f of SAINT_FILTERS) {
    if (f.key === "all") continue;
    if (all.some((s) => f.matches(s.payload))) present.add(f.key);
  }

  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />
      <FilterChips
        ariaLabel="Filter saints by category"
        activeKey={selected.key}
        className="mt-8 mb-6"
        items={SAINT_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/saints" : `/saints?filter=${f.key}`,
        }))}
      />
      {items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No saints in this category yet.
        </div>
      ) : (
        /* Earliest saints first (Apostles → modern), each tagged with its strict title. */
        <PublishedList
          items={items}
          baseHref="/saints"
          sortItems={compareSaintsChronologically}
          eyebrowFor={(item) => saintEyebrow(item.payload)}
        />
      )}
    </div>
  );
}
