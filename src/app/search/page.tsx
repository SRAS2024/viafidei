import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";
import { prisma } from "@/lib/db";

export const metadata = { title: "Search" };

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-ink/10 px-0.5 text-ink">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

type Group = {
  key: string;
  label: string;
  count: number;
  items: Array<{ id: string; primary: string; secondary?: string; href?: string }>;
};

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

  const groups: Group[] = [
    {
      key: "prayers",
      label: t("nav.prayers"),
      count: prayers.length,
      items: prayers.map((p) => ({
        id: p.id,
        primary: p.defaultTitle,
        secondary: p.category ?? undefined,
        href: "/prayers",
      })),
    },
    {
      key: "saints",
      label: t("nav.saints"),
      count: saints.length,
      items: saints.map((s) => ({
        id: s.id,
        primary: s.canonicalName,
        secondary: s.feastDay ?? undefined,
        href: "/saints",
      })),
    },
    {
      key: "apparitions",
      label: t("search.group.apparitions"),
      count: apparitions.length,
      items: apparitions.map((a) => ({
        id: a.id,
        primary: a.title,
        secondary: a.location ?? undefined,
        href: "/saints",
      })),
    },
    {
      key: "parishes",
      label: t("search.group.parishes"),
      count: parishes.length,
      items: parishes.map((p) => ({
        id: p.id,
        primary: p.name,
        secondary: [p.city, p.country].filter(Boolean).join(", "),
        href: "/spiritual-guidance",
      })),
    },
  ];

  const total = groups.reduce((acc, g) => acc + g.count, 0);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.search")}
        title={t("search.title")}
        subtitle={t("search.subtitle")}
      />

      <form
        method="get"
        role="search"
        className="mx-auto mb-12 flex max-w-xl items-center gap-2"
      >
        <div className="vf-card flex w-full items-center gap-2 rounded-sm px-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            className="shrink-0 text-ink-faint"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            name="q"
            defaultValue={q}
            placeholder={t("search.placeholder")}
            aria-label={t("nav.search")}
            className="w-full border-0 bg-transparent px-1 py-3 font-serif text-base text-ink outline-none placeholder:italic placeholder:text-ink-faint"
          />
        </div>
        <button type="submit" className="vf-btn vf-btn-primary">
          {t("nav.search")}
        </button>
      </form>

      {q ? (
        <p className="mb-8 text-center font-serif text-ink-faint">
          {total === 0
            ? t("search.noResults")
            : t("search.resultsCount", { count: total, query: q })}
        </p>
      ) : null}

      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        {groups
          .filter((g) => g.count > 0)
          .map((g) => (
            <section key={g.key}>
              <header className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-2xl text-ink">{g.label}</h2>
                <span className="vf-eyebrow">{g.count}</span>
              </header>
              <ul className="vf-card divide-y divide-ink/10 rounded-sm">
                {g.items.map((item) => (
                  <li key={`${g.key}:${item.id}`} className="px-5 py-4">
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-serif text-lg text-ink">
                            {highlight(item.primary, q)}
                          </p>
                          {item.secondary ? (
                            <p className="vf-eyebrow mt-1">{item.secondary}</p>
                          ) : null}
                        </div>
                        <span aria-hidden="true" className="text-ink-faint">
                          →
                        </span>
                      </Link>
                    ) : (
                      <div>
                        <p className="font-serif text-lg text-ink">
                          {highlight(item.primary, q)}
                        </p>
                        {item.secondary ? (
                          <p className="vf-eyebrow mt-1">{item.secondary}</p>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
