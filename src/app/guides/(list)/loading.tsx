import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function GuidesLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="How to pray &amp; practice"
      title="Guides"
      subtitle="Step-by-step guides to the Rosary, the Divine Mercy Chaplet, Confession, and the spiritual life — steps first, then each prayer in a dropdown."
      cards={12}
      filterWidth="5.125rem"
    />
  );
}
