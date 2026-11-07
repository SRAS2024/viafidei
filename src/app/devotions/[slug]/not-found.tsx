import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function DevotionNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Devotion not found"
        subtitle="This entry may have been removed or the link is incorrect."
      />
      <Link href="/devotions" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Devotions
      </Link>
    </div>
  );
}
