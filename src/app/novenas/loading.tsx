import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function NovenasLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="Nine days of prayer"
      title="Novenas"
      subtitle="Nine-day novenas — each day opens in its own dropdown with the full prayer."
      cards={12}
    />
  );
}
