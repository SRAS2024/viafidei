import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedDevotions } from "@/lib/data/devotions";

export const revalidate = 3600;
export const metadata = { title: "Devotions" };

export default async function DevotionsPage() {
  const { t, locale } = await getTranslator();
  const devotions = await listPublishedDevotions(locale);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.devotions")}
        title={t("devotions.title")}
        subtitle={t("devotions.subtitle")}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
