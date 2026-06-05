import Link from "next/link";

import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { PaginatedGrid } from "@/components/ui/PaginatedGrid";
import { listPublished } from "@/lib/data/published";
import { categorizePrayer } from "@/lib/content-shared/prayer-categories";

export const dynamic = "force-dynamic";
export const metadata = { title: "Litanies" };

export default async function LitaniesPage() {
  const { t } = await getTranslator();
  const prayers = await listPublished("PRAYER");

  // Litanies are prayers categorised as "litany" — a sustained sequence of
  // invocations and responses. The Admin Worker fills them as it builds the
  // prayer library; this tab is the curated view of them.
  const litanies = prayers.filter(
    (p) =>
      categorizePrayer({
        title: p.title,
        prayerType: p.payload.prayerType as string | undefined,
        body: (p.payload.body ?? p.payload.prayerText) as string | undefined,
        category: p.payload.category as string | undefined,
      }) === "litany",
  );

  return (
    <div>
      <PageHero
        eyebrow={t("litanies.eyebrow")}
        title={t("litanies.title")}
        subtitle={t("litanies.subtitle")}
      />

      {litanies.length === 0 ? (
        <div className="vf-card rounded-sm p-10 text-center font-serif text-ink-faint">
          {t("litanies.empty")}
        </div>
      ) : (
        <PaginatedGrid
          items={litanies.map((p) => {
            const body = (p.payload.body ?? p.payload.prayerText ?? "") as string;
            return (
              <Link key={p.id} href={`/prayers/${p.slug}`} className="block h-full">
                <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30 sm:p-7">
                  <p className="vf-eyebrow">Litany</p>
                  <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
                  {body ? (
                    <p className="mt-4 line-clamp-5 font-serif leading-relaxed text-ink-soft">
                      {body}
                    </p>
                  ) : null}
                </article>
              </Link>
            );
          })}
        />
      )}
    </div>
  );
}
