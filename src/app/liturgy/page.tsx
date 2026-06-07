import { FilterChips, PageHero, PublishedList } from "@/components/ui";
import { LITURGICAL_FILTERS } from "@/lib/content-shared/liturgical-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgy" };

export default async function LiturgyPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { t } = await getTranslator();
  const { filter } = await searchParams;
  const selected = resolvePayloadFilter(LITURGICAL_FILTERS, filter);
  const all = await listPublished("LITURGICAL");
  const items = applyPayloadFilter(LITURGICAL_FILTERS, all, selected.key);

  // Only offer a category chip when at least one item falls under it.
  const present = new Set<string>();
  for (const f of LITURGICAL_FILTERS) {
    if (f.key === "all") continue;
    if (all.some((i) => f.matches(i.payload))) present.add(f.key);
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
      {items.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No liturgy entries in this category yet.
        </div>
      ) : (
        <PublishedList items={items} baseHref="/liturgy-history" eyebrowField="kind" />
      )}
    </div>
  );
}
