import Link from "next/link";

import { PageHero, PaginatedGrid } from "@/components/ui";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Popes" };

function startYear(payload: Record<string, unknown>): number {
  const m = String(payload.papacyStart ?? "").match(/\d{1,4}/);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
}

function reignLabel(payload: Record<string, unknown>): string {
  const start = String(payload.papacyStart ?? "").trim();
  const end = String(payload.papacyEnd ?? "").trim();
  if (!start) return "";
  return `${start}–${end || "Present"}`;
}

export default async function PopesPage() {
  const popes = await listPublished("POPE");
  // Chronological order, earliest pontificate first.
  const ordered = [...popes].sort(
    (a, b) =>
      startYear(a.payload as Record<string, unknown>) -
      startYear(b.payload as Record<string, unknown>),
  );

  return (
    <div>
      <PageHero
        eyebrow="The Roman Pontiffs"
        title="Popes"
        subtitle="The successors of Saint Peter, in chronological order."
      />

      {ordered.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          The chronological list of popes will appear here as records are approved and published
          through the checklist-first worker.
        </div>
      ) : (
        <PaginatedGrid
          items={ordered.map((p) => {
            const reign = reignLabel(p.payload as Record<string, unknown>);
            return (
              <Link
                key={p.id}
                href={`/popes/${p.slug}`}
                className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
              >
                {reign ? <p className="vf-eyebrow">{reign}</p> : null}
                <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
              </Link>
            );
          })}
        />
      )}
    </div>
  );
}
