import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import { listPublishedDevotionsPaginated } from "@/lib/data/devotions";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devotions" };

export default async function DevotionsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const { t, locale } = await getTranslator();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  let result: Awaited<ReturnType<typeof listPublishedDevotionsPaginated>> = {
    items: [],
    total: 0,
    page,
    pageSize: 0,
    totalPages: 0,
  };
  try {
    result = await listPublishedDevotionsPaginated(locale, page);
  } catch (err) {
    logPageError({ route: "/devotions", entityType: "Devotion", error: err });
  }
  const { items: devotions, totalPages } = result;

  return (
    <div>
      <PageHero
        eyebrow={t("nav.devotions")}
        title={t("devotions.title")}
        subtitle={t("devotions.subtitle")}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {devotions.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            Devotion library will appear here as it is seeded and published.
          </div>
        ) : (
          devotions.map((d) => {
            const tr = d.translations[0];
            const title = tr?.title ?? d.title;
            const summary = tr?.summary ?? d.summary;
            return (
              <Link key={d.id} href={`/devotions/${d.slug}`}>
                <article className="vf-card h-full rounded-sm p-7 transition hover:border-ink/30 hover:-translate-y-0.5">
                  {d.durationMinutes ? <p className="vf-eyebrow">{d.durationMinutes} min</p> : null}
                  <h2 className="mt-3 font-display text-2xl">{title}</h2>
                  <p className="mt-4 line-clamp-4 font-serif text-ink-soft">{summary}</p>
                </article>
              </Link>
            );
          })
        )}
      </div>

      <Pagination basePath="/devotions" page={result.page} totalPages={totalPages} />
    </div>
  );
}
