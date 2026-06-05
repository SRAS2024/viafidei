import { PageHero } from "@/components/ui";
import { listPublished } from "@/lib/data/published";

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

export default async function ParishesPage() {
  const parishes = await listPublished("PARISH");

  const cards: ParishCard[] = parishes.map((p) => {
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

      {cards.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          The parish directory will appear here as records are approved and published through the
          checklist-first worker.
        </div>
      ) : (
        <ParishLocator parishes={cards} />
      )}
    </div>
  );
}
