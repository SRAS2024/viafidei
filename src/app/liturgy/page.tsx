import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgy" };

export default async function LiturgyPage() {
  const { t } = await getTranslator();
  const items = await listPublished("LITURGICAL");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgy")}
        title={t("liturgy.title")}
        subtitle={t("liturgy.subtitle")}
      />
      <PublishedList items={items} baseHref="/liturgy-history" eyebrowField="kind" />
    </div>
  );
}
