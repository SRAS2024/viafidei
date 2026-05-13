import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import { listPublishedPrayersPaginated } from "@/lib/data/prayers";
import { logPageError } from "@/lib/observability/page-errors";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { filterByRite } from "@/lib/content/rites";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prayers" };

const PRAYER_CATEGORIES = [
  "prayers.category.marian",
  "prayers.category.christ",
  "prayers.category.angelic",
  "prayers.category.sacramental",
  "prayers.category.seasonal",
  "prayers.category.daily",
] as const;

export default async function PrayersPage({ searchParams }: { searchParams: { page?: string } }) {
  const { t, locale } = await getTranslator();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  let result: Awaited<ReturnType<typeof listPublishedPrayersPaginated>> = {
    items: [],
    total: 0,
    page,
    pageSize: 0,
    totalPages: 0,
  };
  try {
    result = await listPublishedPrayersPaginated(locale, page);
  } catch (err) {
    logPageError({ route: "/prayers", entityType: "Prayer", error: err });
  }
  // Drop prayers tagged for a different Catholic rite (e.g. a slug
  // containing "byzantine" when the user is reading the Roman Rite).
  // Rite-neutral prayers (no marker in the slug) are always kept.
  const rite = await getRiteCookieValue();
  const prayers = filterByRite(result.items, rite);
  const { total, totalPages } = result;

  return (
    <div>
      <PageHero
        eyebrow={t("nav.prayers")}
        title={t("prayers.title")}
        subtitle={t("prayers.subtitle")}
      />

      <div className="mb-12 flex flex-wrap justify-center gap-2">
        {PRAYER_CATEGORIES.map((c) => (
          <span key={c} className="vf-btn vf-btn-ghost !py-2 !px-4 text-[0.65rem]">
            {t(c)}
          </span>
        ))}
      </div>

      {total > 0 && (
        <p className="mb-6 text-center font-serif text-sm text-ink-faint">
          {total} {total === 1 ? "prayer" : "prayers"}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {prayers.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            The prayer library will appear here as it is seeded and published.
          </div>
        ) : (
          prayers.map((p) => {
            const tr = p.translations[0];
            const title = tr?.title ?? p.defaultTitle;
            const body = tr?.body ?? p.body;
            return (
              <Link key={p.id} href={`/prayers/${p.slug}`}>
                <article className="vf-card h-full rounded-sm p-7 transition hover:border-ink/30 hover:-translate-y-0.5">
                  <p className="vf-eyebrow">{p.category}</p>
                  <h2 className="mt-3 font-display text-2xl">{title}</h2>
                  <p className="mt-4 line-clamp-5 font-serif text-ink-soft">{body}</p>
                </article>
              </Link>
            );
          })
        )}
      </div>

      <Pagination basePath="/prayers" page={page} totalPages={totalPages} />
    </div>
  );
}
