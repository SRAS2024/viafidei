import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PrayerLanguageToggle, ShareButton } from "@/components/ui";
import { buildPrayerVariants, resolvePrayerLanguage } from "@/lib/content-shared/prayer-language";
import { categorizePrayer, prayerCategoryLabel } from "@/lib/content-shared/prayer-categories";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadNamedPrayers } from "@/lib/data/prayer-sets";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("PRAYER", slug));
}

/**
 * A prayer's page — prayers, litanies, the Rosary and chaplet prayers — is the
 * prayer's title and then the prayer itself, with its Latin / Greek chips. That
 * is all the owner asked for, so the page no longer adds a subtitle ("Catholic
 * prayer · Latin text", on a page that opens in English), the summary, an
 * "Official text" box, "When it is prayed" chips of stored tokens
 * ("three-oclock-hour"), related saints, or a Sources footer. The payload keeps
 * every one of those fields; search and the share card still read them.
 */
export default async function PrayerDetailPage({ params }: Props) {
  const { slug } = await params;
  const prayer = await getPublishedBySlug("PRAYER", slug);
  if (!prayer) notFound();

  const payload = prayer.payload;
  // Knowledge-base prayers store the text in `body`; worker-extracted prayers
  // use `prayerText`. Accept either so the prayer text always renders.
  const body =
    (payload.body as string | undefined) ?? (payload.prayerText as string | undefined) ?? "";
  const variants = buildPrayerVariants(payload);
  const summary = payload.summary as string | undefined;
  // The Rosary and chaplet prayers (and a litany ending "Our Father, Hail Mary,
  // Glory Be") name other prayers: each name opens that prayer in place, with
  // its own Latin / Greek chips. Matched case-sensitively, because this text is
  // itself prayer — "our father Abraham" in a canticle is not a rubric.
  const linkedPrayers = await loadNamedPrayers(
    [resolvePrayerLanguage(variants, null).vernacular?.text ?? ""],
    { matchCase: true, exclude: slug },
  );
  // The eyebrow is the prayer's canonical category ("Marian", "Acts",
  // "Litanies") — the stored descriptive strings ("theological-virtue") are
  // folded to canonical values by categorizePrayer, so none can reach a reader.
  const categoryLabel = prayerCategoryLabel(
    categorizePrayer({
      title: prayer.title,
      prayerType: typeof payload.prayerType === "string" ? payload.prayerType : null,
      body,
      category: typeof payload.category === "string" ? payload.category : null,
    }),
  );

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="vf-eyebrow">{categoryLabel}</p>
            <h1 className="mt-2 break-words font-display text-4xl text-ink">{prayer.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ShareButton title={prayer.title} text={summary ?? prayer.title} />
            <SaveContentButton contentType="PRAYER" slug={slug} />
          </div>
        </div>
      </header>

      <section>
        {variants.length > 0 ? (
          <PrayerLanguageToggle variants={variants} linkedPrayers={linkedPrayers} />
        ) : (
          <p className="whitespace-pre-line font-serif text-lg leading-relaxed text-ink">{body}</p>
        )}
      </section>
    </article>
  );
}
