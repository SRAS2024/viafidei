import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PrayerLanguageToggle, ShareButton } from "@/components/ui";
import { resolvePrayerLanguage } from "@/lib/content-shared/prayer-language";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadNamedPrayers, publishedPrayerVariants } from "@/lib/data/prayer-sets";
import { displayItem, displayPrayerVariants } from "@/lib/translation/display";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("PRAYER", slug));
}

/**
 * A prayer's page — prayers, litanies, the Rosary and chaplet prayers — is the
 * prayer's title and then the prayer itself, with its Latin / Greek chips. That
 * is all the owner asked for, so the page no longer adds a category eyebrow
 * ("General" over the Our Father, "Marian" over the Rosary's opening prayers),
 * a subtitle ("Catholic prayer · Latin text", on a page that opens in English),
 * the summary, an "Official text" box, "When it is prayed" chips of stored
 * tokens ("three-oclock-hour"), related saints, or a Sources footer. The
 * payload keeps every one of those fields; search, the /prayers filters and
 * the share card still read them.
 */
export default async function PrayerDetailPage({ params }: Props) {
  const { slug } = await params;
  const prayer = await localizeItem(await getPublishedBySlug("PRAYER", slug));
  if (!prayer) notFound();

  const payload = prayer.payload;
  // What the reader sees, in their language (src/lib/translation); the logic
  // below (which prayers the text names) keeps reading the stored text.
  const shown = displayItem(prayer);
  // Knowledge-base prayers store the text in `body`; worker-extracted prayers
  // use `prayerText`. Accept either so the prayer text always renders.
  const body =
    (payload.body as string | undefined) ?? (payload.prayerText as string | undefined) ?? "";
  const stored = publishedPrayerVariants(slug, payload);
  // The prayer as the reader sees it: the vernacular in their language when it
  // is translated (labelled and marked up as that language), Latin and Greek
  // always as stored.
  const variants = displayPrayerVariants(prayer, (p) => publishedPrayerVariants(slug, p));
  const summary = shown.payload.summary as string | undefined;
  // The Rosary and chaplet prayers (and a litany ending "Our Father, Hail Mary,
  // Glory Be") name other prayers: each name opens that prayer in place, with
  // its own Latin / Greek chips. Matched case-sensitively, because this text is
  // itself prayer — "our father Abraham" in a canticle is not a rubric. Found
  // in the stored text, shown in the reader's language.
  const linkedPrayers = await localizePrayers(
    await loadNamedPrayers([resolvePrayerLanguage(stored, null).vernacular?.text ?? ""], {
      matchCase: true,
      exclude: slug,
    }),
  );
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words font-display text-4xl text-ink">{shown.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ShareButton title={shown.title} text={summary ?? shown.title} />
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
