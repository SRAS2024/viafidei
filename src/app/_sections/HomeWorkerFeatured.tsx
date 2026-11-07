import { ContentCard } from "@/components/ui/ContentCard";
import { saintCardDetailLines } from "@/lib/content-shared/saints";
import { featuredHrefFor, type FeaturedBlockView } from "@/lib/data/homepage";
import type { Translator } from "@/lib/i18n/translator";

import { FeaturedCards } from "./FeaturedRail";
import { HomeSectionHead } from "./HomeSectionHead";

/**
 * A rail's name under the section's "Featured" heading: "Prayers", not "Featured
 * Prayers". The worker's stored heading is English, so the kinds the site has
 * words for are worded in the reader's language.
 */
function railName(block: FeaturedBlockView, t: Translator): string {
  switch (block.blockType) {
    case "featured-prayers":
      return t("nav.prayers");
    case "featured-saints":
      return t("home.featured.saints");
    case "featured-devotions":
      return t("home.featured.devotions");
    case "featured-novenas":
      return t("home.featured.novenas");
    default:
      return block.heading.replace(/^Featured\s+/i, "");
  }
}

/**
 * Section III when a Homepage Makeover has been published: the worker's
 * `featured-*` rails, each a small subsection of its own. Otherwise the homepage
 * falls back to its static featured prayers.
 */
export function HomeWorkerFeatured({ blocks, t }: { blocks: FeaturedBlockView[]; t: Translator }) {
  if (blocks.length === 0) return null;
  return (
    <section className="vf-home-section" aria-labelledby="home-featured-title">
      <HomeSectionHead n={3} id="home-featured-title">
        {t("home.featured.section")}
      </HomeSectionHead>
      <div className="vf-stack-related">
        {blocks.map((block) => (
          <div key={block.blockKey}>
            <h3 className="vf-subhead vf-home-rail-title">{railName(block, t)}</h3>
            <FeaturedCards
              cards={block.items.map((item) => (
                <ContentCard
                  key={item.slug}
                  href={featuredHrefFor(block.blockType, item.slug)}
                  title={item.title}
                  titleAs="h4"
                  meta={[...(item.meta ?? []), ...saintCardDetailLines(item.saint, t)]}
                  action={t("common.open")}
                />
              ))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
