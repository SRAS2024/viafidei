import { redirect } from "next/navigation";

// The dedicated /history tab now hosts the slidable, filterable timeline
// — this old route stays as a permanent redirect so any external bookmark
// or sitemap entry continues to resolve.

export const dynamic = "force-dynamic";

export default function OldTimelineRedirect(): never {
  redirect("/history");
}
