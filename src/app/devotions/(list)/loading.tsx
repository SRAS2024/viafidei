import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function DevotionsLoading() {
  const { t } = await getTranslator();
  return (
    <TabLoadingSkeleton
      eyebrow={t("nav.devotions")}
      title={t("devotions.title")}
      subtitle={t("devotions.subtitle")}
      cards={12}
      controlsNote
    />
  );
}
