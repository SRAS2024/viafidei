import Link from "next/link";

import { PageHero } from "@/components/ui";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parishes" };

const DESIGNATION_LABEL: Record<string, string> = {
  parish: "Parish",
  shrine: "Shrine",
  cathedral: "Cathedral",
  "major-basilica": "Major Basilica",
  "minor-basilica": "Minor Basilica",
};

export default async function ParishesPage() {
  const parishes = await listPublished("PARISH");

  return (
    <div>
      <PageHero
        eyebrow="Find a parish"
        title="Parishes"
        subtitle="Catholic parishes, shrines, cathedrals, and basilicas."
      />

      {parishes.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          The parish directory will appear here as records are approved and published through the
          checklist-first worker.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parishes.map((p) => {
            const payload = p.payload as Record<string, unknown>;
            const designation = String(payload.designation ?? "parish");
            const location = [payload.address, payload.city, payload.state]
              .map((v) => (typeof v === "string" ? v.trim() : ""))
              .filter(Boolean)
              .join(", ");
            return (
              <li key={p.id}>
                <Link
                  href={`/parishes/${p.slug}`}
                  className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
                >
                  <p className="vf-eyebrow">{DESIGNATION_LABEL[designation] ?? "Parish"}</p>
                  <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
                  {location ? (
                    <p className="mt-3 font-serif leading-relaxed text-ink-soft">{location}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
