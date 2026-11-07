import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import { PrayerLanguageToggle, ShareButton } from "@/components/ui";
import { PrayerText } from "@/components/ui/PrayerText";
import { resolvePrayerLanguage } from "@/lib/content-shared/prayer-language";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";
import { loadNamedPrayers, publishedPrayerVariants } from "@/lib/data/prayer-sets";
import { displayItem, displayPrayerVariants } from "@/lib/translation/display";
import { localizeItem, localizePrayers } from "@/lib/translation/localize";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * A title's closing bracket is usually the prayer's other name ("Litany of the
 * Blessed Virgin Mary (Litany of Loreto)"), so it is set under the title in a
 * lighter voice rather than wrapping the name across lines. The words and their
 * order are unchanged. A number stays with its title ("Psalm 102 (103)"), and
 * "St." stays with the name it belongs to.
 */
function PrayerTitle({ title }: { title: string }) {
  const parts = /^(.*\S)\s+(\((?!\d)[^()]+\))$/.exec(title);
  const main = (parts?.[1] ?? title).replace(/\b(Sts?\.) /g, "$1\u00a0");
  return (
    <h1 className="vf-detail-title text-ink">
      {main}
      {parts ? (
        <>
          {" "}
          <span className="vf-detail-title-aside">{parts[2]}</span>
        </>
      ) : null}
    </h1>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("PRAYER", slug));
}

/**
 * A prayer's page — prayers, litanies, the Rosary and chaplet prayers — is the
 * prayer's title, Share and Save, and then the prayer itself with its Latin /
 * Greek chips. That is all the owner asked for, so the page does not add a type
 * label, a subtitle ("Catholic prayer · Latin text", on a page that opens
 * in English), the summary, an "Official text" box, "When it is prayed" chips of
 * stored tokens ("three-oclock-hour"), related saints, or a Sources footer. The
 * payload keeps every one of those fields; search, the /prayers filters and the
 * share card still read them.
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
    <article className="vf-detail">
      <header className="vf-detail-header">
        <PrayerTitle title={shown.title} />
        <div className="vf-detail-actions">
          <ShareButton title={shown.title} text={summary ?? shown.title} />
          <SaveContentButton contentType="PRAYER" slug={slug} />
        </div>
      </header>

      {variants.length > 0 ? (
        <PrayerLanguageToggle variants={variants} linkedPrayers={linkedPrayers} />
      ) : (
        <PrayerText text={body} headingLevel={2} />
      )}
    </article>
  );
}
