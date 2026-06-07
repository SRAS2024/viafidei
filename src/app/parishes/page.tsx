import { FilterChips, PageHero } from "@/components/ui";
import { listPublished } from "@/lib/data/published";
import {
  PARISH_FILTERS,
  parishMatchesFilter,
  resolveParishFilter,
} from "@/lib/content-shared/parish";

import { ParishLocator, type ParishCard } from "./ParishLocator";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parishes" };

const DESIGNATION_LABEL: Record<string, string> = {
  parish: "Parish",
  shrine: "Shrine",
  cathedral: "Cathedral",
  "major-basilica": "Major Basilica",
  "minor-basilica": "Minor Basilica",
};

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export default async function ParishesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { class: classParam } = await searchParams;
  const active = resolveParishFilter(classParam);
  const parishes = await listPublished("PARISH");

  // Only offer a classification chip when at least one record falls under it.
  const present = new Set<string>();
  for (const f of PARISH_FILTERS) {
    if (f.key === "all") continue;
    if (
      parishes.some((p) =>
        parishMatchesFilter((p.payload as Record<string, unknown>).designation, f.key),
      )
    )
      present.add(f.key);
  }

  const cards: ParishCard[] = parishes
    .filter((p) => parishMatchesFilter((p.payload as Record<string, unknown>).designation, active))
    .map((p) => {
      const payload = p.payload as Record<string, unknown>;
      const designation = String(payload.designation ?? "parish");
      const location = [payload.address, payload.city, payload.state]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean)
        .join(", ");
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        designationLabel: DESIGNATION_LABEL[designation] ?? "Parish",
        location,
        latitude: asNumber(payload.latitude),
        longitude: asNumber(payload.longitude),
      };
    });

  return (
    <div>
      <PageHero
        eyebrow="Find a parish"
        title="Parishes"
        subtitle="Catholic parishes, shrines, cathedrals, and basilicas — use your location to find the nearest."
      />

      <FilterChips
        ariaLabel="Filter by classification"
        activeKey={active}
        className="mb-6"
        items={PARISH_FILTERS.filter((f) => f.key === "all" || present.has(f.key)).map((f) => ({
          key: f.key,
          label: f.label,
          href: f.key === "all" ? "/parishes" : `/parishes?class=${f.key}`,
        }))}
      />

      {cards.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          {active === "all"
            ? "The parish directory will appear here as records are approved and published through the checklist-first worker."
            : `No ${active} records are published yet.`}
        </div>
      ) : (
        <ParishLocator parishes={cards} />
      )}
    </div>
  );
}
