import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
import {
  HomeHero,
  HomeMission,
  HomeQuickLinks,
  HomeFeatured,
  HomeNewcomer,
  HomeToday,
} from "./_sections";
import type { FeaturedPrayer } from "./_sections/HomeFeatured";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { t } = await getTranslator();

  const dbPrayers = await listPublished("PRAYER").catch(() => []);
  const featuredPrayers: FeaturedPrayer[] = dbPrayers.slice(0, 6).map((p) => ({
    id: p.id,
    title: p.title,
    category: (p.payload.category as string | undefined) ?? "general",
    slug: p.slug,
  }));

  return (
    <div className="flex flex-col gap-24">
      <HomeHero t={t} />
      <HomeMission t={t} />
      <HomeQuickLinks t={t} />
      <HomeFeatured t={t} items={featuredPrayers} />
      <HomeNewcomer t={t} />
      <HomeToday />
    </div>
  );
}
