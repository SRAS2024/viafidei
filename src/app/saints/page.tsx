import { PageHero, PublishedList } from "@/components/ui";
import { compareSaintsChronologically, saintEyebrow } from "@/lib/content-shared/saints";
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
      {/* Earliest saints first (Apostles → modern), each tagged with its strict title. */}
      <PublishedList
        items={items}
        baseHref="/saints"
        sortItems={compareSaintsChronologically}
        eyebrowFor={(item) => saintEyebrow(item.payload)}
      />
    </div>
  );
}
