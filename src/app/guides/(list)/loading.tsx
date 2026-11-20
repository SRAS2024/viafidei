import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function GuidesLoading() {
  const { t } = await getTranslator();
  return (
    <TabLoadingSkeleton
      eyebrow={t("guides.eyebrow")}
      title={t("guides.title")}
      subtitle={t("guides.subtitle")}
      cards={12}
      filterWidth="5.125rem"
    />
  );
}
