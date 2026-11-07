import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function PrayerNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Prayer not found"
        subtitle="This prayer may have been removed or the link is incorrect."
      />
      <Link href="/prayers" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to prayers
      </Link>
    </div>
  );
}
