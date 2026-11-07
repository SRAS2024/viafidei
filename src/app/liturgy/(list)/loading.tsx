import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function LiturgyLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="Liturgy"
      title="Liturgy &amp; History"
      subtitle="Formation through the structure, symbolism, and historical continuity of the Church."
      cards={12}
    />
  );
}
