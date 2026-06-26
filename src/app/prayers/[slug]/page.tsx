import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PrayerLanguageToggle, ShareButton } from "@/components/ui";
import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("PRAYER", slug));
}

export default async function PrayerDetailPage({ params }: Props) {
  const { slug } = await params;
  const prayer = await getPublishedBySlug("PRAYER", slug);
  if (!prayer) notFound();

  // Knowledge-base prayers store the text in `body`; worker-extracted prayers
  // use `prayerText`. Accept either so the prayer text always renders.
  const body =
    (prayer.payload.body as string | undefined) ??
    (prayer.payload.prayerText as string | undefined) ??
    "";
  const variants = buildPrayerVariants(prayer.payload);
  const officialPrayer = prayer.payload.officialPrayer as string | undefined;
  const summary = prayer.payload.summary as string | undefined;

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-4xl text-ink">{prayer.title}</h1>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ShareButton title={prayer.title} text={summary ?? prayer.title} />
            <SaveContentButton contentType="PRAYER" slug={slug} />
          </div>
        </div>
        {summary && <p className="mt-3 font-serif leading-relaxed text-ink-soft">{summary}</p>}
      </header>

      {officialPrayer && (
        <section className="mb-6 rounded border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Official prayer</p>
          <p className="mt-2 whitespace-pre-line font-serif leading-relaxed text-ink">
            {officialPrayer}
          </p>
        </section>
      )}

      <section>
        {variants.length > 0 ? (
          <PrayerLanguageToggle variants={variants} />
        ) : (
          <p className="whitespace-pre-line font-serif text-lg leading-relaxed text-ink">{body}</p>
        )}
      </section>
    </article>
  );
}
