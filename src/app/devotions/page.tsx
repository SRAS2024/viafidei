import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Devotions" };

export default async function DevotionsPage() {
  const { t } = await getTranslator();
  const items = await listPublished("DEVOTION");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.devotions")}
        title={t("devotions.title")}
        subtitle={t("devotions.subtitle")}
      />
      <PublishedList items={items} baseHref="/devotions" eyebrowField="devotionType" />
    </div>
  );
}
