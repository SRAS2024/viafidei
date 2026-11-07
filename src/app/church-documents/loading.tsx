import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function ChurchDocumentsLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="The Magisterium"
      title="Church Documents"
      subtitle="Encyclicals, council documents, the Catechism, and Canon Law — each linked to its official source."
      cards={12}
    />
  );
}
