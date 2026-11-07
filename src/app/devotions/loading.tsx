import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function DevotionsLoading() {
  return (
    <TabLoadingSkeleton
      title="Devotions"
      subtitle="Traditional Catholic devotions — the Rosary, Divine Mercy, the Angelus, novenas, and more."
      cards={12}
    />
  );
}
