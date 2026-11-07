import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function SpiritualLifeLoading() {
  return (
    <TabLoadingSkeleton
      title="Spiritual Life"
      subtitle="Formation pathways, guided devotions, and step-by-step checklists for growing in holiness."
      cards={12}
    />
  );
}
