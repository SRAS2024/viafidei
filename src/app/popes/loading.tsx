import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function PopesLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="The Roman Pontiffs"
      title="Popes"
      subtitle="The successors of Saint Peter."
      cards={12}
      columns={4}
      summary={false}
    />
  );
}
