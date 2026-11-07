import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function SaintsTodayLoading() {
  return (
    <div className="vf-grid-centred">
      <TabLoadingSkeleton
        title="Today's Feast Day Saints"
        cards={3}
        controls={false}
        summary={false}
      />
    </div>
  );
}
