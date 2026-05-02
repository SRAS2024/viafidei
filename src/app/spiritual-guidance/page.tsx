import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedParishes } from "@/lib/data/parishes";
import { ParishList } from "./_components/ParishList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Guidance" };

export default async function GuidancePage() {
  const { t } = await getTranslator();
  const parishes = await listPublishedParishes();
  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualGuidance")}
        title={t("guidance.title")}
        subtitle={t("guidance.subtitle")}
      />
      <ParishList parishes={parishes} placeholder={t("guidance.searchPlaceholder")} />
    </div>
  );
}
