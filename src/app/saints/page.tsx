import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";
import { prisma } from "@/lib/db";

export const metadata = { title: "Saints & Our Lady" };

export default async function SaintsPage() {
  const { t, locale } = await getTranslator();
  const [saints, apparitions] = await Promise.all([
    prisma.saint.findMany({
      where: { status: "PUBLISHED" },
      include: { translations: { where: { locale } } },
      orderBy: { canonicalName: "asc" },
      take: 60,
    }),
    prisma.marianApparition.findMany({
      where: { status: "PUBLISHED" },
      include: { translations: { where: { locale } } },
      orderBy: { title: "asc" },
      take: 30,
    }),
  ]);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />

      <section>
        <div className="vf-ornament mb-8" aria-hidden="true">
          <span className="font-display text-2xl">☩</span>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {saints.length === 0 ? (
            <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
              Saints dataset will appear here as it is seeded and published.
            </div>
          ) : (
            saints.map((s) => {
              const tr = s.translations[0];
              return (
                <article key={s.id} className="vf-card rounded-sm p-6">
                  <p className="vf-eyebrow">{t("saints.feastDay")}: {s.feastDay ?? "—"}</p>
                  <h2 className="mt-3 font-display text-2xl">{tr?.name ?? s.canonicalName}</h2>
                  <p className="mt-3 line-clamp-4 font-serif text-sm text-ink-soft">
                    {tr?.biography ?? s.biography}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="text-center font-display text-3xl">Approved Marian apparitions</h2>
        <div className="vf-rule mx-auto my-5" />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {apparitions.length === 0 ? (
            <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
              Approved apparition entries will appear here.
            </div>
          ) : (
            apparitions.map((a) => {
              const tr = a.translations[0];
              return (
                <article key={a.id} className="vf-card rounded-sm p-6">
                  <p className="vf-eyebrow">{a.location ?? "—"}</p>
                  <h3 className="mt-3 font-display text-2xl">{tr?.title ?? a.title}</h3>
                  <p className="mt-3 line-clamp-4 font-serif text-sm text-ink-soft">
                    {tr?.summary ?? a.summary}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
