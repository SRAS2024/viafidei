import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function LitaniesLoading() {
  const { t } = await getTranslator();
  return (
    <TabLoadingSkeleton
      eyebrow={t("litanies.eyebrow")}
      title={t("litanies.title")}
      subtitle={t("litanies.subtitle")}
      cards={12}
      titleLines={2}
      metaLines={0}
      summary={false}
    />
  );
}
