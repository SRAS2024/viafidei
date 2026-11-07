import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function DoctorsLoading() {
  return (
    <TabLoadingSkeleton
      eyebrow="The Church's great teachers"
      title="Doctors of the Church"
      subtitle="A Doctor of the Church is a saint recognized by the Church for an eminent contribution to theology or doctrine through their writing, teaching, and holiness."
      cards={12}
      summary={false}
    />
  );
}
