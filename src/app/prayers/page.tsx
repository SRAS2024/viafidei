import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { Pagination } from "@/components/ui/Pagination";
import {
  listPublishedPrayersPaginated,
  resolvePrayerCategory,
} from "@/lib/data/prayers";
import { logPageError } from "@/lib/observability/page-errors";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { filterByRite } from "@/lib/content/rites";
import {
  PRAYER_CATEGORY_ORDER,
  type PrayerCategory,
} from "@/lib/ingestion/sources/categorize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prayers" };

// Filter chips rendered above the prayer grid. Each chip is a real link
// — selecting one re-renders the page with the chosen category and the
// SQL/JS filter below shows only prayers whose canonical category
// matches.
const PRAYER_CATEGORY_LABELS: Record<PrayerCategory, string> = {
  Marian: "Marian",
  Christ: "Christ-centered",
  Angelic: "Angelic",
  Eucharistic: "Eucharistic",
  Sacramental: "Sacramental",
  Rosary: "Rosary",
  Chaplet: "Chaplets",
  Novena: "Novenas",
  Litany: "Litanies",
  Liturgical: "Liturgical",
  Seasonal: "Seasonal",
  Daily: "Daily",
  Dominical: "Lord's Prayer",
  Traditional: "Traditional",
};

function parseFilter(raw: string | undefined): PrayerCategory | undefined {
  if (!raw) return undefined;
  return PRAYER_CATEGORY_ORDER.find((c) => c === raw);
}

type Props = { searchParams: { page?: string; filter?: string } };

export default async function PrayersPage({ searchParams }: Props) {
  const { t, locale } = await getTranslator();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const filter = parseFilter(searchParams.filter);
  let result: Awaited<ReturnType<typeof listPublishedPrayersPaginated>> = {
    items: [],
    total: 0,
    page,
    pageSize: 0,
    totalPages: 0,
  };
  try {
    result = await listPublishedPrayersPaginated(locale, page, undefined, filter);
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

      <div className="mb-8 flex flex-wrap justify-center gap-2 px-2">
        <Link
          href="/prayers"
          aria-current={filter === undefined ? "page" : undefined}
          className={`vf-btn !py-1.5 !px-4 text-xs ${
            filter === undefined ? "vf-btn-primary" : "vf-btn-ghost"
          }`}
        >
          All
        </Link>
        {PRAYER_CATEGORY_ORDER.map((c) => {
          const active = c === filter;
          return (
            <Link
              key={c}
              href={`/prayers?filter=${encodeURIComponent(c)}`}
              aria-current={active ? "page" : undefined}
              className={`vf-btn !py-1.5 !px-4 text-xs ${
                active ? "vf-btn-primary" : "vf-btn-ghost"
              }`}
            >
              {PRAYER_CATEGORY_LABELS[c]}
            </Link>
          );
        })}
      </div>

      {total > 0 && (
        <p className="mb-6 text-center font-serif text-sm text-ink-faint">
          {total} {total === 1 ? "prayer" : "prayers"}
          {filter ? ` · ${PRAYER_CATEGORY_LABELS[filter]}` : ""}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {prayers.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            {filter
              ? `No ${PRAYER_CATEGORY_LABELS[filter]} prayers have been published yet.`
              : "The prayer library will appear here as it is seeded and published."}
          </div>
        ) : (
          prayers.map((p) => {
            const tr = p.translations[0];
            const title = tr?.title ?? p.defaultTitle;
            const body = tr?.body ?? p.body;
            const resolved = resolvePrayerCategory(p);
            return (
              <Link key={p.id} href={`/prayers/${p.slug}`}>
                <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:border-ink/30 hover:-translate-y-0.5 sm:p-7">
                  <p className="vf-eyebrow">{PRAYER_CATEGORY_LABELS[resolved]}</p>
                  <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">
                    {title}
                  </h2>
                  <p className="mt-4 line-clamp-5 font-serif leading-relaxed text-ink-soft">
                    {body}
                  </p>
                </article>
              </Link>
            );
          })
        )}
      </div>

      <Pagination
        basePath="/prayers"
        page={page}
        totalPages={totalPages}
        searchParams={filter ? { filter } : undefined}
      />
    </div>
  );
}
