import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Life" };

export default async function SpiritualLifePage() {
  const { t } = await getTranslator();
  const practices = await listPublished("SPIRITUAL_PRACTICE");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />
      <PublishedList items={practices} baseHref="/spiritual-life" eyebrowField="practiceKind" />
    </div>
  );
}
