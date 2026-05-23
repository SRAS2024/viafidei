import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Church History",
  description: "Council documents, encyclicals, and key Catholic Church documents.",
};

export default async function HistoryPage() {
  const { t } = await getTranslator();
  const documents = await listPublished("CHURCH_DOCUMENT");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.history")}
        title="Church History"
        subtitle="Approved Catholic documents from the Holy See, councils, and the USCCB, organized by type."
      />
      <PublishedList items={documents} baseHref="/liturgy-history" eyebrowField="documentType" />
    </div>
  );
}
