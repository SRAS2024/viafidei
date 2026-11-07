import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { LITURGY_SECTIONS } from "@/lib/content-shared/liturgy-order";
import { getTranslator } from "@/lib/i18n/server";

export default async function LiturgyLoading() {
  const { t } = await getTranslator();
  return (
    <TabLoadingSkeleton
      eyebrow={t("nav.liturgy")}
      title={t("liturgy.title")}
      subtitle={t("liturgy.subtitle")}
      cards={12}
      filterWidth="5.125rem"
      heading={LITURGY_SECTIONS[0]?.label}
      metaLines={0}
    />
  );
}
