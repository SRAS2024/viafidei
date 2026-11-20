import { ContentCard } from "@/components/ui/ContentCard";
import type { Translator } from "@/lib/i18n/translator";

import { FeaturedCards } from "./FeaturedRail";
import { HomeSectionHead } from "./HomeSectionHead";

/**
 * A card on the homepage's featured rail. `category` is the HUMAN LABEL
 * ("Marian", "Acts"), never the stored category value — it is rendered verbatim.
 */
export type FeaturedPrayer = { id: string; title: string; category: string; slug: string };

const FALLBACK_PRAYERS: FeaturedPrayer[] = [
  { id: "fallback-1", title: "Pater Noster", category: "Dominical", slug: "pater-noster" },
  { id: "fallback-2", title: "Ave Maria", category: "Marian", slug: "ave-maria" },
  { id: "fallback-3", title: "Anima Christi", category: "Eucharistic", slug: "anima-christi" },
];

export function HomeFeatured({
  t,
  items,
  locale,
}: {
  t: Translator;
  items?: FeaturedPrayer[];
  /** The reader's language: the cards' titles and labels are the stored English. */
  locale?: string;
}) {
  const prayers = items && items.length > 0 ? items : FALLBACK_PRAYERS;
  const english = locale && locale !== "en" ? "en" : undefined;
  return (
    <section className="vf-home-section" aria-labelledby="home-featured-title">
      <HomeSectionHead n={3} id="home-featured-title">
        {t("home.featured.title")}
      </HomeSectionHead>
      <FeaturedCards
        cards={prayers.map((p) => (
          <ContentCard
            key={p.id}
            href={`/prayers/${p.slug}`}
            title={p.title}
            lang={english}
            metaLang={english}
            titleAs="h3"
            // "General" names no type, as on the prayer library's own cards.
            meta={[p.category === "General" ? null : p.category]}
            action={t("common.open")}
          />
        ))}
      />
    </section>
  );
}
