import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PrayerLanguageToggle } from "@/components/ui";
import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";
import { getPublishedBySlug } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

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
  const citations = (prayer.payload.citations as string[] | undefined) ?? [];

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-4xl text-ink">{prayer.title}</h1>
          <div className="shrink-0 pt-1">
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

      {citations.length > 0 && (
        <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-ink-faint">
          <p className="font-medium uppercase tracking-wide">Sources</p>
          <ul className="mt-2 space-y-1">
            {citations.map((url) => (
              <li key={url}>
                <a href={url} className="break-all underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
