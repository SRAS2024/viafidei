import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function SaintsLoading() {
  return (
    <TabLoadingSkeleton
      title="Saints &amp; Our Lady"
      subtitle="Canonized saints, approved Marian apparitions, feast days, and patronage references."
      cards={12}
      columns={4}
      summary={false}
    />
  );
}
