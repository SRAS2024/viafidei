import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function LiturgyNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Entry not found"
        subtitle="This entry may have been removed or the link is incorrect."
      />
      <Link href="/liturgy-history" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Liturgy &amp; History
      </Link>
    </div>
  );
}
