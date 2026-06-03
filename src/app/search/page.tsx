import Link from "next/link";

import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { searchPublished } from "@/lib/data/published";
import { SearchInput } from "./_components/SearchInput";
import type { ChecklistContentType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const TYPE_PATHS: Record<ChecklistContentType, string> = {
  PRAYER: "/prayers",
  DEVOTION: "/devotions",
  SAINT: "/saints",
  MARIAN_TITLE: "/our-lady",
  APPARITION: "/our-lady",
  NOVENA: "/devotions",
  SACRAMENT: "/sacraments",
  GUIDE: "/guides",
  CHURCH_DOCUMENT: "/liturgy-history",
  LITURGICAL: "/liturgy-history",
  SPIRITUAL_PRACTICE: "/spiritual-life",
  PARISH: "/parishes",
  POPE: "/popes",
  DOCTOR: "/doctors",
  RITE: "/rites",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { t } = await getTranslator();
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();

  const hits = q ? await searchPublished(q, 50) : [];

  return (
    <div>
      <PageHero
        eyebrow={t("nav.search")}
        title={t("search.title")}
        subtitle={t("search.subtitle")}
      />

      <SearchInput
        defaultValue={q}
        placeholder={t("search.placeholder")}
        ariaLabel={t("nav.search")}
        submitLabel={t("nav.search")}
      />

      {q && (
        <p className="mb-8 text-center font-serif text-ink-faint">
          {hits.length === 0
            ? "No results for that query."
            : `${hits.length} result${hits.length === 1 ? "" : "s"} for "${q}".`}
        </p>
      )}

      <div className="mx-auto max-w-3xl space-y-3">
        {hits.map((item) => (
          <Link
            key={item.id}
            href={`${TYPE_PATHS[item.contentType]}/${item.slug}`}
            className="block rounded border border-slate-200 bg-white p-4 transition hover:border-slate-400"
          >
            <p className="text-xs uppercase tracking-wide text-ink-faint">{item.contentType}</p>
            <p className="mt-1 font-display text-lg text-ink">{item.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
