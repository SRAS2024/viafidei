import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function NovenasLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="Nine days of prayer"
      title="Novenas"
      subtitle="A novena is a prayer made over nine days, most often in a row, to ask a particular grace or to prepare for a feast. It follows the nine days the Apostles spent in prayer with Mary between the Ascension and Pentecost."
      cards={12}
      metaLines={0}
      themeLines={2}
    />
  );
}
