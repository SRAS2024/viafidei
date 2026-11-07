import { DetailLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";

// This route's index only redirects to /history; what loads under it is one
// entry or document, a reading page, so that is the shape to reserve.
export default function LiturgyHistoryLoading() {
  return <DetailLoadingSkeleton />;
}
