import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import { listPublishedSpiritualLifeGuidesPaginated } from "@/lib/data/spiritual-life";
import { FORMATION_ITEMS, FormationCard } from "./_components";
import { logger } from "@/lib/observability/logger";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { filterByRite } from "@/lib/content/rites";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Life" };

export default async function SpiritualLifePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { t, locale } = await getTranslator();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  let result: Awaited<ReturnType<typeof listPublishedSpiritualLifeGuidesPaginated>> = {
    items: [],
    total: 0,
    page,
    pageSize: 0,
    totalPages: 0,
  };
  try {
    result = await listPublishedSpiritualLifeGuidesPaginated(locale, page);
  } catch (err) {
    logger.error("spiritual_life.list_failed", { error: (err as Error).message });
  }
  const rite = await getRiteCookieValue();
  const guides = filterByRite(result.items, rite);
  const { totalPages } = result;

  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />

      {guides.length > 0 ? (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            {guides.map((g) => {
              const tr = g.translations[0];
              const title = tr?.title ?? g.title;
              const summary = tr?.summary ?? g.summary;
              const staticItem = FORMATION_ITEMS.find((item) => item.id === g.kind.toLowerCase());
              return (
                <Link key={g.id} href={`/spiritual-life/${g.slug}`}>
                  <article
                    id={g.slug}
                    className="vf-card flex h-full flex-col rounded-sm p-8 transition hover:border-ink/30 hover:-translate-y-0.5"
                  >
                    {staticItem ? (
                      <div
                        className={`mb-4 ${staticItem.tone === "marian" ? "vf-icon-marian" : staticItem.tone === "eucharist" ? "vf-icon-eucharist" : "text-ink"}`}
                      >
                        {staticItem.icon}
                      </div>
                    ) : null}
                    <p className="vf-eyebrow">
                      {g.durationDays ? `${g.durationDays}-day journey` : "Formation"}
                    </p>
                    <h2 className="mt-3 font-display text-3xl">{title}</h2>
                    <p className="mt-4 flex-1 line-clamp-3 font-serif leading-relaxed text-ink-soft">
                      {summary}
                    </p>
                  </article>
                </Link>
              );
            })}
          </div>
          <Pagination basePath="/spiritual-life" page={result.page} totalPages={totalPages} />
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {FORMATION_ITEMS.map((item) => (
            <FormationCard key={item.id} item={item} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
