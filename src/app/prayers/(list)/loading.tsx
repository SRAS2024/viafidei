import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

export default function PrayersLoading() {
  return (
    <TabLoadingSkeleton
      title="Prayers"
      subtitle="A curated library of Catholic prayers — Marian, Christocentric, angelic, sacramental, seasonal, and daily devotions."
      cards={12}
      summary={false}
    />
  );
}
