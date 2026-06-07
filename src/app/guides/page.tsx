import { FilterChips, PageHero, PublishedList } from "@/components/ui";
import { GUIDE_FILTERS } from "@/lib/content-shared/guide-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guides" };

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const selected = resolvePayloadFilter(GUIDE_FILTERS, filter);
  const all = await listPublished("GUIDE");
  const guides = applyPayloadFilter(GUIDE_FILTERS, all, selected.key);

  // Only offer a category chip when at least one guide falls under it.
  const present = new Set<string>();
  for (const f of GUIDE_FILTERS) {
    if (f.key === "all") continue;
    if (all.some((g) => f.matches(g.payload))) present.add(f.key);
  }

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
        items={GUIDE_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/guides" : `/guides?filter=${f.key}`,
        }))}
      />
      {guides.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          No guides in this category yet.
        </div>
      ) : (
        <PublishedList items={guides} baseHref="/guides" eyebrowField="kind" />
      )}
    </div>
  );
}
