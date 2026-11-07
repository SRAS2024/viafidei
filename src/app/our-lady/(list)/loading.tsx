import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { OUR_LADY_FILTERS } from "@/lib/content-shared/our-lady";

export default function OurLadyLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="The Blessed Virgin Mary"
      title="Our Lady"
      subtitle="Marian titles and the Church-approved apparitions of the Blessed Virgin Mary."
      cards={12}
      filterLabels={OUR_LADY_FILTERS.map((filter) => filter.label)}
      metaLines={0}
    />
  );
}
