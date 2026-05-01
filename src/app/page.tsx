import { getTranslator } from "@/lib/i18n/server";
import {
  HomeHero,
  HomeMission,
  HomeQuickLinks,
  HomeFeatured,
  HomeNewcomer,
} from "./_sections";

export default async function HomePage() {
  const { t } = await getTranslator();

  return (
    <div className="flex flex-col gap-24">
      <HomeHero t={t} />
      <HomeMission t={t} />
      <HomeQuickLinks t={t} />
      <HomeFeatured t={t} />
      <HomeNewcomer t={t} />
    </div>
  );
}
