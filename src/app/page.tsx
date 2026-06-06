import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
import { getPublishedFeaturedBlocks } from "@/lib/data/homepage";
import {
  HomeHero,
  HomeMission,
  HomeQuickLinks,
  HomeFeatured,
  HomeWorkerFeatured,
  HomeNewcomer,
  HomeToday,
  LiturgicalToday,
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

  // Worker-published featured rails (Homepage Makeover). When present,
  // they replace the static featured prayers rail; otherwise the
  // homepage looks exactly as it does by default.
  const workerFeatured = await getPublishedFeaturedBlocks().catch(() => []);

  return (
    <div className="flex flex-col gap-24">
      <HomeHero t={t} />
      <HomeMission t={t} />
      <HomeQuickLinks t={t} />
      {workerFeatured.length > 0 ? (
        <HomeWorkerFeatured blocks={workerFeatured} />
      ) : (
        <HomeFeatured t={t} items={featuredPrayers} />
      )}
      <HomeNewcomer t={t} />
      <LiturgicalToday />
      <HomeToday />
    </div>
  );
}
