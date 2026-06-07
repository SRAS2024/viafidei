import { FilterChips, PageHero, PublishedList } from "@/components/ui";
import { SPIRITUAL_FILTERS } from "@/lib/content-shared/spiritual-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Life" };

export default async function SpiritualLifePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { t } = await getTranslator();
  const { filter } = await searchParams;
  const selected = resolvePayloadFilter(SPIRITUAL_FILTERS, filter);
  const all = await listPublished("SPIRITUAL_PRACTICE");
  const practices = applyPayloadFilter(SPIRITUAL_FILTERS, all, selected.key);

  // Only offer a category chip when at least one practice falls under it.
  const present = new Set<string>();
  for (const f of SPIRITUAL_FILTERS) {
    if (f.key === "all") continue;
    if (all.some((p) => f.matches(p.payload))) present.add(f.key);
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
      {practices.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No practices in this category yet.
        </div>
      ) : (
        <PublishedList items={practices} baseHref="/spiritual-life" eyebrowField="practiceKind" />
      )}
    </div>
  );
}
