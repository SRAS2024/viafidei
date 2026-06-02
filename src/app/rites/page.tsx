import Link from "next/link";

import { PageHero, PaginatedGrid } from "@/components/ui";
import { listPublished } from "@/lib/data/published";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rites" };

export default async function RitesPage() {
  const [rites, selectedRite] = await Promise.all([listPublished("RITE"), getRiteCookieValue()]);

  return (
    <div>
      <PageHero
        eyebrow="The Catholic Church"
        title="Rites"
        subtitle="The liturgical traditions of the one Catholic Church — the Latin (Roman) Rite and the Eastern Catholic rites — each with its own history."
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
