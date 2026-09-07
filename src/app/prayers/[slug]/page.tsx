import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SaveContentButton } from "@/components/profile";
import {
  PrayerLanguageToggle,
  RelatedContentLinks,
  ShareButton,
  resolveRelatedLinks,
} from "@/components/ui";
import { buildPrayerVariants } from "@/lib/content-shared/prayer-language";
import { categorizePrayer, prayerCategoryLabel } from "@/lib/content-shared/prayer-categories";
import { getPublishedBySlug, buildPublishedMetadata } from "@/lib/data/published";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildPublishedMetadata(await getPublishedBySlug("PRAYER", slug));
}

/**
 * Two prayer texts are "the same prayer" when only whitespace, punctuation and
 * capitalisation differ — `officialPrayer` is very often the body flattened
 * onto one line, which is why the page used to print the Our Father twice.
 */
function sameText(a: string, b: string): boolean {
  const fold = (s: string) =>
    s
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[^a-z0-9]+/g, "");
  return fold(a) === fold(b);
}

function httpCitations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) seen.add(v.trim());
  }
  return [...seen];
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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

  // The official text is shown ONLY when it is genuinely a different text from
  // the one already on the page — otherwise the reader saw the same prayer in
  // a grey box and then again below it.
  const officialRaw = typeof payload.officialPrayer === "string" ? payload.officialPrayer : "";
  const officialPrayer =
    officialRaw.trim() && !variants.some((v) => sameText(v.text, officialRaw)) ? officialRaw : null;

  const occasions = Array.isArray(payload.occasions)
    ? payload.occasions.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
    : [];
  const relatedSaints = await resolveRelatedLinks("SAINT", payload.relatedSaints);
  const citations = httpCitations(payload.citations);
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
          <div>
            <p className="vf-eyebrow">{categoryLabel}</p>
            <h1 className="mt-2 font-display text-4xl text-ink">{prayer.title}</h1>
            {prayer.subtitle ? (
              <p className="mt-1 font-serif text-base italic text-ink-soft">{prayer.subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ShareButton title={prayer.title} text={summary ?? prayer.title} />
            <SaveContentButton contentType="PRAYER" slug={slug} />
          </div>
        </div>
        {summary && <p className="mt-3 font-serif leading-relaxed text-ink-soft">{summary}</p>}
      </header>

      <section>
        {variants.length > 0 ? (
          <PrayerLanguageToggle variants={variants} />
        ) : (
          <p className="whitespace-pre-line font-serif text-lg leading-relaxed text-ink">{body}</p>
        )}
      </section>

      {officialPrayer && (
        <section className="mt-8 rounded border border-ink/10 bg-ink/[0.03] p-4">
          <p className="vf-eyebrow">Official text</p>
          <p className="mt-2 whitespace-pre-line font-serif leading-relaxed text-ink">
            {officialPrayer}
          </p>
        </section>
      )}

      {occasions.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink">When it is prayed</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {occasions.map((occasion) => (
              <li
                key={occasion}
                className="rounded-full border border-ink/15 px-3 py-1 font-serif text-sm text-ink-soft"
              >
                {occasion}
              </li>
            ))}
          </ul>
        </section>
      )}

      <RelatedContentLinks title="Related saints" links={relatedSaints} />

      {citations.length > 0 && (
        <footer className="mt-10 border-t border-ink/10 pt-6">
          <p className="vf-eyebrow text-ink-faint">Sources</p>
          <ul className="mt-2 space-y-1">
            {citations.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vf-nav-link break-all font-serif text-sm"
                >
                  {hostOf(url)} ↗
                </a>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
