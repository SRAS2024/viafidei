import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";
import { prisma } from "@/lib/db";

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const { t } = await getTranslator();
  const q = (searchParams.q ?? "").trim();

  const [prayers, saints, apparitions, parishes] = q
    ? await Promise.all([
        prisma.prayer.findMany({
          where: {
            status: "PUBLISHED",
            OR: [
              { defaultTitle: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 10,
        }),
        prisma.saint.findMany({
          where: {
            status: "PUBLISHED",
            OR: [
              { canonicalName: { contains: q, mode: "insensitive" } },
              { biography: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 10,
        }),
        prisma.marianApparition.findMany({
          where: {
            status: "PUBLISHED",
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 10,
        }),
        prisma.parish.findMany({
          where: {
            status: "PUBLISHED",
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 10,
        }),
      ])
    : [[], [], [], []];

  const total = prayers.length + saints.length + apparitions.length + parishes.length;

  return (
    <div>
      <PageHero eyebrow={t("nav.search")} title={t("search.title")} subtitle={t("search.subtitle")} />

      <form method="get" className="mx-auto mb-10 max-w-xl">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("search.placeholder")}
          className="vf-input"
        />
      </form>

      {q && total === 0 ? (
        <p className="text-center font-serif text-ink-faint">{t("search.noResults")}</p>
      ) : null}

      {prayers.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">{t("nav.prayers")}</h2>
          <ul className="divide-y divide-ink/10 vf-card rounded-sm">
            {prayers.map((p) => (
              <li key={p.id} className="px-5 py-4 font-serif">
                {p.defaultTitle}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {saints.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">{t("nav.saints")}</h2>
          <ul className="divide-y divide-ink/10 vf-card rounded-sm">
            {saints.map((s) => (
              <li key={s.id} className="px-5 py-4 font-serif">
                {s.canonicalName}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {apparitions.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">Marian apparitions</h2>
          <ul className="divide-y divide-ink/10 vf-card rounded-sm">
            {apparitions.map((a) => (
              <li key={a.id} className="px-5 py-4 font-serif">
                {a.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {parishes.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">Parishes</h2>
          <ul className="divide-y divide-ink/10 vf-card rounded-sm">
            {parishes.map((p) => (
              <li key={p.id} className="px-5 py-4 font-serif">
                {p.name} — {[p.city, p.country].filter(Boolean).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
