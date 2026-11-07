import Link from "next/link";

import { PageHero } from "@/components/ui/PageHero";

export default function SpiritualLifeNotFound() {
  return (
    <div className="vf-message">
      <PageHero
        eyebrow="404"
        title="Guide not found"
        subtitle="This guide may have been removed or the link is incorrect."
      />
      <Link href="/spiritual-life" className="vf-btn vf-btn-ghost">
        <span aria-hidden="true">←</span> Back to Spiritual Life
      </Link>
    </div>
  );
}
