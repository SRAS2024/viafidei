import Link from "next/link";

import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublished } from "@/lib/data/published";
import {
  PRAYER_CATEGORIES,
  categorizePrayer,
  prayerCategoryLabel,
} from "@/lib/content-shared/prayer-categories";

import { PrayerFilterDropdown, type FilterOption } from "./_components/PrayerFilterDropdown";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prayers" };

type Props = { searchParams: Promise<{ filter?: string }> };

export default async function PrayersPage({ searchParams }: Props) {
  const { t } = await getTranslator();
  const { filter } = await searchParams;
  const prayers = await listPublished("PRAYER");

  // Categorise each prayer (Marian / Angelic / Liturgical / …) so the filter
  // works against real data even before the worker emits canonical categories.
  const annotated = prayers.map((p) => ({
    prayer: p,
    category: categorizePrayer({
      title: p.title,
      prayerType: p.payload.prayerType as string | undefined,
      body: p.payload.body as string | undefined,
      category: p.payload.category as string | undefined,
    }),
  }));

  const present = new Set(annotated.map((a) => a.category));
  const options: FilterOption[] = [
    { value: null, label: "All" },
    ...PRAYER_CATEGORIES.filter((c) => present.has(c.value)).map((c) => ({
      value: c.value,
      label: c.label,
    })),
  ];
  const selected = filter && PRAYER_CATEGORIES.some((c) => c.value === filter) ? filter : null;
  const visible = selected ? annotated.filter((a) => a.category === selected) : annotated;

  return (
    <div>
      <PageHero
        eyebrow={t("nav.prayers")}
        title={t("prayers.title")}
        subtitle={t("prayers.subtitle")}
      />

      {prayers.length > 0 ? (
        <div className="mb-8">
          <PrayerFilterDropdown options={options} selected={selected} />
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {prayers.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-10 text-center font-serif text-ink-faint">
            The prayer library will appear here as items are approved and published through the
            checklist-first worker.
          </div>
        ) : (
          visible.map(({ prayer: p, category }) => {
            const body = (p.payload.body as string | undefined) ?? "";
            return (
              <Link key={p.id} href={`/prayers/${p.slug}`}>
                <article className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30 sm:p-7">
                  <p className="vf-eyebrow">{prayerCategoryLabel(category)}</p>
                  <h2 className="mt-3 break-words font-display text-xl sm:text-2xl">{p.title}</h2>
                  <p className="mt-4 line-clamp-5 font-serif leading-relaxed text-ink-soft">
                    {body}
                  </p>
                </article>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
