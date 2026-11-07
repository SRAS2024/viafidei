import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function LitaniesLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="Prayers"
      title="Litanies"
      subtitle="The Church's litanies — sustained invocations and responses, from the Litany of the Saints to the Litany of Loreto and the Sacred Heart."
      cards={12}
      summary={false}
    />
  );
}
