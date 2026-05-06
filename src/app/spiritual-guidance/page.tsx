import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedParishes } from "@/lib/data/parishes";
import { ParishList } from "./_components/ParishList";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Guidance" };

export default async function GuidancePage() {
  const { t } = await getTranslator();
  let parishes: Awaited<ReturnType<typeof listPublishedParishes>> = [];
  try {
    parishes = await listPublishedParishes();
  } catch (err) {
    logPageError({ route: "/spiritual-guidance", entityType: "Parish", error: err });
  }
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
