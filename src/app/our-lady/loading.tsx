import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function OurLadyLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="The Blessed Virgin Mary"
      title="Our Lady"
      subtitle="Marian titles and the Church-approved apparitions of the Blessed Virgin Mary."
      cards={12}
    />
  );
}
