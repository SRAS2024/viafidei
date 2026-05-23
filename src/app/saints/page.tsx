import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saints" };

export default async function SaintsPage() {
  const { t } = await getTranslator();
  const items = await listPublished("SAINT");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />
      <PublishedList items={items} baseHref="/saints" eyebrowField="feastDay" />
    </div>
  );
}
