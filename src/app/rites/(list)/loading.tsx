import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { RITE_FILTERS } from "@/lib/content-shared/rite-categories";

export default function RitesLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="The Catholic Church"
      title="Rites"
      subtitle="The liturgical traditions of the one Catholic Church — the Latin (Roman) Rite and the Eastern Catholic rites — each with its own history."
      cards={12}
      filterLabels={RITE_FILTERS.map((filter) => filter.label)}
      metaLines={0}
    />
  );
}
