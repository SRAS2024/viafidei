import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedPrayers } from "@/lib/data/prayers";

export const metadata = { title: "Prayers" };

const PRAYER_CATEGORIES = [
  "prayers.category.marian",
  "prayers.category.christ",
  "prayers.category.angelic",
  "prayers.category.sacramental",
  "prayers.category.seasonal",
  "prayers.category.daily",
] as const;

export default async function PrayersPage() {
  const { t, locale } = await getTranslator();
  const prayers = await listPublishedPrayers(locale);

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              <article key={p.id} className="vf-card rounded-sm p-7">
                <p className="vf-eyebrow">{p.category}</p>
                <h2 className="mt-3 font-display text-2xl">{title}</h2>
                <p className="mt-4 line-clamp-5 font-serif text-ink-soft">{body}</p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
