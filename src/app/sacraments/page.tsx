import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sacraments" };

export default async function SacramentsPage() {
  const { t } = await getTranslator();
  const items = await listPublished("SACRAMENT");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.sacraments")}
        title={t("sacraments.title")}
        subtitle={t("sacraments.subtitle")}
      />
      <PublishedList items={items} baseHref="/sacraments" />
    </div>
  );
}
