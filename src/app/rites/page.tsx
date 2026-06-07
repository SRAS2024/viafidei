import Link from "next/link";

import { FilterChips, PageHero, PaginatedGrid } from "@/components/ui";
import { RITE_FILTERS } from "@/lib/content-shared/rite-categories";
import { applyPayloadFilter, resolvePayloadFilter } from "@/lib/content-shared/payload-filter";
import { listPublished } from "@/lib/data/published";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rites" };

export default async function RitesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const selected = resolvePayloadFilter(RITE_FILTERS, filter);
  const [all, selectedRite] = await Promise.all([listPublished("RITE"), getRiteCookieValue()]);
  const rites = applyPayloadFilter(RITE_FILTERS, all, selected.key);

  // Only offer a family chip when at least one rite falls under it.
  const present = new Set<string>();
  for (const f of RITE_FILTERS) {
    if (f.key === "all") continue;
    if (all.some((r) => f.matches(r.payload))) present.add(f.key);
  }

  return (
    <div>
      <PageHero
        eyebrow="The Catholic Church"
        title="Rites"
        subtitle="The liturgical traditions of the one Catholic Church — the Latin (Roman) Rite and the Eastern Catholic rites — each with its own history."
      />

      <FilterChips
        ariaLabel="Filter rites by family"
        activeKey={selected.key}
        className="mt-8 mb-6"
        items={RITE_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/rites" : `/rites?filter=${f.key}`,
        }))}
      />

      {rites.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          The Catholic rites will appear here as records are approved and published through the
          checklist-first worker.
        </div>
      ) : (
        <PaginatedGrid
          items={rites.map((r) => {
            const payload = r.payload as Record<string, unknown>;
            const history =
              (typeof payload.history === "string" && payload.history) ||
              (typeof payload.background === "string" && payload.background) ||
              "";
            const isSelected = payload.riteKey === selectedRite;
            return (
              <Link
                key={r.id}
                href={`/rites/${r.slug}`}
                className={`vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30 ${
                  isSelected ? "border-liturgical-gold" : ""
                }`}
              >
                {isSelected ? <p className="vf-eyebrow text-liturgical-gold">Your rite</p> : null}
                <h2 className="mt-2 break-words font-display text-xl sm:text-2xl">{r.title}</h2>
                {history ? (
                  <p className="mt-3 line-clamp-5 font-serif leading-relaxed text-ink-soft">
                    {history}
                  </p>
                ) : null}
              </Link>
            );
          })}
        />
      )}
    </div>
  );
}
