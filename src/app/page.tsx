import type { Metadata } from "next";

import { getTranslator } from "@/lib/i18n/server";
import { listFeaturedPrayers } from "@/lib/data/published";
import { getPublishedFeaturedBlocks } from "@/lib/data/homepage";
import {
  HomeBeginHere,
  HomeFeatured,
  HomeHero,
  HomeMission,
  HomeTodaySection,
  HomeWorkerFeatured,
} from "./_sections";
import type { FeaturedPrayer } from "./_sections/HomeFeatured";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const { t } = await getTranslator();

  // Worker-published featured rails (Homepage Makeover). When present,
  // they replace the static featured prayers rail; otherwise the
  // homepage looks exactly as it does by default.
  const workerFeatured = await getPublishedFeaturedBlocks().catch(() => []);

  // The featured rail rotates by itself: `listFeaturedPrayers` picks six
  // prayers deterministically from the day's key, so the set is stable within
  // a day (no reshuffle between server render and reload) and different
  // tomorrow — the site keeps cycling even when the worker is off. It reads
  // six titles, not every prayer body, and the card's line is the CATEGORY LABEL,
  // so a stored value like "theological-virtue" never reaches the page.
  const dayKey = new Date().toISOString().slice(0, 10);
  const featured =
    workerFeatured.length > 0 ? [] : await listFeaturedPrayers(dayKey).catch(() => []);
  const featuredPrayers: FeaturedPrayer[] = featured.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.categoryLabel,
    slug: p.slug,
  }));

  return (
    <div className="vf-stack-section">
      <HomeHero t={t} />
      <HomeBeginHere t={t} />
      <HomeTodaySection />
      {workerFeatured.length > 0 ? (
        <HomeWorkerFeatured blocks={workerFeatured} t={t} />
      ) : (
        <HomeFeatured t={t} items={featuredPrayers} />
      )}
      <HomeMission t={t} />
    </div>
  );
}
