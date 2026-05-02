import { getTranslator } from "@/lib/i18n/server";
import { listPublishedPrayers } from "@/lib/data/prayers";
import { HomeHero, HomeMission, HomeQuickLinks, HomeFeatured, HomeNewcomer } from "./_sections";
import type { FeaturedPrayer } from "./_sections/HomeFeatured";

export const revalidate = 3600;

export default async function HomePage() {
  const { t, locale } = await getTranslator();

  const dbPrayers = await listPublishedPrayers(locale, 6).catch(() => []);
  const featuredPrayers: FeaturedPrayer[] = dbPrayers.map((p) => {
    const tr = p.translations[0];
    return {
      id: p.id,
      title: tr?.title ?? p.defaultTitle,
      category: p.category,
      slug: p.slug,
    };
  });

  return (
    <div className="flex flex-col gap-24">
      <HomeHero t={t} />
      <HomeMission t={t} />
      <HomeQuickLinks t={t} />
      <HomeFeatured t={t} items={featuredPrayers} />
      <HomeNewcomer t={t} />
    </div>
  );
}
